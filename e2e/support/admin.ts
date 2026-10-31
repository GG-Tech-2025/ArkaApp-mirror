import { expect, type Page } from '@playwright/test';
import { ADMIN_USER } from './supabase-mock';

/** Signs the test administrator in through the real admin login screen and waits for the dashboard. */
export async function signInAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email Address').fill(ADMIN_USER.email);
  await page.getByLabel('Password').fill(ADMIN_USER.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
}
