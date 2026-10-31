import { expect, test, type Page } from '@playwright/test';
import { signInAsAdmin } from './support/admin';
import { mockSupabase, ORDERS, type SupabaseMock } from './support/supabase-mock';

// A fixed mid-month morning: "today" is 2026-10-15.
const NOW = new Date(2026, 9, 15, 10, 0, 0);

// One order due later, and one already due today.
const UNDELIVERED = [
  { ...ORDERS[0], delivery_date: '2026-10-20' },
  { ...ORDERS[1], delivery_date: '2026-10-15' },
];

const toggle = (page: Page, orderId: string) => page.getByRole('checkbox', { name: `Delivery today for order ${orderId}` });

// The checkbox itself is visually hidden; users click the switch drawn on its label.
const flip = (page: Page, orderId: string) => toggle(page, orderId).locator('xpath=ancestor::label').click();

async function openUndeliveredOrders(page: Page) {
  await page.getByRole('button', { name: /Order Management/ }).click();
  await expect(page.getByRole('heading', { name: 'Order Management' })).toBeVisible();
  await page.getByRole('button', { name: 'Undelivered' }).click();
  await expect(page.getByRole('cell', { name: 'ord-1001', exact: true })).toBeVisible();
}

test.describe('Admin Order Management: Delivery Today toggle', () => {
  let mock: SupabaseMock;

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
  });

  test.describe('confirming', () => {
    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page, { signedInAs: 'admin', orders: UNDELIVERED });
      await signInAsAdmin(page);
      await openUndeliveredOrders(page);
    });

    test('shows the toggle on for the order due today and off for the other', async ({ page }) => {
      await expect(toggle(page, 'ord-1001')).not.toBeChecked();
      await expect(toggle(page, 'ord-1002')).toBeChecked();
    });

    test('asks for confirmation before moving an order to today', async ({ page }) => {
      await flip(page, 'ord-1001');

      const dialog = page.getByRole('dialog', { name: 'Deliver Today' });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('ord-1001');
      await expect(dialog.getByRole('button', { name: 'Yes' })).toBeEnabled();
      await expect(dialog.getByRole('button', { name: 'No' })).toBeEnabled();
      expect(mock.orderUpdates).toHaveLength(0);
    });

    test('saves today as the delivery date when confirmed', async ({ page }) => {
      await flip(page, 'ord-1001');
      await page.getByRole('dialog').getByRole('button', { name: 'Yes' }).click();

      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(toggle(page, 'ord-1001')).toBeChecked();
      expect(mock.orderUpdates).toEqual([
        { p_order_id: 'ord-1001', p_update: { delivery_date: '2026-10-15' }, p_loadmen: [], p_skip_loadmen: true },
      ]);
    });

    test('changes nothing when the confirmation is declined', async ({ page }) => {
      await flip(page, 'ord-1001');
      await page.getByRole('dialog').getByRole('button', { name: 'No' }).click();

      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(toggle(page, 'ord-1001')).not.toBeChecked();
      expect(mock.orderUpdates).toHaveLength(0);
      await expect(page).toHaveURL(/\/admin\/orders$/);
    });

    test('opens the order, without asking, when the toggle of an order due today is clicked', async ({ page }) => {
      await flip(page, 'ord-1002');

      await expect(page).toHaveURL(/\/admin\/orders\/ord-1002$/);
      expect(mock.orderUpdates).toHaveLength(0);
    });
  });

  test('shows the error when the update fails', async ({ page }) => {
    mock = await mockSupabase(page, { signedInAs: 'admin', orders: UNDELIVERED, orderUpdateFails: true });
    await signInAsAdmin(page);
    await openUndeliveredOrders(page);

    await flip(page, 'ord-1001');
    await page.getByRole('dialog').getByRole('button', { name: 'Yes' }).click();

    await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Deliver Today' })).toBeHidden();
    expect(mock.orderUpdates).toHaveLength(0);
  });
});
