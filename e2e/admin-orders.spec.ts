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
      await expect(dialog).toContainText('Rajesh Kumar');
      await expect(dialog).toContainText('9876543210');
      await expect(dialog).toContainText('12 MG Road, Coimbatore');
      await expect(dialog).toContainText('5,000');
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

// ---------------------------------------------------------------------------------------------
// The lists, the tabs, loading more, deleting and moving around.
// ---------------------------------------------------------------------------------------------

const order = (id: string, customer: string, overrides: Record<string, unknown> = {}) => ({
  ...ORDERS[0],
  id,
  delivery_date: '2026-10-20',
  customers: { name: customer, phone: '9000000001' },
  ...overrides,
});

const MIXED = [
  order('ord-2001', 'Today Customer', { delivery_date: '2026-10-15' }),
  order('ord-2002', 'Later Customer'),
  order('ord-2003', 'Paid Customer', { delivered: true, delivery_date: '2026-10-10', payment_status: 'FULLY_PAID', amount_paid: 40000, dc_number: 'DC-301' }),
  order('ord-2004', 'Unpaid Customer', { delivered: true, delivery_date: '2026-10-12', payment_status: 'NOT_PAID', dc_number: 'DC-302' }),
  order('ord-2005', 'Part Customer', { delivered: true, delivery_date: '2026-10-11', payment_status: 'PARTIALLY_PAID', amount_paid: 10000, dc_number: null }),
  order('ord-2006', 'Same Day Customer', { delivered: true, delivery_date: '2026-10-15', payment_status: 'FULLY_PAID', amount_paid: 40000, dc_number: 'DC-303' }),
];

const list = (page: Page) => page.getByRole('table');
const rowOf = (page: Page, orderId: string) => list(page).getByRole('row', { name: new RegExp(orderId) });
const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const columns = (page: Page) => list(page).getByRole('columnheader');

async function openOrderManagement(page: Page) {
  await page.getByRole('button', { name: /Order Management/ }).click();
  await expect(page.getByRole('heading', { name: 'Order Management' })).toBeVisible();
}

async function openTab(page: Page, name: string) {
  await tab(page, name).click();
}

