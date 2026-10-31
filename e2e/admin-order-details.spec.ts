import { expect, test, type Page } from '@playwright/test';
import { signInAsAdmin } from './support/admin';
import { mockSupabase, ORDERS, type MockOptions, type SupabaseMock } from './support/supabase-mock';

// A fixed mid-month morning: "today" is 2026-10-15.
const NOW = new Date(2026, 9, 15, 10, 0, 0);

// Ravi Kumar (emp-1) and Mohan Das (emp-3) are on the order; Anita Rao (emp-2) is not.
const EDITABLE = {
  ...ORDERS[0],
  id: 'ord-4001',
  delivery_date: '2026-10-20',
  brick_quantity: 5000,
  price_per_brick: 8,
  final_price: 40000,
  location: '12 MG Road, Coimbatore',
  loading_type: 'LOADING_UNLOADING',
  order_loadmen: [{ employee_id: 'emp-1' }, { employee_id: 'emp-3' }],
  customers: { name: 'Rajesh Kumar', phone: '9876543210' },
};

const DELIVERED = {
  ...ORDERS[0],
  id: 'ord-4002',
  delivered: true,
  delivery_date: '2026-10-10',
  brick_quantity: 3000,
  price_per_brick: 8,
  final_price: 24000,
  location: '45 Brigade Road, Erode',
  payment_status: 'PARTIALLY_PAID',
  amount_paid: 15000,
  gst_number: '33ABCDE1234F1Z5',
  dc_number: 'DC-77',
  loading_type: 'LOADING_ONLY',
  order_loadmen: [{ employee_id: 'emp-1' }],
  customers: { name: 'Priya Sharma', phone: '9876543211' },
};

const f = {
  quantity: (page: Page) => page.getByLabel(/^Brick Quantity/),
  price: (page: Page) => page.getByLabel(/^Price Per Brick/),
  paper: (page: Page) => page.getByLabel('Paper Price'),
  location: (page: Page) => page.getByLabel(/^Location/),
  finalPrice: (page: Page) => page.getByLabel(/^Final Price/),
  gst: (page: Page) => page.getByLabel(/^GST Number/),
  dc: (page: Page) => page.getByLabel(/^Delivery Challan Number/),
  loadType: (page: Page) => page.getByLabel('Load Type'),
  confirm: (page: Page) => page.getByRole('button', { name: /^(Confirm|Updating\.\.\.)$/ }),
};

const loadman = (page: Page, name: string) => page.getByRole('checkbox', { name });

async function openOrder(page: Page, tab: 'Undelivered' | 'Delivered', orderId: string, options: MockOptions = {}): Promise<SupabaseMock> {
  await page.clock.setFixedTime(NOW);
  const mock = await mockSupabase(page, { signedInAs: 'admin', orders: [EDITABLE, DELIVERED], ...options });
  await signInAsAdmin(page);
  await page.getByRole('button', { name: /Order Management/ }).click();
  await page.getByRole('button', { name: tab, exact: true }).click();
  await page.getByRole('table').getByRole('row', { name: new RegExp(orderId) }).click();
  return mock;
}

const openEditable = (page: Page, options: MockOptions = {}) => openOrder(page, 'Undelivered', 'ord-4001', options);

