import { expect, test, type Page } from '@playwright/test';
import { signInAsAdmin } from './support/admin';
import { ADMIN_USER, mockSupabase, TEST_USER } from './support/supabase-mock';

const INVALID_EMAIL_ERROR = 'Please enter a valid email address';
const BAD_CREDENTIALS_ERROR = 'Incorrect credentials. Please check your email and password.';
const NOT_AUTHORIZED_ERROR = 'You are not authorized to access the Admin App.';

const email = (page: Page) => page.getByLabel('Email Address');
const password = (page: Page) => page.getByLabel('Password');
const loginButton = (page: Page) => page.getByRole('button', { name: 'Login' });

async function openLogin(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Admin App/ }).click();
  await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
}

async function signIn(page: Page, address: string, pass: string) {
  await email(page).fill(address);
  await password(page).fill(pass);
  await loginButton(page).click();
}

test.describe('Admin Login screen', () => {
  test.describe('form behaviour', () => {
    test.beforeEach(async ({ page }) => {
      await mockSupabase(page);
      await openLogin(page);
    });

    test('is reached by choosing Admin App on the selection screen', async ({ page }) => {
      await expect(page).toHaveURL(/\/admin\/login$/);
      await expect(page.getByText('Enter your credentials to continue')).toBeVisible();
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
      const mock = await mockSupabase(page);
      await email(page).fill('random text');
      await password(page).fill('more random text');
      await expect(loginButton(page)).toBeEnabled();

      await loginButton(page).click();

      await expect(page.getByText(INVALID_EMAIL_ERROR)).toBeVisible();
      await expect(page).toHaveURL(/\/admin\/login$/);
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

      await signIn(page, ADMIN_USER.email, 'not-the-password');

      await expect(page.getByText(BAD_CREDENTIALS_ERROR)).toBeVisible();
      await expect(page).toHaveURL(/\/admin\/login$/);
      expect(mock.signInAttempts).toEqual([{ email: ADMIN_USER.email, password: 'not-the-password' }]);
    });

    test('an email nobody has registered gets the same error', async ({ page }) => {
      await mockSupabase(page);
      await openLogin(page);

      await signIn(page, 'nobody@arka.test', ADMIN_USER.password);

      await expect(page.getByText(BAD_CREDENTIALS_ERROR)).toBeVisible();
    });
  });

  test.describe('clearing the error', () => {
    for (const [errorName, address, pass, message] of [
      ['invalid-email', 'random text', 'whatever', INVALID_EMAIL_ERROR],
      ['incorrect-credentials', ADMIN_USER.email, 'wrong', BAD_CREDENTIALS_ERROR],
    ] as const) {
      for (const field of ['email', 'password'] as const) {
        test(`changing the ${field} clears an ${errorName} error`, async ({ page }) => {
          await mockSupabase(page);
          await openLogin(page);
          await signIn(page, address, pass);
          await expect(page.getByText(message)).toBeVisible();

          await (field === 'email' ? email(page) : password(page)).pressSequentially('!');

          await expect(page.getByText(message)).toBeHidden();
        });
      }
    }
  });

  test.describe('signing in', () => {
    test('a valid administrator is taken to the Admin Dashboard', async ({ page }) => {
      const mock = await mockSupabase(page);
      await openLogin(page);

      await signIn(page, ADMIN_USER.email, ADMIN_USER.password);

      await expect(page).toHaveURL(/\/admin\/home$/);
      await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
      expect(mock.signInAttempts).toEqual([{ email: ADMIN_USER.email, password: ADMIN_USER.password }]);
      expect(mock.unexpected).toEqual([]);
    });

    test('pressing Enter in the password field signs in', async ({ page }) => {
      await mockSupabase(page);
      await openLogin(page);
      await email(page).fill(ADMIN_USER.email);
      await password(page).fill(ADMIN_USER.password);

      await password(page).press('Enter');

      await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    });

    test('an administrator who is already signed in skips the login screen', async ({ page }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);

      await page.goto('/admin/login');

      await expect(page).toHaveURL(/\/admin\/home$/);
      await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    });

    test('reloading the dashboard keeps the administrator signed in', async ({ page }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);

      await page.reload();

      await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    });
  });

  test.describe('who can reach the admin app', () => {
    test('an employee account is refused, signed out, and left on the login screen', async ({ page }) => {
      const mock = await mockSupabase(page);
      await openLogin(page);

      await signIn(page, TEST_USER.email, TEST_USER.password);

      await expect(page.getByText(NOT_AUTHORIZED_ERROR)).toBeVisible();
      await expect(page).toHaveURL(/\/admin\/login$/);
      expect(mock.requests).toContain('POST /auth/v1/logout');
    });

    for (const path of ['/admin/home', '/admin/employees', '/admin/employees/create', '/admin/employees/role-setup']) {
      test(`a signed-out visitor opening ${path} is sent to the login screen`, async ({ page }) => {
        await mockSupabase(page);

        await page.goto(path);

        await expect(page).toHaveURL(/\/admin\/login$/);
        await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
      });
    }

    test('an unknown admin address is sent to the login screen', async ({ page }) => {
      await mockSupabase(page);

      await page.goto('/admin/does-not-exist');

      await expect(page).toHaveURL(/\/admin\/login$/);
    });

    test('the bare /admin address opens the login screen', async ({ page }) => {
      await mockSupabase(page);

      await page.goto('/admin');

      await expect(page).toHaveURL(/\/admin\/login$/);
    });

    test('an employee who is signed in cannot open the admin dashboard', async ({ page }) => {
      await mockSupabase(page);
      await page.goto('/employee/login');
      await page.getByLabel('Email Address').fill(TEST_USER.email);
      await page.getByLabel('Password').fill(TEST_USER.password);
      await page.getByRole('button', { name: 'Login' }).click();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

      await page.goto('/admin/home');

      await expect(page).toHaveURL(/\/admin\/login$/);
    });
  });
});