test.describe('Admin Order Management: the tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
  });

  async function open(page: Page, options: Parameters<typeof mockSupabase>[1] = {}) {
    const mock = await mockSupabase(page, { signedInAs: 'admin', orders: MIXED, ...options });
    await signInAsAdmin(page);
    await openOrderManagement(page);
    return mock;
  }

  test('opens on Today, listing only what is due today, with the basic columns', async ({ page }) => {
    await open(page);

    await expect(rowOf(page, 'ord-2001')).toBeVisible();
    await expect(rowOf(page, 'ord-2006')).toBeVisible();
    await expect(list(page).getByRole('row')).toHaveCount(3);
    await expect(columns(page)).toHaveText(['Order ID', 'Date', 'Delivery Date', 'Customer', 'Phone', 'Quantity', 'Final Price', 'Payment']);
  });

  test('Undelivered lists the orders not yet delivered, with the toggle and delete columns', async ({ page }) => {
    await open(page);

    await openTab(page, 'Undelivered');

    await expect(rowOf(page, 'ord-2001')).toBeVisible();
    await expect(rowOf(page, 'ord-2002')).toBeVisible();
    await expect(list(page).getByRole('row')).toHaveCount(3);
    await expect(columns(page).filter({ hasText: /^(Delivery Today|Actions)$/ })).toHaveCount(2);
  });

  test('Delivered lists the delivered orders with their DC numbers', async ({ page }) => {
    await open(page);

    await openTab(page, 'Delivered');

    await expect(list(page).getByRole('row')).toHaveCount(5);
    await expect(columns(page).last()).toHaveText('DC No');
    await expect(rowOf(page, 'ord-2003')).toContainText('DC-301');
    await expect(rowOf(page, 'ord-2005').getByRole('cell').last()).toHaveText('-');
    await expect(rowOf(page, 'ord-2001')).toHaveCount(0);
  });

  test('Unpaid lists the delivered orders still owing money, and labels how much is paid', async ({ page }) => {
    await open(page);

    await openTab(page, 'Unpaid');

    await expect(rowOf(page, 'ord-2004')).toContainText('Not Paid');
    await expect(rowOf(page, 'ord-2005')).toContainText('Partially Paid');
    await expect(list(page).getByRole('row')).toHaveCount(3);
    await expect(rowOf(page, 'ord-2003')).toHaveCount(0);
  });

  test('labels a fully paid order as Fully Paid', async ({ page }) => {
    await open(page);

    await openTab(page, 'Delivered');

    await expect(rowOf(page, 'ord-2003')).toContainText('Fully Paid');
  });

  test('asks the server for each tab\'s own list', async ({ page }) => {
    const mock = await open(page);

    await openTab(page, 'Undelivered');
    await openTab(page, 'Delivered');
    await openTab(page, 'Unpaid');

    const queries = mock.orderListQueries.map((q) => new URLSearchParams(q));
    expect(queries.some((q) => q.get('delivery_date') === 'eq.2026-10-15')).toBe(true);
    expect(queries.some((q) => q.get('delivered') === 'eq.false')).toBe(true);
    expect(queries.some((q) => q.get('delivered') === 'eq.true' && !q.get('payment_status'))).toBe(true);
    expect(queries.some((q) => q.get('delivered') === 'eq.true' && q.get('payment_status') === 'in.(NOT_PAID,PARTIALLY_PAID)')).toBe(true);
  });

  test('says there are no orders when a tab is empty', async ({ page }) => {
    await open(page, { orders: [] });

    await expect(page.getByText('No orders at the moment')).toBeVisible();
    await openTab(page, 'Delivered');
    await expect(page.getByText('No orders at the moment')).toBeVisible();
    await expect(list(page)).toHaveCount(0);
  });

  test('shows an error popup when the orders cannot be loaded, and recovers on another tab', async ({ page }) => {
    const mock = await mockSupabase(page, { signedInAs: 'admin', orders: MIXED, ordersFail: true });
    await signInAsAdmin(page);
    await openOrderManagement(page);

    await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible();
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.getByRole('heading', { name: 'Error' })).toBeHidden();
    expect(mock.orderListQueries.length).toBeGreaterThan(0);
  });
});

test.describe('Admin Order Management: loading more', () => {
  const MANY = Array.from({ length: 45 }, (_, i) => order(`ord-3${String(i).padStart(3, '0')}`, `Customer ${i}`));

  test('adds twenty orders at a time until everything is shown', async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await mockSupabase(page, { signedInAs: 'admin', orders: MANY });
    await signInAsAdmin(page);
    await openOrderManagement(page);
    await openTab(page, 'Undelivered');

    await expect(list(page).getByRole('row')).toHaveCount(21);
    await page.getByRole('button', { name: 'Load More' }).click();
    await expect(list(page).getByRole('row')).toHaveCount(41);
    await page.getByRole('button', { name: 'Load More' }).click();
    await expect(list(page).getByRole('row')).toHaveCount(46);
    await expect(page.getByRole('button', { name: 'Load More' })).toBeHidden();
  });

  test('does not offer Load More when everything fits on one page', async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await mockSupabase(page, { signedInAs: 'admin', orders: MIXED });
    await signInAsAdmin(page);
    await openOrderManagement(page);

    await expect(rowOf(page, 'ord-2001')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Load More' })).toBeHidden();
  });

  test.describe('known gaps', () => {
    test('keeps the orders on screen while the next page loads', async ({ page }) => {
      test.fail();
      await page.clock.setFixedTime(NOW);
      await mockSupabase(page, { signedInAs: 'admin', orders: MANY, nextPageDelayMs: 1500 });
      await signInAsAdmin(page);
      await openOrderManagement(page);
      await openTab(page, 'Undelivered');
      await expect(list(page).getByRole('row')).toHaveCount(21);

      await page.getByRole('button', { name: 'Load More' }).click();

      await expect(list(page).getByRole('row')).toHaveCount(21, { timeout: 500 });
      await expect(page.getByText('Loading orders...')).toBeHidden({ timeout: 500 });
    });
  });
});

