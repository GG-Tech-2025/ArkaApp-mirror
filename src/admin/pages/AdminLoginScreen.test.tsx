import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AdminLoginScreen } from './AdminLoginScreen';
import * as middleware from '../../services/middleware.service';

vi.mock('../../services/middleware.service', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getUserProfile: vi.fn(),
  validateSession: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const EMAIL = 'admin@arka.test';
const PASSWORD = 'correct-horse';

const INVALID_EMAIL_ERROR = 'Please enter a valid email address';
const BAD_CREDENTIALS_ERROR = 'Incorrect credentials. Please check your email and password.';
const NOT_AUTHORIZED_ERROR = 'You are not authorized to access the Admin App.';

const ADMIN = { id: 'user-1', role: 'ADMIN', is_super_admin: false, organization_id: 'org-1' };
const SUPER_ADMIN = { id: 'user-1', role: 'ADMIN', is_super_admin: true, organization_id: null };
const EMPLOYEE = { id: 'user-1', role: 'EMPLOYEE', is_super_admin: false, organization_id: 'org-1' };

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/admin/login']}>
      <Routes>
        <Route path="/admin/login" element={<AdminLoginScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const emailField = () => screen.getByLabelText('Email Address');
const passwordField = () => screen.getByLabelText('Password');
const loginButton = () => screen.getByRole('button', { name: 'Login' });

async function fill(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  await user.type(emailField(), email);
  await user.type(passwordField(), password);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.validateSession.mockResolvedValue(null);
  mocked.logout.mockResolvedValue(undefined);
  mocked.login.mockResolvedValue({ user: { id: 'user-1' } } as never);
  mocked.getUserProfile.mockResolvedValue(ADMIN as never);
});

describe('AdminLoginScreen', () => {
  describe('layout', () => {
    it('shows the heading, both labelled fields and a Login button', () => {
      renderLogin();

      expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeInTheDocument();
      expect(screen.getByText('Enter your credentials to continue')).toBeInTheDocument();
      expect(emailField()).toHaveAttribute('type', 'email');
      expect(emailField()).toHaveAttribute('placeholder', 'Enter admin email');
      expect(passwordField()).toHaveAttribute('type', 'password');
      expect(passwordField()).toHaveAttribute('placeholder', 'Enter your password');
      expect(loginButton()).toBeInTheDocument();
    });

    it('starts empty with no error, and shows the footer credit', () => {
      renderLogin();

      expect(emailField()).toHaveValue('');
      expect(passwordField()).toHaveValue('');
      expect(screen.queryByText(INVALID_EMAIL_ERROR)).not.toBeInTheDocument();
      expect(screen.getByText(/Powered by/)).toHaveTextContent('Powered by GG-Tech');
    });

    it('goes back to the app selection screen from the back button', async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.click(screen.getByRole('button', { name: /Back to App Selection/ }));

      expect(screen.getByTestId('path').textContent).toBe('/');
    });
  });

  describe('login button state', () => {
    it('is disabled while both fields are empty', () => {
      renderLogin();

      expect(loginButton()).toBeDisabled();
    });

    it('stays disabled with only an email, or only a password', async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.type(emailField(), EMAIL);
      expect(loginButton()).toBeDisabled();

      await user.clear(emailField());
      await user.type(passwordField(), PASSWORD);
      expect(loginButton()).toBeDisabled();
    });

    it('is enabled once both fields have any text, even random text', async () => {
      const user = userEvent.setup();
      renderLogin();

      await fill(user, 'zzzz', 'qqqq');

      expect(loginButton()).toBeEnabled();
    });

    it('is disabled again when a field is cleared', async () => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, 'zzzz', 'qqqq');

      await user.clear(passwordField());

      expect(loginButton()).toBeDisabled();
    });
  });

  describe('email validation', () => {
    it('rejects random text as an email address without calling the server', async () => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, 'random text', 'whatever');

      await user.click(loginButton());

      expect(await screen.findByText(INVALID_EMAIL_ERROR)).toBeInTheDocument();
      expect(mocked.login).not.toHaveBeenCalled();
    });

    it.each([
      ['no @ sign', 'adminarka.test'],
      ['no domain dot', 'admin@arka'],
      ['no local part', '@arka.test'],
      ['no domain', 'admin@'],
      ['two @ signs', 'a@b@arka.test'],
      ['inner space', 'ad min@arka.test'],
    ])('rejects an email with %s', async (_label, email) => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, email, PASSWORD);

      await user.click(loginButton());

      expect(await screen.findByText(INVALID_EMAIL_ERROR)).toBeInTheDocument();
      expect(mocked.login).not.toHaveBeenCalled();
    });

    it.each(['admin@arka.test', 'first.last+tag@sub.arka.co.in'])('accepts %s as well-formed', async (email) => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, email, PASSWORD);

      await user.click(loginButton());

      await waitFor(() => expect(mocked.login).toHaveBeenCalledWith(email, PASSWORD));
    });

    it('signs in with the trimmed email when it has surrounding spaces (the browser trims them)', async () => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, ' admin@arka.test ', PASSWORD);

      await user.click(loginButton());

      await waitFor(() => expect(mocked.login).toHaveBeenCalledWith(EMAIL, PASSWORD));
    });
  });

  describe('wrong credentials', () => {
    it('shows an incorrect-credentials error for a valid email with a wrong password', async () => {
      const user = userEvent.setup();
      mocked.login.mockRejectedValue(new Error('Invalid login credentials'));
      renderLogin();
      await fill(user, EMAIL, 'wrong-password');

      await user.click(loginButton());

      expect(await screen.findByText(BAD_CREDENTIALS_ERROR)).toBeInTheDocument();
      expect(mocked.getUserProfile).not.toHaveBeenCalled();
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    });

    it('shows the same message for a network failure rather than leaking details', async () => {
      const user = userEvent.setup();
      mocked.login.mockRejectedValue(new TypeError('Failed to fetch'));
      renderLogin();
      await fill(user, EMAIL, PASSWORD);

      await user.click(loginButton());

      expect(await screen.findByText(BAD_CREDENTIALS_ERROR)).toBeInTheDocument();
      expect(screen.queryByText(/fetch/i)).not.toBeInTheDocument();
    });

    it('shows the same message when the profile lookup fails after sign-in', async () => {
      const user = userEvent.setup();
      mocked.getUserProfile.mockRejectedValue(new Error('no profile'));
      renderLogin();
      await fill(user, EMAIL, PASSWORD);

      await user.click(loginButton());

      expect(await screen.findByText(BAD_CREDENTIALS_ERROR)).toBeInTheDocument();
    });
  });

  describe('clearing errors', () => {
    it.each([
      ['email', () => emailField()],
      ['password', () => passwordField()],
    ])('clears an invalid-email error when the %s changes', async (_label, field) => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, 'random text', 'whatever');
      await user.click(loginButton());
      await screen.findByText(INVALID_EMAIL_ERROR);

      await user.type(field(), 'x');

      expect(screen.queryByText(INVALID_EMAIL_ERROR)).not.toBeInTheDocument();
    });

    it.each([
      ['email', () => emailField()],
      ['password', () => passwordField()],
    ])('clears an incorrect-credentials error when the %s changes', async (_label, field) => {
      const user = userEvent.setup();
      mocked.login.mockRejectedValue(new Error('Invalid login credentials'));
      renderLogin();
      await fill(user, EMAIL, 'wrong');
      await user.click(loginButton());
      await screen.findByText(BAD_CREDENTIALS_ERROR);

      await user.type(field(), 'x');

      expect(screen.queryByText(BAD_CREDENTIALS_ERROR)).not.toBeInTheDocument();
    });

    it('brings the error back if the same bad input is submitted again', async () => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, 'random text', 'whatever');
      await user.click(loginButton());
      await screen.findByText(INVALID_EMAIL_ERROR);
      await user.type(passwordField(), '1');

      await user.click(loginButton());

      expect(await screen.findByText(INVALID_EMAIL_ERROR)).toBeInTheDocument();
    });
  });

  describe('successful login', () => {
    it('signs in an administrator and opens the admin dashboard', async () => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, EMAIL, PASSWORD);

      await user.click(loginButton());

      await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/admin/home'));
      expect(mocked.login).toHaveBeenCalledTimes(1);
      expect(mocked.login).toHaveBeenCalledWith(EMAIL, PASSWORD);
      expect(mocked.getUserProfile).toHaveBeenCalledWith('user-1');
      expect(mocked.logout).not.toHaveBeenCalled();
    });

    it('sends a platform super-admin (no organization) to the platform screens instead', async () => {
      const user = userEvent.setup();
      mocked.getUserProfile.mockResolvedValue(SUPER_ADMIN as never);
      renderLogin();
      await fill(user, EMAIL, PASSWORD);

      await user.click(loginButton());

      await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/platform'));
    });

    it('sends a super-admin who belongs to an organization to the admin dashboard', async () => {
      const user = userEvent.setup();
      mocked.getUserProfile.mockResolvedValue({ ...SUPER_ADMIN, organization_id: 'org-1' } as never);
      renderLogin();
      await fill(user, EMAIL, PASSWORD);

      await user.click(loginButton());

      await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/admin/home'));
    });

    it.each([
      ['email field', () => emailField()],
      ['password field', () => passwordField()],
    ])('submits when Enter is pressed in the %s', async (_label, field) => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, EMAIL, PASSWORD);

      await user.type(field(), '{Enter}');

      await waitFor(() => expect(mocked.login).toHaveBeenCalledWith(EMAIL, PASSWORD));
      await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/admin/home'));
    });

    it('still validates the email when Enter is pressed with the password empty', async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.type(emailField(), 'random text{Enter}');

      expect(await screen.findByText(INVALID_EMAIL_ERROR)).toBeInTheDocument();
      expect(mocked.login).not.toHaveBeenCalled();
    });
  });

  describe('role checks', () => {
    it('refuses an employee account, signs it out and stays on the login screen', async () => {
      const user = userEvent.setup();
      mocked.getUserProfile.mockResolvedValue(EMPLOYEE as never);
      renderLogin();
      await fill(user, EMAIL, PASSWORD);

      await user.click(loginButton());

      expect(await screen.findByText(NOT_AUTHORIZED_ERROR)).toBeInTheDocument();
      expect(mocked.logout).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    });

    it('clears the not-authorized error on the next keystroke', async () => {
      const user = userEvent.setup();
      mocked.getUserProfile.mockResolvedValue(EMPLOYEE as never);
      renderLogin();
      await fill(user, EMAIL, PASSWORD);
      await user.click(loginButton());
      await screen.findByText(NOT_AUTHORIZED_ERROR);

      await user.type(emailField(), 'x');

      expect(screen.queryByText(NOT_AUTHORIZED_ERROR)).not.toBeInTheDocument();
    });
  });

  describe('existing session on arrival', () => {
    beforeEach(() => {
      mocked.validateSession.mockResolvedValue({ id: 'user-1' } as never);
    });

    it('sends a signed-in administrator straight to the dashboard', async () => {
      renderLogin();

      await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/admin/home'));
    });

    it('sends a signed-in platform super-admin to the platform screens', async () => {
      mocked.getUserProfile.mockResolvedValue(SUPER_ADMIN as never);
      renderLogin();

      await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/platform'));
    });

    it('signs out a signed-in employee and keeps the login form', async () => {
      mocked.getUserProfile.mockResolvedValue(EMPLOYEE as never);
      renderLogin();

      await waitFor(() => expect(mocked.logout).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeInTheDocument();
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    });

    it('signs out when the profile cannot be loaded', async () => {
      mocked.getUserProfile.mockRejectedValue(new Error('boom'));
      renderLogin();

      await waitFor(() => expect(mocked.logout).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('heading', { name: 'Admin Login' })).toBeInTheDocument();
    });

    it('shows the form with no lookups when nobody is signed in', async () => {
      mocked.validateSession.mockResolvedValue(null);
      renderLogin();

      await waitFor(() => expect(mocked.validateSession).toHaveBeenCalled());
      expect(mocked.getUserProfile).not.toHaveBeenCalled();
      expect(mocked.logout).not.toHaveBeenCalled();
    });
  });
});
