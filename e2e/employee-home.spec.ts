import { expect, test } from '@playwright/test';
import { signInAsEmployee } from './support/employee';
import { mockSupabase, type SupabaseMock } from './support/supabase-mock';

test.describe('Employee Home screen', () => {
  test.describe('dashboard', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page);
      await signInAsEmployee(page);
    });

    test('greets the employee and offers the three tasks', async ({ page }) => {
      await expect(page).toHaveURL(/\/employee\/home$/);
      await expect(page.getByText('Welcome back! Select an option to continue')).toBeVisible();
      await expect(page.getByRole('heading', { level: 3 })).toHaveText([
        'Material Purchase Entry',
        'Production Entry',
        'Delivery Entry',
      ]);
      await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
      expect(mock.unexpected).toEqual([]);
    });

    test('Material Purchase Entry opens the material entry form', async ({ page }) => {
      await page.getByRole('button', { name: /Material Purchase Entry/ }).click();

      await expect(page).toHaveURL(/\/employee\/material-entry$/);
      await expect(page.getByRole('heading', { name: 'Material Purchase Entry' })).toBeVisible();
    });

    test('Production Entry opens the production form', async ({ page }) => {
      await page.getByRole('button', { name: /Production Entry/ }).click();

      await expect(page).toHaveURL(/\/employee\/production-entry$/);
    });

    test('Delivery Entry opens the orders list', async ({ page }) => {
      await page.getByRole('button', { name: /Delivery Entry/ }).click();

      await expect(page).toHaveURL(/\/employee\/orders$/);
    });

    test('a card can be chosen with the keyboard', async ({ page }) => {
      await page.getByRole('button', { name: /Material Purchase Entry/ }).focus();

      await page.keyboard.press('Enter');

      await expect(page).toHaveURL(/\/employee\/material-entry$/);
    });

    test('Back to Home from a task returns to the dashboard', async ({ page }) => {
      await page.getByRole('button', { name: /Material Purchase Entry/ }).click();
      await expect(page).toHaveURL(/material-entry$/);

      await page.getByRole('button', { name: /Back to Home/ }).click();

      await expect(page).toHaveURL(/\/employee\/home$/);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('a page reload keeps the employee signed in on the dashboard', async ({ page }) => {
      await page.reload();

      await expect(page).toHaveURL(/\/employee\/home$/);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });

  test.describe('logging out', () => {
    test('shows a success popup, then OK returns to the login screen', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);

      await page.getByRole('button', { name: 'Logout' }).click();

      await expect(page.getByText('Logout Successful')).toBeVisible();
      await expect(page.getByText('You have been logged out successfully.')).toBeVisible();
      await expect(page.getByText('Session Expired')).toBeHidden();
      await expect(page).toHaveURL(/\/employee\/home$/);
      expect(mock.requests).toContain('POST /auth/v1/logout');

      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page).toHaveURL(/\/employee\/login$/);
      await expect(page.getByRole('heading', { name: 'Employee Login' })).toBeVisible();
    });

    test('the popup blocks the dashboard behind it until OK is pressed', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await page.getByRole('button', { name: 'Logout' }).click();
      await expect(page.getByText('Logout Successful')).toBeVisible();

      // The overlay covers the cards, so a click aimed at one lands on the popup instead.
      await page.getByRole('button', { name: /Material Purchase Entry/ }).click({ force: true });

      await expect(page).toHaveURL(/\/employee\/home$/);
      await expect(page.getByText('Logout Successful')).toBeVisible();
    });

    test('after logging out, the dashboard can no longer be opened', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await page.getByRole('button', { name: 'Logout' }).click();
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page).toHaveURL(/\/employee\/login$/);

      await page.goto('/employee/home');

      await expect(page).toHaveURL(/\/employee\/login$/);
      await expect(page.getByRole('heading', { name: 'Employee Login' })).toBeVisible();
    });

    test('after logging out, the browser Back button does not reopen the dashboard', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await page.getByRole('button', { name: 'Logout' }).click();
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page).toHaveURL(/\/employee\/login$/);

      await page.goBack();

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeHidden();
    });
  });

  test.describe('logging out: further possibilities', () => {
    test('can be done from the keyboard', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);

      await page.getByRole('button', { name: 'Logout' }).focus();
      await page.keyboard.press('Enter');

      await expect(page.getByText('Logout Successful')).toBeVisible();
    });

    test('works after the employee has visited another screen and come back', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await page.getByRole('button', { name: /Delivery Entry/ }).click();
      await expect(page).toHaveURL(/\/employee\/orders$/);
      await page.getByRole('button', { name: /Back to Home/ }).click();

      await page.getByRole('button', { name: 'Logout' }).click();

      await expect(page.getByText('Logout Successful')).toBeVisible();
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page).toHaveURL(/\/employee\/login$/);
    });

    test('removes the saved session from the browser', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      const tokens = () => page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('auth-token')).length);
      expect(await tokens()).toBeGreaterThan(0);

      await page.getByRole('button', { name: 'Logout' }).click();
      await expect(page.getByText('Logout Successful')).toBeVisible();

      expect(await tokens()).toBe(0);
    });

    test('the employee can sign in again straight after logging out', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await page.getByRole('button', { name: 'Logout' }).click();
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page).toHaveURL(/\/employee\/login$/);

      await signInAsEmployee(page);

      await expect(page).toHaveURL(/\/employee\/home$/);
    });

    test('a rejected sign-out request is reported, and the session is already gone on reload', async ({ page }) => {
      await mockSupabase(page, { logoutFails: true });
      await signInAsEmployee(page);

      await page.getByRole('button', { name: 'Logout' }).click();

      await expect(page.getByText('Something Went Wrong')).toBeVisible();
      await expect(page.getByText('Unable to logout. Please try again.')).toBeVisible();
      await expect(page.getByText('Logout Successful')).toBeHidden();

      await page.reload();

      await expect(page).toHaveURL(/\/employee\/login$/);
    });
  });

  test.describe('on a phone', () => {
    test('the Logout button keeps its accessible name at phone width, where its text is hidden', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await mockSupabase(page);
      await signInAsEmployee(page);

      await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    });

    test('logging out works at phone width', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await mockSupabase(page);
      await signInAsEmployee(page);

      await page.getByRole('button', { name: 'Logout' }).click();

      await expect(page.getByText('Logout Successful')).toBeVisible();
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page).toHaveURL(/\/employee\/login$/);
    });
  });

  test.describe('session ended elsewhere', () => {
    test('signing out in another tab warns "Session Expired" here, and OK goes to login', async ({ page, context }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);

      // A page's mocked routes do not carry over to a new tab, so the second tab gets its own.
      const other = await context.newPage();
      await mockSupabase(other);
      await other.goto('/employee/home');
      await expect(other.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      await other.getByRole('button', { name: 'Logout' }).click();

      await expect(page.getByText('Session Expired')).toBeVisible();
      await expect(page.getByText('Your session has expired. Please login again.')).toBeVisible();
      await expect(page.getByText('Logout Successful')).toBeHidden();
      await expect(page).toHaveURL(/\/employee\/home$/);

      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page).toHaveURL(/\/employee\/login$/);
      await expect(page.getByRole('heading', { name: 'Employee Login' })).toBeVisible();
    });

    test('a session that ends on another screen goes straight to login', async ({ page, context }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await page.getByRole('button', { name: /Material Purchase Entry/ }).click();
      await expect(page).toHaveURL(/material-entry$/);

      const other = await context.newPage();
      await mockSupabase(other);
      await other.goto('/employee/home');
      await other.getByRole('button', { name: 'Logout' }).click();

      await expect(page).toHaveURL(/\/employee\/login$/);
    });
  });
});
