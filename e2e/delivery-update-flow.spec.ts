import { expect, test, type Page } from '@playwright/test';
import { signInAsEmployee } from './support/employee';
import { mockSupabase } from './support/supabase-mock';

// Updating an order: the whole trip from the Undelivered Orders list to a recorded delivery,
// and the details of what gets recorded. The form itself is covered in delivery-entry.spec.ts.

const NOW = new Date(2026, 9, 15, 10, 0, 0);

const time = (page: Page) => page.getByLabel(/^Time/);
const location = (page: Page) => page.getByLabel(/^Location/);
const challan = (page: Page) => page.getByLabel(/^Delivery Challan Number/);
const loadingType = (page: Page) => page.getByLabel(/^Loading Type/);
const submit = (page: Page) => page.getByRole('button', { name: /^Submit/ });
const loadman = (page: Page, name: string) => page.getByRole('checkbox', { name, exact: true });
const card = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(name) });

async function goToOrders(page: Page) {
  await page.getByRole('button', { name: /Delivery Entry/ }).click();
  await expect(page.getByRole('heading', { name: 'Undelivered Orders' })).toBeVisible();
}

async function openDelivery(page: Page, orderId: string) {
  await page.goto(`/employee/orders/${orderId}/delivery`);
  await expect(page.getByLabel('Order ID')).toHaveValue(orderId);
  await expect(loadman(page, 'Ravi')).toBeVisible();
}

async function fillRequired(page: Page, dc = 'DC-1') {
  await time(page).selectOption('10:00 AM');
  await challan(page).fill(dc);
}

async function deliverFromList(page: Page, customer: string, dc: string) {
  await card(page, customer).click();
  await expect(page.getByLabel('Customer Name')).toHaveValue(customer);
  await expect(loadman(page, 'Ravi')).toBeVisible();
  await fillRequired(page, dc);
  await loadman(page, 'Ravi').check();
  await submit(page).click();
  await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
  await page.getByRole('button', { name: 'OK' }).click();
  await expect(page).toHaveURL(/\/employee\/home$/);
}

