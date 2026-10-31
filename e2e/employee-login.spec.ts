import { expect, test, type Page } from '@playwright/test';
import { mockSupabase, TEST_USER, type SupabaseMock } from './support/supabase-mock';

const INVALID_EMAIL_ERROR = 'Please enter a valid email address';
const BAD_CREDENTIALS_ERROR = 'Incorrect credentials. Please check your email and password.';
const NOT_AUTHORIZED_ERROR = 'You are not authorized to access the Employee App.';
const DEACTIVATED_ERROR = 'Your account has been deactivated. Please contact your administrator.';

const email = (page: Page) => page.getByLabel('Email Address');
const password = (page: Page) => page.getByLabel('Password');
const loginButton = (page: Page) => page.getByRole('button', { name: 'Login' });

async function openLogin(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Employee App/ }).click();
  await expect(page.getByRole('heading', { name: 'Employee Login' })).toBeVisible();
}

async function signIn(page: Page, address: string, pass: string) {
  await email(page).fill(address);
  await password(page).fill(pass);
  await loginButton(page).click();
}

test.describe('Employee Login screen', () => {
  test.describe('form behaviour', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page);
      await openLogin(page);
    });

    test('keeps Login disabled until both fields have text', async ({ page }) => {
      await expect(loginButton(page)).toBeDisabled();

      await email(page).fill('abc');
      await expect(loginButton(page)).toBeDisabled();

      await password(page).fill('xyz');
      await expect(loginButton(page)).toBeEnabled();

      await email(page).fill('');
      await expect(loginButton(page)).toBeDisabled();
    });

    test('random text in both fields enables Login, and clicking it reports an invalid email', async ({ page }) => {
      await email(page).fill('random text');
      await password(page).fill('more random text');
      await expect(loginButton(page)).toBeEnabled();

      await loginButton(page).click();

      await expect(page.getByText(INVALID_EMAIL_ERROR)).toBeVisible();
      await expect(page).toHaveURL(/\/employee\/login$/);
      expect(mock.signInAttempts).toHaveLength(0);
    });

    test('masks the password as it is typed', async ({ page }) => {
      await expect(password(page)).toHaveAttribute('type', 'password');
    });

    test('Back to App Selection returns to the selection screen', async ({ page }) => {
      await page.getByRole('button', { name: /Back to App Selection/ }).click();

      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByText('Select your application')).toBeVisible();
    });
  });

  test.describe('wrong credentials', () => {
    test('a valid email with the wrong password shows the incorrect-credentials error', async ({ page }) => {
      const mock = await mockSupabase(page);
      await openLogin(page);

      await signIn(page, TEST_USER.email, 'not-the-password');

      await expect(page.getByText(BAD_CREDENTIALS_ERROR)).toBeVisible();
      await expect(page).toHaveURL(/\/employee\/login$/);
      expect(mock.signInAttempts).toEqual([{ email: TEST_USER.email, password: 'not-the-password' }]);
    });

    test('an email nobody has registered gets the same error as a wrong password', async ({ page }) => {
      await mockSupabase(page);
      await openLogin(page);

      await signIn(page, 'nobody@arka.test', TEST_USER.password);

      await expect(page.getByText(BAD_CREDENTIALS_ERROR)).toBeVisible();
    });
  });

  test.describe('clearing the error', () => {
    test('changing the email clears an invalid-email error', async ({ page }) => {
      await mockSupabase(page);
      await openLogin(page);
      await signIn(page, 'random text', 'whatever');
      await expect(page.getByText(INVALID_EMAIL_ERROR)).toBeVisible();

      await email(page).pressSequentially('!');

      await expect(page.getByText(INVALID_EMAIL_ERROR)).toBeHidden();
    });

    test('changing the password clears an invalid-email error', async ({ page }) => {
      await mockSupabase(page);
      await openLogin(page);
      await signIn(page, 'random text', 'whatever');
      await expect(page.getByText(INVALID_EMAIL_ERROR)).toBeVisible();

      await password(page).pressSequentially('!');

      await expect(page.getByText(INVALID_EMAIL_ERROR)).toBeHidden();
    });

    test('changing the email clears an incorrect-credentials error', async ({ page }) => {
      await mockSupabase(page);
      await openLogin(page);
      await signIn(page, TEST_USER.email, 'wrong');
      await expect(page.getByText(BAD_CREDENTIALS_ERROR)).toBeVisible();

      await email(page).pressSequentially('x');

      await expect(page.getByText(BAD_CREDENTIALS_ERROR)).toBeHidden();
    });

    test('changing the password clears an incorrect-credentials error', async ({ page }) => {
      await mockSupabase(page);
      await openLogin(page);
      await signIn(page, TEST_USER.email, 'wrong');
      await expect(page.getByText(BAD_CREDENTIALS_ERROR)).toBeVisible();

      await password(page).pressSequentially('x');

      await expect(page.getByText(BAD_CREDENTIALS_ERROR)).toBeHidden();
    });
  });

  test.describe('signing in', () => {
    test('a valid, existing employee is taken to the Home screen', async ({ page }) => {
      const mock = await mockSupabase(page);
      await openLogin(page);

      await signIn(page, TEST_USER.email, TEST_USER.password);

      await expect(page).toHaveURL(/\/employee\/home$/);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      expect(mock.signInAttempts).toEqual([{ email: TEST_USER.email, password: TEST_USER.password }]);
      expect(mock.unexpected).toEqual([]);
    });

    test('pressing Enter in the password field signs in', async ({ page }) => {
      await mockSupabase(page);
      await openLogin(page);
      await email(page).fill(TEST_USER.email);
      await password(page).fill(TEST_USER.password);

      await password(page).press('Enter');

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('an employee who is already signed in skips the login screen', async ({ page }) => {
      await mockSupabase(page);
      await openLogin(page);
      await signIn(page, TEST_USER.email, TEST_USER.password);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

      await page.goto('/employee/login');

      await expect(page).toHaveURL(/\/employee\/home$/);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('a signed-out visitor cannot open the Home screen directly', async ({ page }) => {
      await mockSupabase(page);

      await page.goto('/employee/home');

      await expect(page).toHaveURL(/\/employee\/login$/);
      await expect(page.getByRole('heading', { name: 'Employee Login' })).toBeVisible();
    });
  });

  test.describe('accounts that must not get in', () => {
    test('an admin account is refused, signed out, and left on the login screen', async ({ page }) => {
      const mock = await mockSupabase(page, { role: 'ADMIN' });
      await openLogin(page);

      await signIn(page, TEST_USER.email, TEST_USER.password);

      await expect(page.getByText(NOT_AUTHORIZED_ERROR)).toBeVisible();
      await expect(page).toHaveURL(/\/employee\/login$/);
      expect(mock.requests).toContain('POST /auth/v1/logout');
    });

    test('a deactivated employee is sent back to login with the deactivated message', async ({ page }) => {
      const mock = await mockSupabase(page, { activeEmployee: false });
      await openLogin(page);

      await signIn(page, TEST_USER.email, TEST_USER.password);

      await expect(page).toHaveURL(/\/employee\/login$/);
      await expect(page.getByText(DEACTIVATED_ERROR)).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeHidden();
      expect(mock.requests).toContain('POST /rest/v1/rpc/am_i_active_employee');
      expect(mock.requests).toContain('POST /auth/v1/logout');
    });

    test('the deactivated message goes away once the employee starts typing', async ({ page }) => {
      await mockSupabase(page, { activeEmployee: false });
      await openLogin(page);
      await signIn(page, TEST_USER.email, TEST_USER.password);
      await expect(page.getByText(DEACTIVATED_ERROR)).toBeVisible();

      await email(page).pressSequentially('x');

      await expect(page.getByText(DEACTIVATED_ERROR)).toBeHidden();
    });
  });
});
