import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LoginScreen } from './LoginScreen';
import * as middleware from '../../services/middleware.service';

vi.mock('../../services/middleware.service', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getUserProfile: vi.fn(),
  validateSession: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const EMAIL = 'worker@arka.test';
const PASSWORD = 'correct-horse';

const INVALID_EMAIL_ERROR = 'Please enter a valid email address';
const BAD_CREDENTIALS_ERROR = 'Incorrect credentials. Please check your email and password.';
const NOT_AUTHORIZED_ERROR = 'You are not authorized to access the Employee App.';
const DEACTIVATED_ERROR = 'Your account has been deactivated. Please contact your administrator.';

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderLogin(state?: { blocked?: boolean }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/employee/login', state }]}>
      <Routes>
        <Route path="/employee/login" element={<LoginScreen />} />
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
  mocked.getUserProfile.mockResolvedValue({ id: 'user-1', role: 'EMPLOYEE' } as never);
});

describe('Employee LoginScreen', () => {
  describe('layout', () => {
    it('shows the heading, both labelled fields and a Login button', () => {
      renderLogin();

      expect(screen.getByRole('heading', { name: 'Employee Login' })).toBeInTheDocument();
      expect(emailField()).toHaveAttribute('type', 'email');
      expect(emailField()).toHaveAttribute('placeholder', 'Enter your email address');
      expect(passwordField()).toHaveAttribute('type', 'password');
      expect(passwordField()).toHaveAttribute('placeholder', 'Enter your password');
      expect(loginButton()).toBeInTheDocument();
    });

    it('starts with empty fields and no error', () => {
      renderLogin();

      expect(emailField()).toHaveValue('');
      expect(passwordField()).toHaveValue('');
      expect(screen.queryByText(INVALID_EMAIL_ERROR)).not.toBeInTheDocument();
      expect(screen.queryByText(BAD_CREDENTIALS_ERROR)).not.toBeInTheDocument();
    });

    it('goes back to the app selection screen from the back button', async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.click(screen.getByRole('button', { name: /Back to App Selection/ }));

      expect(screen.getByTestId('path')).toHaveTextContent('/');
      expect(screen.getByTestId('path').textContent).toBe('/');
    });
  });

  describe('login button state', () => {
    it('is disabled while both fields are empty', () => {
      renderLogin();

      expect(loginButton()).toBeDisabled();
    });

    it('stays disabled with only an email', async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.type(emailField(), EMAIL);

      expect(loginButton()).toBeDisabled();
    });

    it('stays disabled with only a password', async () => {
      const user = userEvent.setup();
      renderLogin();

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

    it('does not attempt a login when clicked while disabled', async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.click(loginButton());

      expect(mocked.login).not.toHaveBeenCalled();
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
      ['no @ sign', 'workerarka.test'],
      ['no domain dot', 'worker@arka'],
      ['no local part', '@arka.test'],
      ['no domain', 'worker@'],
      ['two @ signs', 'a@b@arka.test'],
      ['inner space', 'wor ker@arka.test'],
    ])('rejects an email with %s', async (_label, email) => {
      const user = userEvent.setup();
      renderLogin();
      await user.type(emailField(), email);
      await user.type(passwordField(), PASSWORD);

      await user.click(loginButton());

      expect(await screen.findByText(INVALID_EMAIL_ERROR)).toBeInTheDocument();
      expect(mocked.login).not.toHaveBeenCalled();
    });

    it.each(['worker@arka.test', 'first.last+tag@sub.arka.co.in', 'A@B.CO'])(
      'accepts %s as well-formed',
      async (email) => {
        const user = userEvent.setup();
        renderLogin();
        await fill(user, email, PASSWORD);

        await user.click(loginButton());

        await waitFor(() => expect(mocked.login).toHaveBeenCalledWith(email, PASSWORD));
        expect(screen.queryByText(INVALID_EMAIL_ERROR)).not.toBeInTheDocument();
      },
    );
  });

  describe('surrounding whitespace', () => {
    // An <input type="email"> strips leading and trailing spaces from its value, so
    // the screen only ever sees the trimmed address.
    it.each([
      ['leading', ' worker@arka.test'],
      ['trailing', 'worker@arka.test '],
    ])('signs in with the trimmed email when it has %s spaces', async (_label, typed) => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, typed, PASSWORD);

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
      expect(mocked.login).toHaveBeenCalledWith(EMAIL, 'wrong-password');
    });

    it('stays on the login screen and does not look up a profile', async () => {
      const user = userEvent.setup();
      mocked.login.mockRejectedValue(new Error('Invalid login credentials'));
      renderLogin();
      await fill(user, EMAIL, 'wrong-password');

      await user.click(loginButton());

      await screen.findByText(BAD_CREDENTIALS_ERROR);
      expect(mocked.getUserProfile).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'Employee Login' })).toBeInTheDocument();
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
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    });
  });

  describe('clearing errors', () => {
    it('clears the invalid-email error when the email changes', async () => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, 'random text', 'whatever');
      await user.click(loginButton());
      await screen.findByText(INVALID_EMAIL_ERROR);

      await user.type(emailField(), 'x');

      expect(screen.queryByText(INVALID_EMAIL_ERROR)).not.toBeInTheDocument();
    });

    it('clears the invalid-email error when the password changes', async () => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, 'random text', 'whatever');
      await user.click(loginButton());
      await screen.findByText(INVALID_EMAIL_ERROR);

      await user.type(passwordField(), 'x');

      expect(screen.queryByText(INVALID_EMAIL_ERROR)).not.toBeInTheDocument();
    });

    it('clears the incorrect-credentials error when the email changes', async () => {
      const user = userEvent.setup();
      mocked.login.mockRejectedValue(new Error('Invalid login credentials'));
      renderLogin();
      await fill(user, EMAIL, 'wrong');
      await user.click(loginButton());
      await screen.findByText(BAD_CREDENTIALS_ERROR);

      await user.type(emailField(), 'm');

      expect(screen.queryByText(BAD_CREDENTIALS_ERROR)).not.toBeInTheDocument();
    });

    it('clears the incorrect-credentials error when the password changes', async () => {
      const user = userEvent.setup();
      mocked.login.mockRejectedValue(new Error('Invalid login credentials'));
      renderLogin();
      await fill(user, EMAIL, 'wrong');
      await user.click(loginButton());
      await screen.findByText(BAD_CREDENTIALS_ERROR);

      await user.type(passwordField(), 'x');

      expect(screen.queryByText(BAD_CREDENTIALS_ERROR)).not.toBeInTheDocument();
    });

    it('clears the error when a field is emptied', async () => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, 'random text', 'whatever');
      await user.click(loginButton());
      await screen.findByText(INVALID_EMAIL_ERROR);

      await user.clear(emailField());

      expect(screen.queryByText(INVALID_EMAIL_ERROR)).not.toBeInTheDocument();
    });

    it('brings the error back if the user submits the same bad input again', async () => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, 'random text', 'whatever');
      await user.click(loginButton());
      await screen.findByText(INVALID_EMAIL_ERROR);
      await user.type(passwordField(), '1');
      expect(screen.queryByText(INVALID_EMAIL_ERROR)).not.toBeInTheDocument();

      await user.click(loginButton());

      expect(await screen.findByText(INVALID_EMAIL_ERROR)).toBeInTheDocument();
    });
  });

  describe('successful login', () => {
    it('signs in with the typed credentials and opens the employee home screen', async () => {
      const user = userEvent.setup();
      renderLogin();
      await fill(user, EMAIL, PASSWORD);

      await user.click(loginButton());

      await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/employee/home'));
      expect(mocked.login).toHaveBeenCalledTimes(1);
      expect(mocked.login).toHaveBeenCalledWith(EMAIL, PASSWORD);
      expect(mocked.getUserProfile).toHaveBeenCalledWith('user-1');
      expect(mocked.logout).not.toHaveBeenCalled();
    });

    it('replaces the login screen in history so Back does not return to it', async () => {
      const user = userEvent.setup();
      const { container } = renderLogin();
      await fill(user, EMAIL, PASSWORD);

      await user.click(loginButton());

      await waitFor(() => expect(screen.getByTestId('path')).toBeInTheDocument());
      expect(container).not.toHaveTextContent('Employee Login');
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
      await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/employee/home'));
    });

    it('still validates the email when Enter is pressed with the password empty', async () => {
      const user = userEvent.setup();
      renderLogin();
      await user.type(emailField(), 'random text{Enter}');

      // Enter bypasses the disabled button, so the email check is what stops it.
      expect(await screen.findByText(INVALID_EMAIL_ERROR)).toBeInTheDocument();
      expect(mocked.login).not.toHaveBeenCalled();
    });
  });

  describe('role checks', () => {
    it('refuses an ADMIN profile, signs it out and stays on the login screen', async () => {
      const user = userEvent.setup();
      mocked.getUserProfile.mockResolvedValue({ id: 'user-1', role: 'ADMIN' } as never);
      renderLogin();
      await fill(user, EMAIL, PASSWORD);

      await user.click(loginButton());

      expect(await screen.findByText(NOT_AUTHORIZED_ERROR)).toBeInTheDocument();
      expect(mocked.logout).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    });

    it('clears the not-authorized error on the next keystroke', async () => {
      const user = userEvent.setup();
      mocked.getUserProfile.mockResolvedValue({ id: 'user-1', role: 'ADMIN' } as never);
      renderLogin();
      await fill(user, EMAIL, PASSWORD);
      await user.click(loginButton());
      await screen.findByText(NOT_AUTHORIZED_ERROR);

      await user.type(emailField(), 'x');

      expect(screen.queryByText(NOT_AUTHORIZED_ERROR)).not.toBeInTheDocument();
    });
  });

  describe('deactivated employee redirect', () => {
    it('shows the deactivated message when sent back by the guard', () => {
      renderLogin({ blocked: true });

      expect(screen.getByText(DEACTIVATED_ERROR)).toBeInTheDocument();
    });

    it('does not show it on a normal visit', () => {
      renderLogin();

      expect(screen.queryByText(DEACTIVATED_ERROR)).not.toBeInTheDocument();
    });

    it('does not show it when the redirect state is not exactly blocked: true', () => {
      renderLogin({ blocked: false });

      expect(screen.queryByText(DEACTIVATED_ERROR)).not.toBeInTheDocument();
    });

    it('clears the message once the user starts typing', async () => {
      const user = userEvent.setup();
      renderLogin({ blocked: true });

      await user.type(emailField(), 'a');

      expect(screen.queryByText(DEACTIVATED_ERROR)).not.toBeInTheDocument();
    });
  });

  describe('existing session on arrival', () => {
    it('sends a signed-in employee straight to the home screen', async () => {
      mocked.validateSession.mockResolvedValue({ id: 'user-1' } as never);
      renderLogin();

      await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/employee/home'));
      expect(mocked.getUserProfile).toHaveBeenCalledWith('user-1');
    });

    it('signs out a signed-in non-employee and keeps the login form', async () => {
      mocked.validateSession.mockResolvedValue({ id: 'user-1' } as never);
      mocked.getUserProfile.mockResolvedValue({ id: 'user-1', role: 'ADMIN' } as never);
      renderLogin();

      await waitFor(() => expect(mocked.logout).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('heading', { name: 'Employee Login' })).toBeInTheDocument();
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    });

    it('signs out when the profile cannot be loaded', async () => {
      mocked.validateSession.mockResolvedValue({ id: 'user-1' } as never);
      mocked.getUserProfile.mockRejectedValue(new Error('boom'));
      renderLogin();

      await waitFor(() => expect(mocked.logout).toHaveBeenCalledTimes(1));
      expect(screen.getByRole('heading', { name: 'Employee Login' })).toBeInTheDocument();
    });

    it('shows the form without any lookups when nobody is signed in', async () => {
      renderLogin();

      await waitFor(() => expect(mocked.validateSession).toHaveBeenCalled());
      expect(mocked.getUserProfile).not.toHaveBeenCalled();
      expect(mocked.logout).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'Employee Login' })).toBeInTheDocument();
    });
  });
});
