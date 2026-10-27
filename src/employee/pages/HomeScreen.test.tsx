import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { HomeScreen } from './HomeScreen';
import * as middleware from '../../services/middleware.service';

type AuthListener = (event: string) => void;

// The screen listens for auth events; the tests hold on to the listener so they can
// fire events (such as the session ending in another tab) on demand.
const auth = vi.hoisted(() => ({
  listener: null as null | ((event: string) => void),
  unsubscribe: vi.fn(),
}));

vi.mock('../../lib/supabaseClient', () => ({
  default: {
    auth: {
      onAuthStateChange: vi.fn((callback: AuthListener) => {
        auth.listener = callback;
        return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
      }),
    },
  },
}));

vi.mock('../../services/middleware.service', () => ({
  logout: vi.fn(),
}));

const mocked = vi.mocked(middleware);

function Destination() {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/employee/home']}>
      <Routes>
        <Route path="/employee/home" element={<HomeScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const logoutButton = () => screen.getByRole('button', { name: /Logout/ });

function fireAuthEvent(event: string) {
  act(() => auth.listener?.(event));
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.listener = null;
  mocked.logout.mockResolvedValue(undefined);
});

describe('Employee HomeScreen', () => {
  describe('layout', () => {
    it('greets the employee on the Dashboard', () => {
      renderHome();

      expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
      expect(screen.getByText('Welcome back! Select an option to continue')).toBeInTheDocument();
    });

    it('offers exactly three tasks: material purchase, production and delivery', () => {
      renderHome();

      const cards = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
      expect(cards).toEqual(['Material Purchase Entry', 'Production Entry', 'Delivery Entry']);
    });

    it.each([
      ['Material Purchase Entry', 'Click to enter material purchase entry'],
      ['Production Entry', 'Click to enter production entry'],
      ['Delivery Entry', 'Click to enter delivery entry'],
    ])('describes the %s card', (title, hint) => {
      renderHome();

      expect(screen.getByRole('button', { name: new RegExp(title) })).toHaveTextContent(hint);
    });

    it('has a Logout button and the footer credit', () => {
      renderHome();

      expect(logoutButton()).toBeInTheDocument();
      expect(screen.getByText(/Powered by/)).toHaveTextContent('Powered by GG-Tech');
    });

    it('shows no popup when it first opens', () => {
      renderHome();

      expect(screen.queryByText('OK')).not.toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it.each([
      ['Material Purchase Entry', '/employee/material-entry'],
      ['Production Entry', '/employee/production-entry'],
      ['Delivery Entry', '/employee/orders'],
    ])('opens %s at %s', async (title, path) => {
      const user = userEvent.setup();
      renderHome();

      await user.click(screen.getByRole('button', { name: new RegExp(title) }));

      expect(screen.getByTestId('path')).toHaveTextContent(path);
    });

    it('stays on the dashboard until a card is chosen', () => {
      renderHome();

      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    });
  });

  describe('logging out', () => {
    it('signs out and confirms with a success popup', async () => {
      const user = userEvent.setup();
      renderHome();

      await user.click(logoutButton());

      expect(await screen.findByText('Logout Successful')).toBeInTheDocument();
      expect(screen.getByText('You have been logged out successfully.')).toBeInTheDocument();
      expect(mocked.logout).toHaveBeenCalledTimes(1);
    });

    it('keeps the dashboard visible behind the popup until OK is pressed', async () => {
      const user = userEvent.setup();
      renderHome();

      await user.click(logoutButton());
      await screen.findByText('Logout Successful');

      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    });

    it('goes to the employee login after pressing OK', async () => {
      const user = userEvent.setup();
      renderHome();
      await user.click(logoutButton());
      await screen.findByText('Logout Successful');

      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.getByTestId('path')).toHaveTextContent('/employee');
      expect(screen.getByTestId('path').textContent).toBe('/employee');
    });

    it('shows an error popup when signing out fails', async () => {
      const user = userEvent.setup();
      mocked.logout.mockRejectedValue(new Error('network down'));
      renderHome();

      await user.click(logoutButton());

      expect(await screen.findByText('Something Went Wrong')).toBeInTheDocument();
      expect(screen.getByText('Unable to logout. Please try again.')).toBeInTheDocument();
      expect(screen.queryByText('Logout Successful')).not.toBeInTheDocument();
    });

    it('stays on the dashboard after a failed logout and allows trying again', async () => {
      const user = userEvent.setup();
      mocked.logout.mockRejectedValueOnce(new Error('network down'));
      renderHome();
      await user.click(logoutButton());
      await screen.findByText('Something Went Wrong');

      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.queryByText('Something Went Wrong')).not.toBeInTheDocument();
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

      await user.click(logoutButton());
      expect(await screen.findByText('Logout Successful')).toBeInTheDocument();
      expect(mocked.logout).toHaveBeenCalledTimes(2);
    });

    it('ignores a second click while the first sign-out is still running', async () => {
      const user = userEvent.setup();
      let finish: () => void = () => {};
      mocked.logout.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      renderHome();

      await user.click(logoutButton());
      await user.click(logoutButton());
      await user.click(logoutButton());
      expect(mocked.logout).toHaveBeenCalledTimes(1);

      finish();
      expect(await screen.findByText('Logout Successful')).toBeInTheDocument();
    });
  });

  describe('session ended elsewhere', () => {
    it('listens for auth events and stops listening when it closes', () => {
      const { unmount } = renderHome();

      expect(auth.listener).toBeTypeOf('function');
      unmount();
      expect(auth.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('warns the employee when the session ends without them logging out', () => {
      renderHome();

      fireAuthEvent('SIGNED_OUT');

      expect(screen.getByText('Session Expired')).toBeInTheDocument();
      expect(screen.getByText('Your session has expired. Please login again.')).toBeInTheDocument();
    });

    it('sends the employee to login after acknowledging the warning', async () => {
      const user = userEvent.setup();
      renderHome();
      fireAuthEvent('SIGNED_OUT');

      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.getByTestId('path').textContent).toBe('/employee');
    });

    it.each(['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'INITIAL_SESSION'])(
      'does not warn on a %s event',
      (event) => {
        renderHome();

        fireAuthEvent(event);

        expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();
      },
    );

    it('does not call a deliberate logout a session expiry', async () => {
      const user = userEvent.setup();
      mocked.logout.mockImplementation(async () => {
        // supabase-js announces the sign-out while signOut() is still running.
        fireAuthEvent('SIGNED_OUT');
      });
      renderHome();

      await user.click(logoutButton());

      expect(await screen.findByText('Logout Successful')).toBeInTheDocument();
      expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();
    });

    it('warns again after a deliberate logout is completed and a new session ends', async () => {
      const user = userEvent.setup();
      renderHome();
      await user.click(logoutButton());
      await screen.findByText('Logout Successful');
      await user.click(screen.getByRole('button', { name: 'OK' }));
      await waitFor(() => expect(screen.getByTestId('path')).toBeInTheDocument());

      // Back on a fresh dashboard, the next unexpected sign-out must be reported.
      renderHome();
      fireAuthEvent('SIGNED_OUT');

      expect(screen.getByText('Session Expired')).toBeInTheDocument();
    });
  });
});
