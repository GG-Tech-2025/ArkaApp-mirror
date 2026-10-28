import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AdminGuard } from './AdminGuard';
import * as middleware from '../../services/middleware.service';

const tenant = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
  reload: vi.fn(),
}));

vi.mock('../../context/TenantContext', () => ({ useTenant: () => tenant.value }));
vi.mock('./RenewalBanner', () => ({ RenewalBanner: () => <div>renewal banner</div> }));

vi.mock('../../services/middleware.service', () => ({
  validateSession: vi.fn(),
  getUserProfile: vi.fn(),
  logout: vi.fn(),
  mustChangePassword: (user: { app_metadata?: { must_change_password?: boolean } } | null) =>
    user?.app_metadata?.must_change_password === true,
}));

const mocked = vi.mocked(middleware);

function Probe({ label }: { label: string }) {
  return (
    <div>
      <h1>{label}</h1>
      <span data-testid="path">{useLocation().pathname}</span>
    </div>
  );
}

function app() {
  return (
    <MemoryRouter initialEntries={['/admin/home']}>
      <Routes>
        <Route path="/admin/login" element={<Probe label="Login" />} />
        <Route path="/admin/change-password" element={<Probe label="Change password" />} />
        <Route element={<AdminGuard />}>
          <Route path="/admin/home" element={<Probe label="Home" />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function setTenant(overrides: Record<string, unknown>) {
  tenant.value = {
    status: 'ready',
    organizationName: 'Bricky box',
    organizationStatus: 'ACTIVE',
    activeBranch: { id: 'b1', name: 'T.gode' },
    epoch: 0,
    reload: tenant.reload,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  tenant.reload.mockResolvedValue(undefined);
  setTenant({});
  mocked.validateSession.mockResolvedValue({ id: 'user-1', app_metadata: {} } as never);
  mocked.getUserProfile.mockResolvedValue({ id: 'user-1', role: 'ADMIN' } as never);
  mocked.logout.mockResolvedValue(undefined);
});

describe('AdminGuard', () => {
  describe('letting an administrator in', () => {
    it('shows the screen, with the renewal banner above it', async () => {
      render(app());

      expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
      expect(screen.getByText('renewal banner')).toBeInTheDocument();
    });

    it('shows a verifying message while the session is being checked', () => {
      render(app());

      expect(screen.getByText('Verifying session...')).toBeInTheDocument();
    });

    it('keeps showing the verifying message while the branch is still loading', async () => {
      setTenant({ status: 'loading' });
      render(app());

      await waitFor(() => expect(mocked.getUserProfile).toHaveBeenCalled());
      expect(screen.getByText('Verifying session...')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Home' })).not.toBeInTheDocument();
    });
  });

  describe('keeping people out', () => {
    it('sends a visitor with no session to the admin login', async () => {
      mocked.validateSession.mockResolvedValue(null);
      render(app());

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
    });

    it('signs out and redirects a signed-in employee', async () => {
      mocked.getUserProfile.mockResolvedValue({ id: 'user-1', role: 'EMPLOYEE' } as never);
      render(app());

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
      expect(mocked.logout).toHaveBeenCalledTimes(1);
    });

    it('redirects when the profile cannot be loaded', async () => {
      mocked.getUserProfile.mockRejectedValue(new Error('boom'));
      render(app());

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
    });

    it('sends an administrator still on the temporary password to choose their own', async () => {
      mocked.validateSession.mockResolvedValue({ id: 'user-1', app_metadata: { must_change_password: true } } as never);
      render(app());

      expect(await screen.findByRole('heading', { name: 'Change password' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Home' })).not.toBeInTheDocument();
    });
  });

  describe('when the branch or organization cannot be used', () => {
    it('explains a paused branch, and can check again or sign out', async () => {
      const user = userEvent.setup();
      setTenant({ status: 'paused', organizationStatus: 'ACTIVE' });
      render(app());

      expect(await screen.findByRole('heading', { name: 'This branch is paused' })).toBeInTheDocument();
      expect(screen.getByText('T.gode · Bricky box')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Check again' }));
      expect(tenant.reload).toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Sign out' }));
      expect(mocked.logout).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
    });

    it('explains a paused organization', async () => {
      setTenant({ status: 'paused', organizationStatus: 'SUSPENDED' });
      render(app());

      expect(await screen.findByRole('heading', { name: 'Your account is paused' })).toBeInTheDocument();
      expect(screen.getByText('Bricky box')).toBeInTheDocument();
    });

    it('explains an account with no branch, and signs out', async () => {
      const user = userEvent.setup();
      setTenant({ status: 'no-access', activeBranch: null });
      render(app());

      expect(await screen.findByRole('heading', { name: 'No branch access' })).toBeInTheDocument();
      expect(screen.getByText(/Your account at Bricky box/)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Sign out' }));
      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
    });

    it('explains a branch that failed to load, and can try again', async () => {
      const user = userEvent.setup();
      setTenant({ status: 'error' });
      render(app());

      expect(await screen.findByRole('heading', { name: "Couldn't load your branch" })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(tenant.reload).toHaveBeenCalled();
    });

    it('still signs the user out and goes to login if the sign-out request fails', async () => {
      const user = userEvent.setup();
      mocked.logout.mockRejectedValue(new Error('down'));
      setTenant({ status: 'no-access', activeBranch: null });
      render(app());
      await screen.findByRole('heading', { name: 'No branch access' });

      await user.click(screen.getByRole('button', { name: 'Sign out' }));

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
    });
  });

  describe('after the screen has been shown', () => {
    it('keeps the screen on show if the session ends, so its popups can appear', async () => {
      const view = render(app());
      await screen.findByRole('heading', { name: 'Home' });

      setTenant({ status: 'signed-out' });
      view.rerender(app());

      expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
      expect(screen.queryByText('Verifying session...')).not.toBeInTheDocument();
    });

    it('asks the tenant to reload when a valid session never got its branch', async () => {
      setTenant({ status: 'signed-out' });
      render(app());

      await waitFor(() => expect(tenant.reload).toHaveBeenCalled());
    });
  });
});