test.describe('Admin Order Details: an order that can be edited', () => {
  test.describe('showing the order', () => {
    test.beforeEach(async ({ page }) => {
      await openEditable(page);
      await expect(f.location(page)).toHaveValue('12 MG Road, Coimbatore');
    });

    test('shows who the order is for and what it is', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Order Details' })).toBeVisible();
      await expect(page.getByText('Edit order information - ord-4001')).toBeVisible();
      await expect(page.getByText('Customer: Rajesh Kumar')).toBeVisible();
      await expect(page.getByText('Phone: 9876543210')).toBeVisible();
      await expect(f.quantity(page)).toHaveValue('5000');
      await expect(f.price(page)).toHaveValue('8');
      await expect(f.finalPrice(page)).toHaveValue('40000');
      await expect(page.getByRole('button', { name: 'October 20th, 2026' })).toBeVisible();
      await expect(f.loadType(page)).toHaveValue('LOADING_UNLOADING');
      await expect(f.paper(page)).toHaveValue('₹40,000');
      await expect(page.getByText('Price per brick: ₹8.00')).toBeVisible();
    });

    test('ticks the loadmen already on the order', async ({ page }) => {
      await expect(loadman(page, 'Ravi Kumar')).toBeChecked();
      await expect(loadman(page, 'Mohan Das')).toBeChecked();
      await expect(loadman(page, 'Anita Rao')).not.toBeChecked();
      await expect(page.getByText('Selected: Mohan Das, Ravi Kumar')).toBeVisible();
    });

    test('has no payment fields and no delivered notice', async ({ page }) => {
      await expect(page.getByLabel('Payment Status')).toHaveCount(0);
      await expect(page.getByText('This order has been delivered and cannot be edited.')).toBeHidden();
    });

    test('works out the paper price again when the quantity changes', async ({ page }) => {
      await f.quantity(page).fill('6000');

      await expect(f.paper(page)).toHaveValue('₹48,000');
    });

    test('goes back to the orders list with Back', async ({ page }) => {
      await page.getByRole('button', { name: /Back/ }).click();

      await expect(page).toHaveURL(/\/admin\/orders$/);
      await expect(page.getByRole('heading', { name: 'Order Management' })).toBeVisible();
    });
  });

  test.describe('saving changes', () => {
    test('saves every change, then confirms and goes back to the orders list', async ({ page }) => {
      const mock = await openEditable(page);
      await expect(f.location(page)).toHaveValue('12 MG Road, Coimbatore');

      await f.quantity(page).fill('6000');
      await f.price(page).fill('9');
      await f.location(page).fill('45 Brigade Road, Erode');
      await f.finalPrice(page).fill('54000');
      await f.gst(page).fill('33abcde1234f1z5');
      await f.dc(page).fill('DC-101');
      await page.getByRole('button', { name: 'October 20th, 2026' }).click();
      await page.getByRole('gridcell', { name: '24', exact: true }).click();
      await f.loadType(page).selectOption('LOADING_ONLY');
      await loadman(page, 'Mohan Das').uncheck();
      await loadman(page, 'Anita Rao').check();
      await f.confirm(page).click();

      await expect(page.getByRole('heading', { name: 'Order Edited Successfully' })).toBeVisible();
      expect(mock.orderUpdates).toHaveLength(1);
      const { p_loadmen, ...rest } = mock.orderUpdates[0] as { p_loadmen: string[] };
      expect(rest).toEqual({
        p_order_id: 'ord-4001',
        p_skip_loadmen: false,
        p_update: {
          brick_quantity: 6000,
          delivery_date: '2026-10-24',
          price_per_brick: 9,
          location: '45 Brigade Road, Erode',
          final_price: 54000,
          payment_status: 'NOT_PAID',
          amount_paid: 0,
          gst_number: '33ABCDE1234F1Z5',
          dc_number: 'DC-101',
          loading_type: 'LOADING_ONLY',
        },
      });
      expect([...p_loadmen].sort()).toEqual(['emp-1', 'emp-2']);

      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page).toHaveURL(/\/admin\/orders$/);
      await expect(page.getByRole('heading', { name: 'Order Management' })).toBeVisible();
    });

    test('saves the order unchanged, keeping its loadmen', async ({ page }) => {
      const mock = await openEditable(page);
      await expect(f.location(page)).toHaveValue('12 MG Road, Coimbatore');

      await f.confirm(page).click();

      await expect(page.getByRole('heading', { name: 'Order Edited Successfully' })).toBeVisible();
      expect(mock.orderUpdates[0]).toMatchObject({
        p_update: { brick_quantity: 5000, location: '12 MG Road, Coimbatore', loading_type: 'LOADING_UNLOADING', gst_number: null },
      });
      expect([...(mock.orderUpdates[0].p_loadmen as string[])].sort()).toEqual(['emp-1', 'emp-3']);
    });

    test('shows why it failed, and keeps the changes for another try', async ({ page }) => {
      const mock = await openEditable(page, { orderUpdateFails: true });
      await expect(f.location(page)).toHaveValue('12 MG Road, Coimbatore');
      await f.location(page).fill('45 Brigade Road, Erode');

      await f.confirm(page).click();

      await expect(page.getByRole('heading', { name: 'Update Failed' })).toBeVisible();
      await expect(page.getByText('update failed').first()).toBeVisible();
      expect(mock.orderUpdates).toEqual([]);
      await expect(page.getByRole('heading', { name: 'Order Edited Successfully' })).toBeHidden();

      // A failed save shows two popups, one on top of the other; close the top one each time.
      while (await page.getByRole('button', { name: 'OK' }).count()) {
        await page.getByRole('button', { name: 'OK' }).last().click();
      }

      await expect(f.location(page)).toHaveValue('45 Brigade Road, Erode');
      await expect(f.confirm(page)).toBeEnabled();
      await expect(page).toHaveURL(/\/admin\/orders\/ord-4001$/);
    });
  });

  test.describe('validation', () => {
    test.beforeEach(async ({ page }) => {
      await openEditable(page);
      await expect(f.location(page)).toHaveValue('12 MG Road, Coimbatore');
    });

    test('lists every field that was cleared, and saves nothing', async ({ page }) => {
      await f.quantity(page).fill('');
      await f.price(page).fill('');
      await f.finalPrice(page).fill('');
      await f.location(page).fill('');

      await f.confirm(page).click();

      await expect(page.getByText('Brick quantity must be greater than 0')).toBeVisible();
      await expect(page.getByText('Price per brick must be greater than 0')).toBeVisible();
      await expect(page.getByText('Final price must be greater than 0')).toBeVisible();
      await expect(page.getByText('Delivery location is required')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Update Failed' })).toBeHidden();
      await expect(page.getByRole('heading', { name: 'Order Edited Successfully' })).toBeHidden();
    });

    test('rejects a GST number that is not 15 characters', async ({ page }) => {
      await f.gst(page).fill('33ABCDE12');

      await f.confirm(page).click();

      await expect(page.getByText('GST Number must be exactly 15 characters')).toBeVisible();
    });

    test('saves once the problem is fixed', async ({ page }) => {
      await f.location(page).fill('');
      await f.confirm(page).click();
      await expect(page.getByText('Delivery location is required')).toBeVisible();

      await f.location(page).fill('45 Brigade Road, Erode');
      await f.confirm(page).click();

      await expect(page.getByRole('heading', { name: 'Order Edited Successfully' })).toBeVisible();
    });

    test('does not let a day before today be picked as the delivery date', async ({ page }) => {
      await page.getByRole('button', { name: 'October 20th, 2026' }).click();

      await expect(page.getByRole('gridcell', { name: '14', exact: true })).toBeDisabled();
      await expect(page.getByRole('gridcell', { name: '15', exact: true })).toBeEnabled();
    });
  });

  test.describe('the loadmen and the load type', () => {
    test('removes all the loadmen when the order is switched to customer self loading', async ({ page }) => {
      const mock = await openEditable(page);
      await expect(loadman(page, 'Ravi Kumar')).toBeChecked();
      await expect(loadman(page, 'Mohan Das')).toBeChecked();

      await f.loadType(page).selectOption('CUSTOMER_SELF');
      await expect(loadman(page, 'Ravi Kumar')).toBeHidden();
      await f.confirm(page).click();

      await expect(page.getByRole('heading', { name: 'Order Edited Successfully' })).toBeVisible();
      expect(mock.orderUpdates).toHaveLength(1);
      expect(mock.orderUpdates[0]).toMatchObject({
        p_order_id: 'ord-4001',
        p_update: { loading_type: 'CUSTOMER_SELF' },
        p_loadmen: [],
      });
    });

    test('does not bring the old loadmen back when switched away from customer self loading and back', async ({ page }) => {
      await openEditable(page);
      await expect(loadman(page, 'Ravi Kumar')).toBeChecked();

      await f.loadType(page).selectOption('CUSTOMER_SELF');
      await f.loadType(page).selectOption('LOADING_ONLY');

      await expect(loadman(page, 'Ravi Kumar')).not.toBeChecked();
      await expect(loadman(page, 'Mohan Das')).not.toBeChecked();
      await expect(page.getByText(/^Selected:/)).toBeHidden();
    });

    test('keeps the loadmen when the order is switched to another loading type', async ({ page }) => {
      const mock = await openEditable(page);
      await expect(loadman(page, 'Ravi Kumar')).toBeChecked();

      await f.loadType(page).selectOption('LOADING_ONLY');
      await f.confirm(page).click();

      await expect(page.getByRole('heading', { name: 'Order Edited Successfully' })).toBeVisible();
      expect(mock.orderUpdates[0]).toMatchObject({ p_update: { loading_type: 'LOADING_ONLY' } });
      expect([...(mock.orderUpdates[0].p_loadmen as string[])].sort()).toEqual(['emp-1', 'emp-3']);
    });

    test('saves none when every loadman is unticked', async ({ page }) => {
      const mock = await openEditable(page);
      await expect(loadman(page, 'Ravi Kumar')).toBeChecked();

      await loadman(page, 'Ravi Kumar').uncheck();
      await loadman(page, 'Mohan Das').uncheck();
      await f.confirm(page).click();

      await expect(page.getByRole('heading', { name: 'Order Edited Successfully' })).toBeVisible();
      expect(mock.orderUpdates[0]).toMatchObject({ p_loadmen: [] });
    });

    test('tells the administrator when the staff cannot be loaded', async ({ page }) => {
      await openEditable(page, { adminListsFail: true });

      await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible();
      await expect(page.getByText('Failed to load loadmen details')).toBeVisible();
    });
  });
});

