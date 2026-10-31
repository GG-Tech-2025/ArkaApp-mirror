import { expect, test } from '@playwright/test';
import { signInAsAdmin } from './support/admin';
import { mockSupabase } from './support/supabase-mock';

const MODULES: Array<[string, RegExp]> = [
  ['Order Management', /\/admin\/orders/],
  ['Production Statistics', /\/admin\/production/],
  ['Inventory Management', /\/admin\/inventory/],
  ['Customer Management', /\/admin\/customers/],
  ['Accounts Management', /\/admin\/accounts/],
  ['Metrics', /\/admin\/metrics/],
  ['Employee Management', /\/admin\/employees$/],
  ['Salary Ledger', /\/admin\/employees\/salary-ledger/],
  ['Vendor Management', /\/admin\/vendors/],
  ['Cash Flow', /\/admin\/cash/],
  ['Loan Management', /\/admin\/loans/],
  ['App Settings', /\/admin\/settings/],
];

// A fixed mid-month morning, so renewal dates are the same distance away whenever this runs.
const NOW = new Date(2026, 9, 15, 10, 0, 0);

test.describe('Admin Home screen', () => {
  test.describe('the dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);
    });

    test('greets the administrator and shows the organization and branch', async ({ page }) => {
      await expect(page).toHaveURL(/\/admin\/home$/);
      await expect(page.getByText('Welcome! Select a module to continue')).toBeVisible();
      await expect(page.getByText('Bricky box · T.gode')).toBeVisible();
    });

    test('offers all twelve modules', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 3 })).toHaveText([
        'Order Management',
        'Production Statistics',
        'Inventory Management',
        'Customer Management',
        'Accounts Management',
        'Metrics',
        'Employee Management',
        'Salary Ledger',
        'Vendor Management',
        'Cash Flow',
        'Loan Management',
        'App Settings',
      ]);
    });

    for (const [title, url] of MODULES) {
      test(`${title} opens its module`, async ({ page }) => {
        await page.getByRole('button', { name: new RegExp(title) }).click();

        await expect(page).toHaveURL(url);
      });
    }

    test('Employee Management shows its screen, and Back to Home returns to the dashboard', async ({ page }) => {
      await page.getByRole('button', { name: /Employee Management/ }).click();
      await expect(page.getByRole('heading', { name: 'Employee Management' })).toBeVisible();

      await page.getByRole('button', { name: /Back to Home/ }).click();

      await expect(page).toHaveURL(/\/admin\/home$/);
      await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    });

    test('a module can be chosen with the keyboard', async ({ page }) => {
      await page.getByRole('button', { name: /Employee Management/ }).focus();

      await page.keyboard.press('Enter');

      await expect(page).toHaveURL(/\/admin\/employees$/);
    });

    test('the Password button opens the change-password screen', async ({ page }) => {
      await page.getByRole('button', { name: 'Password' }).click();

      await expect(page).toHaveURL(/\/admin\/change-password$/);
    });

    test('shows no renewal banner when no renewal is near', async ({ page }) => {
      await expect(page.getByRole('status')).toBeHidden();
    });
  });

  test.describe('logging out', () => {
    test('shows a success popup, then OK returns to the admin login screen', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsAdmin(page);

      await page.getByRole('button', { name: 'Logout' }).click();

      await expect(page.getByText('Logout Successful')).toBeVisible();
      await expect(page.getByText('You have been logged out successfully.')).toBeVisible();
      await expect(page.getByText('Session Expired')).toBeHidden();
      expect(mock.requests).toContain('POST /auth/v1/logout');

      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page).toHaveURL(/\/admin\/login$/);
      await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    });

    test('after logging out, the dashboard can no longer be opened', async ({ page }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);
      await page.getByRole('button', { name: 'Logout' }).click();
      await page.getByRole('button', { name: 'OK' }).click();

      await page.goto('/admin/home');

      await expect(page).toHaveURL(/\/admin\/login$/);
    });

    test('removes the saved session from the browser', async ({ page }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);
      const tokens = () => page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('auth-token')).length);
      expect(await tokens()).toBeGreaterThan(0);

      await page.getByRole('button', { name: 'Logout' }).click();
      await expect(page.getByText('Logout Successful')).toBeVisible();

      expect(await tokens()).toBe(0);
    });

    test('the administrator can sign in again straight after logging out', async ({ page }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);
      await page.getByRole('button', { name: 'Logout' }).click();
      await page.getByRole('button', { name: 'OK' }).click();

      await signInAsAdmin(page);

      await expect(page).toHaveURL(/\/admin\/home$/);
    });

    test('can be done from the keyboard', async ({ page }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);

      await page.getByRole('button', { name: 'Logout' }).focus();
      await page.keyboard.press('Enter');

      await expect(page.getByText('Logout Successful')).toBeVisible();
    });

    test('a rejected sign-out request is reported, and the session is already gone on reload', async ({ page }) => {
      await mockSupabase(page, { logoutFails: true });
      await signInAsAdmin(page);

      await page.getByRole('button', { name: 'Logout' }).click();

      await expect(page.getByText('Something Went Wrong')).toBeVisible();
      await expect(page.getByText('Unable to logout. Please try again.')).toBeVisible();

      await page.reload();

      await expect(page).toHaveURL(/\/admin\/login$/);
    });
  });

  test.describe('session ended elsewhere', () => {
    test('signing out in another tab warns "Session Expired" here, and OK goes to login', async ({ page, context }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);

      const other = await context.newPage();
      await mockSupabase(other, { signedInAs: 'admin' });
      await other.goto('/admin/home');
      await expect(other.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
      await other.getByRole('button', { name: 'Logout' }).click();

      await expect(page.getByText('Session Expired')).toBeVisible();
      await expect(page.getByText('Your session has expired. Please login again.')).toBeVisible();
      await expect(page).toHaveURL(/\/admin\/home$/);

      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page).toHaveURL(/\/admin\/login$/);
    });
  });

  test.describe('when the branch cannot be used', () => {
    test('a paused branch shows an explanation instead of the dashboard, and can sign out', async ({ page }) => {
      await mockSupabase(page, { branchStatus: 'PAUSED' });
      await page.goto('/admin/login');
      await page.getByLabel('Email Address').fill('admin@brickybox.test');
      await page.getByLabel('Password').fill('correct-password');
      await page.getByRole('button', { name: 'Login' }).click();

      await expect(page.getByRole('heading', { name: 'This branch is paused' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeHidden();
      await page.getByRole('button', { name: 'Sign out' }).click();
      await expect(page).toHaveURL(/\/admin\/login$/);
    });

    test('a paused organization says the account is paused', async ({ page }) => {
      await mockSupabase(page, { organizationStatus: 'SUSPENDED' });
      await page.goto('/admin/login');
      await page.getByLabel('Email Address').fill('admin@brickybox.test');
      await page.getByLabel('Password').fill('correct-password');
      await page.getByRole('button', { name: 'Login' }).click();

      await expect(page.getByRole('heading', { name: 'Your account is paused' })).toBeVisible();
    });
  });

  test.describe('renewal reminders', () => {
    test.beforeEach(async ({ page }) => {
      await page.clock.setFixedTime(NOW);
    });

    test('a renewal due within a week shows a reminder that can be dismissed', async ({ page }) => {
      await mockSupabase(page, { renewalDate: '2026-10-18' });
      await signInAsAdmin(page);

      const banner = page.getByRole('status');
      await expect(banner).toContainText('The payment for T.gode is due on');
      await expect(banner).toContainText('in 3 days');
      await expect(banner).toContainText('Please make the payment to avoid any interruption.');

      await page.getByRole('button', { name: 'Dismiss' }).click();

      await expect(banner).toBeHidden();
    });

    test('a dismissed reminder stays dismissed after a reload', async ({ page }) => {
      await mockSupabase(page, { renewalDate: '2026-10-18' });
      await signInAsAdmin(page);
      await page.getByRole('button', { name: 'Dismiss' }).click();

      await page.reload();

      await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
      await expect(page.getByRole('status')).toBeHidden();
    });

    test('an overdue renewal shows a warning that cannot be dismissed', async ({ page }) => {
      await mockSupabase(page, { renewalDate: '2026-10-12' });
      await signInAsAdmin(page);

      const banner = page.getByRole('status');
      await expect(banner).toContainText('was due on');
      await expect(banner).toContainText('3 days ago');
      await expect(banner).toContainText('Please pay now to avoid this branch being paused.');
      await expect(page.getByRole('button', { name: 'Dismiss' })).toBeHidden();
    });

    test('a renewal exactly seven days away is the first to show a reminder', async ({ page }) => {
      await mockSupabase(page, { renewalDate: '2026-10-22' });
      await signInAsAdmin(page);

      await expect(page.getByRole('status')).toContainText('in 7 days');
    });

    test('a renewal eight days away shows nothing yet', async ({ page }) => {
      await mockSupabase(page, { renewalDate: '2026-10-23' });
      await signInAsAdmin(page);

      await expect(page.getByRole('status')).toBeHidden();
    });

    test('a renewal due today says so', async ({ page }) => {
      await mockSupabase(page, { renewalDate: '2026-10-15' });
      await signInAsAdmin(page);

      await expect(page.getByRole('status')).toContainText('is due today');
    });

    test('a renewal more than a week away shows nothing', async ({ page }) => {
      await mockSupabase(page, { renewalDate: '2026-11-30' });
      await signInAsAdmin(page);

      await expect(page.getByRole('status')).toBeHidden();
    });

    test('the reminder also shows on the employee management screen', async ({ page }) => {
      await mockSupabase(page, { renewalDate: '2026-10-18' });
      await signInAsAdmin(page);

      await page.getByRole('button', { name: /Employee Management/ }).click();

      await expect(page.getByRole('heading', { name: 'Employee Management' })).toBeVisible();
      await expect(page.getByRole('status')).toContainText('The payment for T.gode');
    });
  });

  test.describe('on a phone', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
    });

    test('the icon-only Logout and Password buttons keep their accessible names', async ({ page }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);

      await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Password' })).toBeVisible();
    });

    test('logging out works at phone width', async ({ page }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);

      await page.getByRole('button', { name: 'Logout' }).click();

      await expect(page.getByText('Logout Successful')).toBeVisible();
    });

    test('no part of the dashboard is cut off sideways', async ({ page }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
});
