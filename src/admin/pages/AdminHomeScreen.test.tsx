import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AdminHomeScreen } from './AdminHomeScreen';
import * as middleware from '../../services/middleware.service';

type AuthListener = (event: string) => void;

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

vi.mock('../../services/middleware.service', () => ({ logout: vi.fn() }));
vi.mock('../components/BranchSwitcher', () => ({ BranchSwitcher: () => <div>branch switcher</div> }));

const mocked = vi.mocked(middleware);

const MODULES: Array<[string, string, string]> = [
  ['Order Management', '/admin/orders', 'Manage all orders and deliveries'],
  ['Production Statistics', '/admin/production', 'View production metrics and data'],
  ['Inventory Management', '/admin/inventory', 'Track stock and materials'],
  ['Customer Management', '/admin/customers', 'Manage customer information'],
  ['Accounts Management', '/admin/accounts', 'Track income and expenses'],
  ['Metrics', '/admin/metrics', 'Business performance metrics'],
  ['Employee Management', '/admin/employees', 'Manage employee records'],
  ['Salary Ledger', '/admin/salarys', 'Employee salary records'],
  ['Vendor Management', '/admin/vendors', 'Manage vendor information'],
  ['Cash Flow', '/admin/cash', 'Track cash and account balances'],
  ['Loan Management', '/admin/loans', 'Manage borrowed funds'],
  ['App Settings', '/admin/settings', 'Configure application settings'],
];

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/admin/home']}>
      <Routes>
        <Route path="/admin/home" element={<AdminHomeScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const logoutButton = () => screen.getByRole('button', { name: 'Logout' });

function fireAuthEvent(event: string) {
  act(() => auth.listener?.(event));
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.listener = null;
  mocked.logout.mockResolvedValue(undefined);
});

describe('AdminHomeScreen', () => {
  describe('layout', () => {
    it('greets the administrator on the Admin Dashboard', () => {
      renderHome();

      expect(screen.getByRole('heading', { level: 1, name: 'Admin Dashboard' })).toBeInTheDocument();
      expect(screen.getByText('Welcome! Select a module to continue')).toBeInTheDocument();
    });

    it('offers all twelve modules, in order', () => {
      renderHome();

      const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
      expect(titles).toEqual(MODULES.map(([title]) => title));
    });

    it.each(MODULES)('describes the %s card', (title, _path, description) => {
      renderHome();

      expect(screen.getByRole('button', { name: new RegExp(title) })).toHaveTextContent(description);
    });

    it('shows the branch switcher, the password and logout buttons, and the footer credit', () => {
      renderHome();

      expect(screen.getByText('branch switcher')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Password' })).toBeInTheDocument();
      expect(logoutButton()).toBeInTheDocument();
      expect(screen.getByText(/Powered by/)).toHaveTextContent('Powered by GG-Tech');
    });

    it('shows no popup when it first opens', () => {
      renderHome();

      expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument();
    });

    it('gives the icon-only buttons accessible names, for screens where their text is hidden', () => {
      renderHome();

      expect(screen.getByRole('button', { name: 'Logout' })).toHaveAttribute('aria-label', 'Logout');
      expect(screen.getByRole('button', { name: 'Password' })).toHaveAttribute('aria-label', 'Password');
    });
  });

  describe('navigation', () => {
    it.each(MODULES)('opens %s at %s', async (title, path) => {
      const user = userEvent.setup();
      renderHome();

      await user.click(screen.getByRole('button', { name: new RegExp(title) }));

      expect(screen.getByTestId('path').textContent).toBe(path);
    });

    it('opens the change-password screen from the Password button', async () => {
      const user = userEvent.setup();
      renderHome();

      await user.click(screen.getByRole('button', { name: 'Password' }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/change-password');
    });

    it('stays on the dashboard until something is chosen', () => {
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

    it('keeps the dashboard behind the popup until OK, then goes to the admin login', async () => {
      const user = userEvent.setup();
      renderHome();
      await user.click(logoutButton());
      await screen.findByText('Logout Successful');
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/login');
    });

    it('can be done from the keyboard', async () => {
      const user = userEvent.setup();
      renderHome();

      logoutButton().focus();
      await user.keyboard('{Enter}');

      expect(await screen.findByText('Logout Successful')).toBeInTheDocument();
    });

    it('shows an error popup when signing out fails, and stays on the dashboard after OK', async () => {
      const user = userEvent.setup();
      mocked.logout.mockRejectedValue(new Error('network down'));
      renderHome();

      await user.click(logoutButton());

      expect(await screen.findByText('Something Went Wrong')).toBeInTheDocument();
      expect(screen.getByText('Unable to logout. Please try again.')).toBeInTheDocument();
      expect(screen.queryByText('Logout Successful')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(screen.queryByText('Something Went Wrong')).not.toBeInTheDocument();
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    });

    it('can try again after a failure', async () => {
      const user = userEvent.setup();
      mocked.logout.mockRejectedValueOnce(new Error('network down'));
      renderHome();
      await user.click(logoutButton());
      await user.click(await screen.findByRole('button', { name: 'OK' }));

      await user.click(logoutButton());

      expect(await screen.findByText('Logout Successful')).toBeInTheDocument();
      expect(mocked.logout).toHaveBeenCalledTimes(2);
    });

    it('does not sign out again when the confirmation is acknowledged', async () => {
      const user = userEvent.setup();
      renderHome();
      await user.click(logoutButton());
      await screen.findByText('Logout Successful');

      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(mocked.logout).toHaveBeenCalledTimes(1);
    });

    it('is not triggered by merely using the dashboard', async () => {
      const user = userEvent.setup();
      renderHome();

      await user.click(screen.getByRole('button', { name: /Metrics/ }));

      expect(mocked.logout).not.toHaveBeenCalled();
    });
  });

  describe('session ended elsewhere', () => {
    it('listens for auth events and stops listening when it closes', () => {
      const { unmount } = renderHome();

      expect(auth.listener).toBeTypeOf('function');
      unmount();
      expect(auth.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('warns when the session ends without the administrator logging out, and OK goes to login', async () => {
      const user = userEvent.setup();
      renderHome();

      fireAuthEvent('SIGNED_OUT');

      expect(screen.getByText('Session Expired')).toBeInTheDocument();
      expect(screen.getByText('Your session has expired. Please login again.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(screen.getByTestId('path').textContent).toBe('/admin/login');
    });

    it.each(['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'INITIAL_SESSION'])('does not warn on a %s event', (event) => {
      renderHome();

      fireAuthEvent(event);

      expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();
    });

    it('does not call a deliberate logout a session expiry', async () => {
      const user = userEvent.setup();
      mocked.logout.mockImplementation(async () => {
        fireAuthEvent('SIGNED_OUT');
      });
      renderHome();

      await user.click(logoutButton());

      expect(await screen.findByText('Logout Successful')).toBeInTheDocument();
      expect(screen.queryByText('Session Expired')).not.toBeInTheDocument();
    });
  });
});
