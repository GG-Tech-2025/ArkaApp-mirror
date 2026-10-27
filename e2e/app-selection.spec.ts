import { expect, test } from '@playwright/test';
import { mockSupabase } from './support/supabase-mock';

test.describe('Select application screen', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/');
  });

  test('shows the Employee and Admin applications to choose from', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Arka Bricks' })).toBeVisible();
    await expect(page.getByText('Select your application')).toBeVisible();
    await expect(page.getByRole('button', { name: /Employee App/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Admin App/ })).toBeVisible();
  });

  test('selecting the Employee app opens the Employee Login screen', async ({ page }) => {
    await page.getByRole('button', { name: /Employee App/ }).click();

    await expect(page).toHaveURL(/\/employee\/login$/);
    await expect(page.getByRole('heading', { name: 'Employee Login' })).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('selecting the Admin app opens the Admin Login screen', async ({ page }) => {
    await page.getByRole('button', { name: /Admin App/ }).click();

    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });

  test('the browser Back button returns from a login screen to the selection screen', async ({ page }) => {
    await page.getByRole('button', { name: /Employee App/ }).click();
    await expect(page.getByRole('heading', { name: 'Employee Login' })).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Select your application')).toBeVisible();
  });

  test('either application can be chosen again after going back', async ({ page }) => {
    await page.getByRole('button', { name: /Employee App/ }).click();
    await page.goBack();

    await page.getByRole('button', { name: /Admin App/ }).click();

    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });

  test('an unknown address falls back to the selection screen', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Select your application')).toBeVisible();
  });

  test('can be operated with the keyboard', async ({ page }) => {
    await page.getByRole('button', { name: /Employee App/ }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /Admin App/ })).toBeFocused();

    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
  });
});
