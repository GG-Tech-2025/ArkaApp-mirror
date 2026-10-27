import { expect, type Page } from '@playwright/test';
import { TEST_USER } from './supabase-mock';

/** Signs the test employee in through the real login screen and waits for the dashboard. */
export async function signInAsEmployee(page: Page) {
  await page.goto('/employee/login');
  await page.getByLabel('Email Address').fill(TEST_USER.email);
  await page.getByLabel('Password').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}
