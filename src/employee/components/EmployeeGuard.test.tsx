import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { EmployeeGuard } from './EmployeeGuard';
import * as middleware from '../../services/middleware.service';

const tenant = vi.hoisted(() => ({
  value: { status: 'ready', activeBranchId: 'branch-1', epoch: 0 } as Record<string, unknown>,
}));

vi.mock('../../context/TenantContext', () => ({ useTenant: () => tenant.value }));

vi.mock('../../services/middleware.service', () => ({
  validateSession: vi.fn(),
  getUserProfile: vi.fn(),
  logout: vi.fn(),
  checkEmployeeIsActive: vi.fn(),
}));

const mocked = vi.mocked(middleware);

function Home() {
  const navigate = useNavigate();
  return (
    <div>
      <h1>Home</h1>
      <button onClick={() => navigate('/employee/orders')}>Go to orders</button>
    </div>
  );
}

function LoginProbe() {
  const { pathname, state } = useLocation();
  return (
    <div>
      <h1>Login</h1>
      <span data-testid="path">{pathname}</span>
      <span data-testid="blocked">{String((state as { blocked?: boolean } | null)?.blocked === true)}</span>
    </div>
  );
}

function app(initialPath: string) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/employee/login" element={<LoginProbe />} />
        <Route element={<EmployeeGuard />}>
          <Route path="/employee/home" element={<Home />} />
          <Route path="/employee/orders" element={<h1>Orders</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function setTenant(status: string) {
  tenant.value = { status, activeBranchId: 'branch-1', epoch: 0 };
}

beforeEach(() => {
  vi.resetAllMocks();
  setTenant('ready');
  mocked.validateSession.mockResolvedValue({ id: 'user-1' } as never);
  mocked.getUserProfile.mockResolvedValue({ id: 'user-1', role: 'EMPLOYEE' } as never);
  mocked.checkEmployeeIsActive.mockResolvedValue(true);
  mocked.logout.mockResolvedValue(undefined);
});

describe('EmployeeGuard', () => {
  describe('letting people in', () => {
    it('shows the screen to an active employee', async () => {
      render(app('/employee/home'));

      expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    });

    it('shows a verifying message while the session is being checked', () => {
      render(app('/employee/home'));

      expect(screen.getByText('Verifying session...')).toBeInTheDocument();
    });

    it('waits for the branch to be known before judging whether the employee is active', async () => {
      setTenant('loading');
      render(app('/employee/home'));

      await act(async () => {});

      expect(mocked.checkEmployeeIsActive).not.toHaveBeenCalled();
      expect(mocked.validateSession).not.toHaveBeenCalled();
      expect(screen.getByText('Verifying session...')).toBeInTheDocument();
    });
  });

  describe('keeping people out', () => {
    it('sends a visitor with no session to the login screen', async () => {
      mocked.validateSession.mockResolvedValue(null);
      render(app('/employee/home'));

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
      expect(screen.getByTestId('blocked')).toHaveTextContent('false');
    });

    it('signs out and redirects a signed-in non-employee', async () => {
      mocked.getUserProfile.mockResolvedValue({ id: 'user-1', role: 'ADMIN' } as never);
      render(app('/employee/home'));

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
      expect(mocked.logout).toHaveBeenCalledTimes(1);
    });

    it('signs out a deactivated employee and sends them to login marked as blocked', async () => {
      mocked.checkEmployeeIsActive.mockResolvedValue(false);
      render(app('/employee/home'));

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
      expect(screen.getByTestId('blocked')).toHaveTextContent('true');
      expect(mocked.logout).toHaveBeenCalledTimes(1);
    });

    it('redirects when the profile cannot be loaded', async () => {
      mocked.getUserProfile.mockRejectedValue(new Error('boom'));
      render(app('/employee/home'));

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
    });
  });

  describe('when the session ends mid-use', () => {
    async function endSession(view: ReturnType<typeof render>, path: string) {
      mocked.validateSession.mockResolvedValue(null);
      setTenant('signed-out');
      view.rerender(app(path));
    }

    it('keeps the Home screen on show so it can explain what happened', async () => {
      const view = render(app('/employee/home'));
      await screen.findByRole('heading', { name: 'Home' });

      await endSession(view, '/employee/home');

      await waitFor(() => expect(mocked.validateSession).toHaveBeenCalledTimes(2));
      expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Login' })).not.toBeInTheDocument();
    });

    it('sends the employee to login straight away from any other screen', async () => {
      const view = render(app('/employee/orders'));
      await screen.findByRole('heading', { name: 'Orders' });

      await endSession(view, '/employee/orders');

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
    });

    it('sends the employee to login once they leave Home after the session ended', async () => {
      const user = userEvent.setup();
      const view = render(app('/employee/home'));
      await screen.findByRole('heading', { name: 'Home' });
      await endSession(view, '/employee/home');
      await waitFor(() => expect(mocked.validateSession).toHaveBeenCalledTimes(2));

      await user.click(screen.getByRole('button', { name: 'Go to orders' }));

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Orders' })).not.toBeInTheDocument();
    });

    it('does not extend this courtesy to someone who was never signed in', async () => {
      mocked.validateSession.mockResolvedValue(null);
      render(app('/employee/home'));

      expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Home' })).not.toBeInTheDocument();
    });
  });
});
