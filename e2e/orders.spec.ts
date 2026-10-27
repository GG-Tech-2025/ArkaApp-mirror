import { expect, test, type Page } from '@playwright/test';
import { signInAsEmployee } from './support/employee';
import { mockSupabase, type SupabaseMock } from './support/supabase-mock';

// A fixed mid-month morning, so "today" is the delivery date the fixtures use.
const NOW = new Date(2026, 9, 15, 10, 0, 0);

async function openOrders(page: Page) {
  await page.getByRole('button', { name: /Delivery Entry/ }).click();
  await expect(page).toHaveURL(/\/employee\/orders$/);
}

const card = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(name) });

test.describe('Undelivered Orders screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
  });

  test.describe('the list', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openOrders(page);
      await expect(page.getByRole('heading', { name: 'Undelivered Orders' })).toBeVisible();
    });

    test('shows the heading and one card per undelivered order', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Undelivered Orders' })).toBeVisible();
      await expect(page.getByText('Select an order to enter delivery details')).toBeVisible();
      await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Rajesh Kumar', 'Priya Sharma']);
      await expect(page.getByText('Pending Delivery')).toHaveCount(2);
    });

    test('shows each order\'s id, phone, quantity, location and amount', async ({ page }) => {
      const first = card(page, 'Rajesh Kumar');
      await expect(first).toContainText('Order ID: ord-1001');
      await expect(first).toContainText('9876543210');
      await expect(first).toContainText('5000 bricks');
      await expect(first).toContainText('12 MG Road, Coimbatore');
      await expect(first).toContainText('₹40000');

      const second = card(page, 'Priya Sharma');
      await expect(second).toContainText('Order ID: ord-1002');
      await expect(second).toContainText('3000 bricks');
      await expect(second).toContainText('45 Brigade Road, Erode');
      await expect(second).toContainText('₹24000');
    });

    test('asks the server only for today\'s undelivered orders, oldest first', async () => {
      expect(mock.orderListQueries).toHaveLength(1);
      const query = new URLSearchParams(mock.orderListQueries[0]);
      expect(query.get('delivery_date')).toBe('eq.2026-10-15');
      expect(query.get('delivered')).toBe('eq.false');
      expect(query.get('order')).toBe('created_at.asc');
    });

    test('Back to Home returns to the dashboard', async ({ page }) => {
      await page.getByRole('button', { name: /Back to Home/ }).click();

      await expect(page).toHaveURL(/\/employee\/home$/);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('reloading the page keeps the employee on the list', async ({ page }) => {
      await page.reload();

      await expect(page.getByRole('heading', { name: 'Undelivered Orders' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 3 })).toHaveCount(2);
    });

    test('makes no unexpected backend calls', async () => {
      expect(mock.unexpected).toEqual([]);
    });
  });

  test.describe('opening an order', () => {
    test.beforeEach(async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await openOrders(page);
    });

    test('clicking a card opens that order\'s delivery entry', async ({ page }) => {
      await card(page, 'Priya Sharma').click();

      await expect(page).toHaveURL(/\/employee\/orders\/ord-1002\/delivery$/);
      await expect(page.getByRole('heading', { name: 'Delivery Entry' })).toBeVisible();
      await expect(page.getByLabel('Customer Name')).toHaveValue('Priya Sharma');
    });

    test('clicking the Select Order link opens the same delivery entry', async ({ page }) => {
      await page.getByText('Select Order →').first().click();

      await expect(page).toHaveURL(/\/employee\/orders\/ord-1001\/delivery$/);
      await expect(page.getByLabel('Customer Name')).toHaveValue('Rajesh Kumar');
    });

    test('an order can be opened from the keyboard', async ({ page }) => {
      await card(page, 'Rajesh Kumar').focus();

      await page.keyboard.press('Enter');

      await expect(page).toHaveURL(/\/employee\/orders\/ord-1001\/delivery$/);
    });

    test('Back to Orders from the delivery entry returns to the list', async ({ page }) => {
      await card(page, 'Rajesh Kumar').click();
      await expect(page).toHaveURL(/delivery$/);

      await page.getByRole('button', { name: /Back to Orders/ }).click();

      await expect(page).toHaveURL(/\/employee\/orders$/);
      await expect(page.getByRole('heading', { name: 'Undelivered Orders' })).toBeVisible();
    });

    test('clicking a card adds a single history entry, so Back returns to the list', async ({ page }) => {
      const before = await page.evaluate(() => history.length);

      await card(page, 'Rajesh Kumar').click();
      await expect(page).toHaveURL(/delivery$/);
      expect(await page.evaluate(() => history.length)).toBe(before + 1);

      await page.goBack();
      await expect(page).toHaveURL(/\/employee\/orders$/);
    });
  });

  test.describe('nothing to deliver, or a failure', () => {
    test('says so when no orders are assigned', async ({ page }) => {
      await mockSupabase(page, { orders: [] });
      await signInAsEmployee(page);
      await openOrders(page);

      await expect(page.getByText('No orders assigned for delivery.')).toBeVisible();
      await expect(page.getByText('Pending Delivery')).toBeHidden();
      await page.getByRole('button', { name: /Back to Home/ }).click();
      await expect(page).toHaveURL(/\/employee\/home$/);
    });

    test('shows a plain error message when the orders cannot be loaded', async ({ page }) => {
      await mockSupabase(page, { ordersFail: true });
      await signInAsEmployee(page);
      await openOrders(page);

      await expect(page.getByText('Failed to load orders')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Undelivered Orders' })).toBeHidden();
    });
  });

  test.describe('a way back and a single step forward', () => {
    test('clicking the Select Order link adds a single history entry, so Back returns to the list', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await openOrders(page);
      const before = await page.evaluate(() => history.length);

      await page.getByText('Select Order →').first().click();
      await expect(page).toHaveURL(/delivery$/);
      expect(await page.evaluate(() => history.length)).toBe(before + 1);

      await page.goBack();
      await expect(page).toHaveURL(/\/employee\/orders$/);
    });

    test('the error screen offers a way back to the home screen', async ({ page }) => {
      await mockSupabase(page, { ordersFail: true });
      await signInAsEmployee(page);
      await openOrders(page);
      await expect(page.getByText('Failed to load orders')).toBeVisible();

      await page.getByRole('button', { name: /Back to Home/ }).click();

      await expect(page).toHaveURL(/\/employee\/home$/);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });
});