test.describe('Admin Order Details: a delivered order', () => {
  test.beforeEach(async ({ page }) => {
    await openOrder(page, 'Delivered', 'ord-4002');
    await expect(page.getByText('View order information - ord-4002')).toBeVisible();
  });

  test('is read-only, with a notice and no Confirm button', async ({ page }) => {
    await expect(page.getByText('This order has been delivered and cannot be edited.')).toBeVisible();
    await expect(page.getByText('Delivered', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm' })).toHaveCount(0);
  });

  test('disables every field', async ({ page }) => {
    for (const field of [f.quantity(page), f.price(page), f.location(page), f.finalPrice(page), f.gst(page), f.dc(page), f.loadType(page)]) {
      await expect(field).toBeDisabled();
    }
    await expect(page.getByRole('button', { name: /October 10th, 2026/ })).toBeDisabled();
  });

  test('shows what the order was delivered with', async ({ page }) => {
    await expect(f.quantity(page)).toHaveValue('3000');
    await expect(f.location(page)).toHaveValue('45 Brigade Road, Erode');
    await expect(f.gst(page)).toHaveValue('33ABCDE1234F1Z5');
    await expect(f.dc(page)).toHaveValue('DC-77');
    await expect(f.loadType(page)).toHaveValue('LOADING_ONLY');
    await expect(page.getByLabel('Payment Status')).toHaveValue('PARTIALLY_PAID');
    await expect(page.getByLabel('Amount Paid')).toHaveValue('15000');
  });

  test('shows who loaded it, and does not let them be changed', async ({ page }) => {
    await expect(loadman(page, 'Ravi Kumar')).toBeChecked();
    await expect(loadman(page, 'Ravi Kumar')).toBeDisabled();
    await expect(loadman(page, 'Anita Rao')).toBeDisabled();
    await expect(page.getByText('Selected: Ravi Kumar')).toBeVisible();
  });
});

test.describe('Admin Order Details: when the order cannot be loaded', () => {
  test('shows an error popup', async ({ page }) => {
    await openOrder(page, 'Undelivered', 'ord-4001', { orderFails: true });

    await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible();
    await expect(page.getByText('Failed to load order details')).toBeVisible();

    await page.getByRole('button', { name: 'OK' }).click();

    await expect(page.getByRole('heading', { name: 'Error' })).toBeHidden();
  });
});

test.describe('Admin Order Details: known gaps', () => {
  // One failed save puts an "Error" popup and an "Update Failed" popup on screen, one on top of the other.
  test('shows a single popup when saving fails', async ({ page }) => {
    test.fail();
    await openEditable(page, { orderUpdateFails: true });
    await expect(f.location(page)).toHaveValue('12 MG Road, Coimbatore');

    await f.confirm(page).click();

    await expect(page.getByRole('heading', { name: 'Update Failed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'OK' })).toHaveCount(1, { timeout: 1_000 });
  });
});