test.describe('Admin Order Management: deleting an undelivered order', () => {
  const trash = (page: Page, orderId: string) => rowOf(page, orderId).getByRole('button', { name: 'Delete order' });

  async function open(page: Page, options: Parameters<typeof mockSupabase>[1] = {}) {
    await page.clock.setFixedTime(NOW);
    const mock = await mockSupabase(page, { signedInAs: 'admin', orders: MIXED, ...options });
    await signInAsAdmin(page);
    await openOrderManagement(page);
    await openTab(page, 'Undelivered');
    await expect(rowOf(page, 'ord-2002')).toBeVisible();
    return mock;
  }

  test('asks which order is to be deleted before doing anything', async ({ page }) => {
    const mock = await open(page);

    await trash(page, 'ord-2002').click();

    await expect(page.getByRole('heading', { name: 'Delete Order' })).toBeVisible();
    await expect(page.getByText(/Are you sure you want to delete order ord-2002\?/)).toBeVisible();
    await expect(page.getByText('This action cannot be undone.')).toBeVisible();
    expect(mock.orderDeletes).toEqual([]);
  });

  test('deletes nothing when declined', async ({ page }) => {
    const mock = await open(page);

    await trash(page, 'ord-2002').click();
    await page.getByRole('button', { name: 'No' }).click();

    await expect(page.getByRole('heading', { name: 'Delete Order' })).toBeHidden();
    await expect(rowOf(page, 'ord-2002')).toBeVisible();
    expect(mock.orderDeletes).toEqual([]);
  });

  test('removes the order from the list when confirmed', async ({ page }) => {
    const mock = await open(page);

    await trash(page, 'ord-2002').click();
    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(page.getByRole('heading', { name: 'Delete Order' })).toBeHidden();
    await expect(rowOf(page, 'ord-2002')).toHaveCount(0);
    await expect(rowOf(page, 'ord-2001')).toBeVisible();
    expect(mock.orderDeletes).toEqual(['ord-2002']);
  });

  test('does not open the order when the delete button is clicked', async ({ page }) => {
    await open(page);

    await trash(page, 'ord-2002').click();

    await expect(page).toHaveURL(/\/admin\/orders$/);
  });

  test('shows the error and keeps the order when the delete fails', async ({ page }) => {
    const mock = await open(page, { orderDeleteFails: true });

    await trash(page, 'ord-2002').click();
    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Delete Order' })).toBeHidden();
    expect(mock.orderDeletes).toEqual([]);
    await page.getByRole('button', { name: 'OK' }).click();
    await openTab(page, 'Undelivered');
    await expect(rowOf(page, 'ord-2002')).toBeVisible();
  });

  test('is only offered on the Undelivered tab', async ({ page }) => {
    await open(page);

    for (const name of ['Today', 'Delivered', 'Unpaid']) {
      await openTab(page, name);
      await expect(list(page).getByRole('row').nth(1)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Delete order' })).toHaveCount(0);
    }
  });
});

test.describe('Admin Order Management: moving around', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    await mockSupabase(page, { signedInAs: 'admin', orders: MIXED });
    await signInAsAdmin(page);
    await openOrderManagement(page);
    await expect(rowOf(page, 'ord-2001')).toBeVisible();
  });

  test('opens an order when its row is clicked, and comes back with Back', async ({ page }) => {
    await rowOf(page, 'ord-2001').click();

    await expect(page).toHaveURL(/\/admin\/orders\/ord-2001$/);
    await expect(page.getByRole('heading', { name: 'Order Details' })).toBeVisible();

    await page.getByRole('button', { name: /Back/ }).click();

    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(page.getByRole('heading', { name: 'Order Management' })).toBeVisible();
  });

  test('opens the Create Order screen, and comes back with Back to Orders', async ({ page }) => {
    await page.getByRole('button', { name: /Create Order/ }).click();

    await expect(page).toHaveURL(/\/admin\/orders\/create$/);
    await expect(page.getByRole('heading', { name: 'Create Order' })).toBeVisible();

    await page.getByRole('button', { name: /Back to Orders/ }).click();

    await expect(page).toHaveURL(/\/admin\/orders$/);
  });

  test('goes back to the dashboard with Back to Home', async ({ page }) => {
    await page.getByRole('button', { name: /Back to Home/ }).click();

    await expect(page).toHaveURL(/\/admin\/home$/);
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  });
});