test.describe('Updating an order from the Undelivered Orders list', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
  });

  test.describe('the whole journey', () => {
    test('Home, then the list, then an order, then a recorded delivery, then back to Home', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);

      await goToOrders(page);
      await card(page, 'Priya Sharma').click();
      await expect(page).toHaveURL(/\/employee\/orders\/ord-1002\/delivery$/);
      await expect(page.getByLabel('Customer Name')).toHaveValue('Priya Sharma');
      await expect(loadman(page, 'Ravi')).toBeVisible();
      await fillRequired(page, 'DC-2002');
      await loadman(page, 'Ravi').check();
      await submit(page).click();
      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page).toHaveURL(/\/employee\/home$/);
      expect(mock.deliveries).toHaveLength(1);
      expect(mock.deliveries[0].args).toMatchObject({ p_order_id: 'ord-1002', p_dc_number: 'DC-2002' });
      expect(mock.unexpected).toEqual([]);
    });

    test('a delivered order leaves the list, and the other order stays', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await goToOrders(page);
      await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Rajesh Kumar', 'Priya Sharma']);
      await page.getByRole('button', { name: /Back to Home/ }).click();

      await page.getByRole('button', { name: /Delivery Entry/ }).click();
      await card(page, 'Priya Sharma').click();
      await expect(loadman(page, 'Ravi')).toBeVisible();
      await fillRequired(page);
      await loadman(page, 'Ravi').check();
      await submit(page).click();
      await page.getByRole('button', { name: 'OK' }).click();
      await goToOrders(page);

      await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Rajesh Kumar']);
    });

    test('delivering every order leaves the list empty', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);

      await goToOrders(page);
      await page.getByRole('button', { name: /Back to Home/ }).click();
      await page.getByRole('button', { name: /Delivery Entry/ }).click();
      await deliverFromList(page, 'Rajesh Kumar', 'DC-1');
      await page.getByRole('button', { name: /Delivery Entry/ }).click();
      await deliverFromList(page, 'Priya Sharma', 'DC-2');
      await goToOrders(page);

      await expect(page.getByText('No orders assigned for delivery.')).toBeVisible();
    });

    test('a delivered order opens view-only with exactly what was recorded', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await goToOrders(page);
      await deliverFromList(page, 'Rajesh Kumar', 'DC-9001');

      await openDelivery(page, 'ord-1001');

      await expect(page.getByText('This order has been delivered and cannot be edited.')).toBeVisible();
      await expect(page.getByText('Delivered', { exact: true })).toBeVisible();
      await expect(time(page)).toHaveValue('10:00 AM');
      await expect(challan(page)).toHaveValue('DC-9001');
      await expect(loadman(page, 'Ravi')).toBeChecked();
      await expect(submit(page)).toBeHidden();
    });

    test('a failed update leaves the order in the list', async ({ page }) => {
      await mockSupabase(page, { deliveryFails: true });
      await signInAsEmployee(page);
      await goToOrders(page);
      await card(page, 'Rajesh Kumar').click();
      await expect(loadman(page, 'Ravi')).toBeVisible();
      await fillRequired(page);
      await loadman(page, 'Ravi').check();
      await submit(page).click();
      await expect(page.getByText('Delivery Entry Failed')).toBeVisible();
      await page.getByRole('button', { name: 'OK' }).click();

      await page.getByRole('button', { name: /Back to Orders/ }).click();

      await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Rajesh Kumar', 'Priya Sharma']);
    });

    test('opening a second order after the first shows the second order\'s details, not leftovers', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await goToOrders(page);
      await card(page, 'Rajesh Kumar').click();
      await expect(loadman(page, 'Ravi')).toBeVisible();
      await fillRequired(page, 'DC-LEFTOVER');
      await loadman(page, 'Ravi').check();
      await page.getByRole('button', { name: /Back to Orders/ }).click();

      await card(page, 'Priya Sharma').click();

      await expect(page.getByLabel('Order ID')).toHaveValue('ord-1002');
      await expect(page.getByLabel('Customer Name')).toHaveValue('Priya Sharma');
      await expect(location(page)).toHaveValue('45 Brigade Road, Erode');
      await expect(challan(page)).toHaveValue('');
      await expect(time(page)).toHaveValue('');
      await expect(loadman(page, 'Ravi')).not.toBeChecked();
    });

    test('going back to the list and returning starts a fresh form', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await goToOrders(page);
      await card(page, 'Rajesh Kumar').click();
      await fillRequired(page, 'DC-TYPED');
      await page.getByRole('button', { name: /Back to Orders/ }).click();

      await card(page, 'Rajesh Kumar').click();

      await expect(challan(page)).toHaveValue('');
      await expect(time(page)).toHaveValue('');
    });

    test('reloading the page keeps the order but not what was typed', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-1001');
      await fillRequired(page, 'DC-TYPED');

      await page.reload();

      await expect(page.getByLabel('Customer Name')).toHaveValue('Rajesh Kumar');
      await expect(challan(page)).toHaveValue('');
    });
  });

  test.describe('what gets recorded', () => {
    test('a fully paid order records its full amount as paid', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-0888');
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].args).toMatchObject({ p_payment_status: 'FULLY_PAID', p_amount_paid: 24000 });
    });

    test('a part-paid order keeps the amount already paid', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-0889');
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].args).toMatchObject({ p_payment_status: 'PARTIALLY_PAID', p_amount_paid: 9000 });
    });

    test('an unpaid order records nothing as paid', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-1001');
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].args).toMatchObject({ p_payment_status: 'NOT_PAID', p_amount_paid: 0 });
    });

    test('an order that already has delivery details starts with them filled in and can be saved as it is', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-0555');

      await expect(time(page)).toHaveValue('02:00 PM');
      await expect(challan(page)).toHaveValue('DC-5');
      await expect(loadingType(page)).toHaveValue('LOADING_ONLY');
      await expect(loadman(page, 'Kumar')).toBeChecked();
      await expect(page.getByText('Selected: Kumar')).toBeVisible();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].fn).toBe('complete_delivery_with_wages');
      expect(mock.deliveries[0].args).toMatchObject({
        p_order_id: 'ord-0555',
        p_time: '02:00 PM',
        p_dc_number: 'DC-5',
        p_loading_type: 'LOADING_ONLY',
        p_loadmen: ['emp-kumar'],
        p_wage_loadmen: ['emp-kumar'],
        p_wage_amount: 2500, // 2500 bricks x 2 x half for loading only, to one person
      });
    });

    for (const slot of ['12:00 AM', '06:00 AM', '12:00 PM', '11:00 PM']) {
      test(`the ${slot} time slot is recorded as chosen`, async ({ page }) => {
        const mock = await mockSupabase(page);
        await signInAsEmployee(page);
        await openDelivery(page, 'ord-1001');
        await time(page).selectOption(slot);
        await challan(page).fill('DC-T');
        await loadman(page, 'Ravi').check();

        await submit(page).click();

        await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
        expect(mock.deliveries[0].args).toMatchObject({ p_time: slot });
      });
    }

    test('quotes, symbols, other scripts and long text in the location and challan number are saved exactly', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-1001');
      const place = `Gate "B" & O'Neil Nagar / கோவை — ${'x'.repeat(200)}`;
      await time(page).selectOption('10:00 AM');
      await location(page).fill(place);
      await challan(page).fill('DC/2026-10 #7 (copy)');
      await loadman(page, 'Ravi').check();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].args).toMatchObject({ p_location: place, p_dc_number: 'DC/2026-10 #7 (copy)' });
    });

    test('pressing Enter in a field does not submit the form', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-1001');
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      await challan(page).press('Enter');

      await expect(page.getByText('Delivery Entry Successful')).toBeHidden();
      expect(mock.deliveries).toHaveLength(0);
    });
  });

  test.describe('loader wages', () => {
    test('one load man earns the whole amount', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-1001');
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].args).toMatchObject({ p_wage_loadmen: ['emp-ravi'], p_wage_amount: 10000 });
    });

    test('the amount follows the price per brick set up in the app settings', async ({ page }) => {
      const mock = await mockSupabase(page, { pricePerBrick: '0.5' });
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-1001');
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].args).toMatchObject({ p_wage_amount: 2500 });
    });

    test('with three selected and one earning no loading wages, each paid person gets a third', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-1001');
      await fillRequired(page);
      for (const name of ['Ravi', 'Kumar', 'Operator Ram']) await loadman(page, name).check();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      const args = mock.deliveries[0].args;
      expect(args.p_loadmen).toEqual(['emp-ravi', 'emp-kumar', 'emp-ram']);
      expect(args.p_wage_loadmen).toEqual(['emp-ravi', 'emp-kumar']);
      expect(args.p_wage_amount as number).toBeCloseTo(10000 / 3, 5);
    });

    for (const [label, value] of [
      ['zero', '0'],
      ['negative', '-3'],
      ['not a number', 'abc'],
    ]) {
      test(`a price per brick that is ${label} stops a delivery with paid load men`, async ({ page }) => {
        const mock = await mockSupabase(page, { pricePerBrick: value });
        await signInAsEmployee(page);
        await openDelivery(page, 'ord-1001');
        await fillRequired(page);
        await loadman(page, 'Ravi').check();

        await submit(page).click();

        await expect(page.getByText('Delivery Entry Failed')).toBeVisible();
        expect(mock.deliveries).toHaveLength(0);
      });
    }

    test('a customer-loaded delivery is not held up by a missing price per brick', async ({ page }) => {
      const mock = await mockSupabase(page, { pricePerBrick: 'missing' });
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-1001');
      await fillRequired(page);
      await loadingType(page).selectOption('CUSTOMER_SELF');

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].fn).toBe('complete_delivery');
    });
  });

  test.describe('while saving', () => {
    test('shows Submitting... and blocks the button until the save finishes', async ({ page }) => {
      const mock = await mockSupabase(page, { deliveryDelayMs: 1200 });
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-1001');
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      await submit(page).click();

      const busy = page.getByRole('button', { name: 'Submitting...' });
      await expect(busy).toBeVisible();
      await expect(busy).toBeDisabled();
      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries).toHaveLength(1);
    });
  });

  test.describe('details that come from the order', () => {
    test('an order with no quantity says why it cannot be submitted', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-0666');
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      await submit(page).click();

      await expect(page.getByText('Quantity must be greater than 0')).toBeVisible();
      expect(mock.deliveries).toHaveLength(0);
    });

    test('an order number that does not exist shows a load error and a way back', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);

      await page.goto('/employee/orders/ord-does-not-exist/delivery');

      await expect(page.getByRole('alert')).toContainText('Failed to load order details');
      await page.getByRole('button', { name: /Back to Orders/ }).click();
      await expect(page).toHaveURL(/\/employee\/orders$/);
    });
  });

  test.describe('when the staff list cannot be loaded', () => {
    test('says so, and a customer-loaded delivery can still be recorded', async ({ page }) => {
      const mock = await mockSupabase(page, { staffFails: true });
      await signInAsEmployee(page);
      await page.goto('/employee/orders/ord-1001/delivery');
      await expect(page.getByLabel('Order ID')).toHaveValue('ord-1001');

      await expect(page.getByRole('alert')).toContainText('Failed to load the delivery staff');
      await expect(page.getByRole('checkbox')).toHaveCount(0);

      await fillRequired(page);
      await loadingType(page).selectOption('CUSTOMER_SELF');
      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].fn).toBe('complete_delivery');
    });
  });

  test.describe('who can reach the update screen', () => {
    test('a signed-out visitor is sent to the login screen', async ({ page }) => {
      await mockSupabase(page);

      await page.goto('/employee/orders/ord-1001/delivery');

      await expect(page).toHaveURL(/\/employee\/login$/);
    });

    test('signing in is enough to reach it afterwards, by direct link', async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);

      await openDelivery(page, 'ord-1001');

      await expect(page.getByRole('heading', { name: 'Delivery Entry' })).toBeVisible();
    });

    test('if the session ends while the form is open, the employee is sent to login and nothing is saved', async ({ page, context }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-1001');
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      const other = await context.newPage();
      await mockSupabase(other);
      await other.goto('/employee/home');
      await other.getByRole('button', { name: 'Logout' }).click();

      await expect(page).toHaveURL(/\/employee\/login$/);
      expect(mock.deliveries).toHaveLength(0);
    });
  });

  test.describe('on a phone', () => {
    test('the update can be completed at phone width', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await goToOrders(page);
      await card(page, 'Rajesh Kumar').click();
      await expect(loadman(page, 'Ravi')).toBeVisible();
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      await submit(page).scrollIntoViewIfNeeded();
      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries).toHaveLength(1);
    });

    test('no part of the form is cut off sideways', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-1001');

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
});
