import { expect, test, type Page } from '@playwright/test';
import { signInAsEmployee } from './support/employee';
import { mockSupabase, type SupabaseMock } from './support/supabase-mock';

const NOW = new Date(2026, 9, 15, 10, 0, 0);

const time = (page: Page) => page.getByLabel(/^Time/);
const location = (page: Page) => page.getByLabel(/^Location/);
const challan = (page: Page) => page.getByLabel(/^Delivery Challan Number/);
const loadingType = (page: Page) => page.getByLabel(/^Loading Type/);
const submit = (page: Page) => page.getByRole('button', { name: /^Submit/ });
const loadman = (page: Page, name: string) => page.getByRole('checkbox', { name, exact: true });

async function openDelivery(page: Page, orderId = 'ord-1001') {
  await page.goto(`/employee/orders/${orderId}/delivery`);
  await expect(page.getByLabel('Order ID')).toHaveValue(orderId);
  await expect(loadman(page, 'Ravi')).toBeVisible();
}

async function fillRequired(page: Page) {
  await time(page).selectOption('10:00 AM');
  await challan(page).fill('DC-1');
}

test.describe('Delivery Entry screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
  });

  test.describe('what is shown', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page);
    });

    test('shows the order\'s fixed details in read-only fields', async ({ page }) => {
      await expect(page.getByText('Enter the delivery details')).toBeVisible();
      for (const [label, value] of [
        ['Order ID', 'ord-1001'],
        ['Customer Number', '9876543210'],
        ['Customer Name', 'Rajesh Kumar'],
        ['Date', '2026-10-15'],
        ['Quantity (bricks)', '5000'],
        ['Actual Amount', '₹40000'],
      ]) {
        await expect(page.getByLabel(label)).toHaveValue(value);
        await expect(page.getByLabel(label)).toBeDisabled();
      }
      expect(mock.unexpected).toEqual([]);
    });

    test('starts the editable fields from what the order already holds', async ({ page }) => {
      await expect(location(page)).toHaveValue('12 MG Road, Coimbatore');
      await expect(time(page)).toHaveValue('');
      await expect(challan(page)).toHaveValue('');
      await expect(loadingType(page)).toHaveValue('LOADING_UNLOADING');
    });

    test('offers 24 hourly time slots and three loading types', async ({ page }) => {
      await expect(time(page).locator('option')).toHaveCount(25);
      await expect(time(page).locator('option').nth(13)).toHaveText('12:00 PM');
      await expect(loadingType(page).locator('option')).toHaveText([
        'Loading and Unloading',
        'Loading Only',
        'Customer Self Loading',
      ]);
    });

    test('lists the delivery staff, none ticked at first', async ({ page }) => {
      for (const name of ['Ravi', 'Kumar', 'Operator Ram']) await expect(loadman(page, name)).not.toBeChecked();
    });

    test('ticking load men shows who is selected, and unticking removes them', async ({ page }) => {
      await loadman(page, 'Ravi').check();
      await loadman(page, 'Kumar').check();
      await expect(page.getByText('Selected: Ravi, Kumar')).toBeVisible();

      await loadman(page, 'Ravi').uncheck();

      await expect(page.getByText('Selected: Kumar')).toBeVisible();
    });

    test('hides the load man list for customer self loading and brings it back after', async ({ page }) => {
      await loadman(page, 'Ravi').check();

      await loadingType(page).selectOption('CUSTOMER_SELF');
      await expect(loadman(page, 'Ravi')).toBeHidden();

      await loadingType(page).selectOption('LOADING_ONLY');
      await expect(loadman(page, 'Ravi')).toBeChecked();
    });

    test('Back to Orders returns to the list', async ({ page }) => {
      await page.getByRole('button', { name: /Back to Orders/ }).click();

      await expect(page).toHaveURL(/\/employee\/orders$/);
    });
  });

  test.describe('validation', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page);
    });

    test('lists every missing required detail and records nothing', async ({ page }) => {
      await location(page).fill('');

      await submit(page).click();

      await expect(page.getByText('Time is required')).toBeVisible();
      await expect(page.getByText('Location is required')).toBeVisible();
      await expect(page.getByText('Delivery challan number is required')).toBeVisible();
      await expect(page.getByText('At least one load man must be selected')).toBeVisible();
      await expect(page).toHaveURL(/delivery$/);
      expect(mock.deliveries).toHaveLength(0);
    });

    test('a location or challan number of only spaces counts as missing', async ({ page }) => {
      await fillRequired(page);
      await loadman(page, 'Ravi').check();
      await location(page).fill('    ');
      await challan(page).fill('   ');

      await submit(page).click();

      await expect(page.getByText('Location is required')).toBeVisible();
      await expect(page.getByText('Delivery challan number is required')).toBeVisible();
      expect(mock.deliveries).toHaveLength(0);
    });

    test('a load man is needed for loading only as well', async ({ page }) => {
      await fillRequired(page);
      await loadingType(page).selectOption('LOADING_ONLY');

      await submit(page).click();

      await expect(page.getByText('At least one load man must be selected')).toBeVisible();
      expect(mock.deliveries).toHaveLength(0);
    });

    test('no load man is needed when the customer loads for themselves', async ({ page }) => {
      await fillRequired(page);
      await loadingType(page).selectOption('CUSTOMER_SELF');

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].fn).toBe('complete_delivery');
    });

    test('fixing the problems and pressing Submit again clears the errors and saves', async ({ page }) => {
      await submit(page).click();
      await expect(page.getByText('Time is required')).toBeVisible();

      await fillRequired(page);
      await loadman(page, 'Ravi').check();
      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      await expect(page.getByText('Time is required')).toBeHidden();
    });
  });

  test.describe('saving', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page);
    });

    test('records the delivery and the wages in one call, then OK returns to the dashboard', async ({ page }) => {
      await fillRequired(page);
      await location(page).fill('Gate 3, Salem Road');
      await loadman(page, 'Ravi').check();
      await loadman(page, 'Kumar').check();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      await expect(page.getByText('Delivery details have been recorded successfully.')).toBeVisible();
      expect(mock.deliveries).toHaveLength(1);
      expect(mock.deliveries[0].fn).toBe('complete_delivery_with_wages');
      expect(mock.deliveries[0].args).toMatchObject({
        p_order_id: 'ord-1001',
        p_time: '10:00 AM',
        p_brick_quantity: 5000,
        p_location: 'Gate 3, Salem Road',
        p_payment_status: 'NOT_PAID',
        p_amount_paid: 0,
        p_gst_number: null,
        p_dc_number: 'DC-1',
        p_loading_type: 'LOADING_UNLOADING',
        p_loadmen: ['emp-ravi', 'emp-kumar'],
        p_wage_loadmen: ['emp-ravi', 'emp-kumar'],
        p_wage_amount: 5000, // 5000 bricks x 2 / 2 people
        p_wage_notes: 'Auto salary entry for delivery of order #ord-1001',
      });

      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page).toHaveURL(/\/employee\/home$/);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('pays half for loading only', async ({ page }) => {
      await fillRequired(page);
      await loadman(page, 'Ravi').check();
      await loadman(page, 'Kumar').check();
      await loadingType(page).selectOption('LOADING_ONLY');

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].args).toMatchObject({ p_loading_type: 'LOADING_ONLY', p_wage_amount: 2500 });
    });

    test('does not pay staff whose role earns no loading wages, but still counts them in the split', async ({ page }) => {
      await fillRequired(page);
      await loadman(page, 'Ravi').check();
      await loadman(page, 'Operator Ram').check();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].args).toMatchObject({
        p_loadmen: ['emp-ravi', 'emp-ram'],
        p_wage_loadmen: ['emp-ravi'],
        p_wage_amount: 5000,
      });
    });

    test('records the delivery with no wages when nobody selected earns any', async ({ page }) => {
      await fillRequired(page);
      await loadman(page, 'Operator Ram').check();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].fn).toBe('complete_delivery');
      expect(mock.deliveries[0].args).toMatchObject({ p_loadmen: ['emp-ram'] });
      expect(mock.deliveries[0].args).not.toHaveProperty('p_wage_loadmen');
    });

    test('sends the order\'s GST number along', async ({ page }) => {
      await page.goto('/employee/orders/ord-1002/delivery');
      await expect(page.getByLabel('Order ID')).toHaveValue('ord-1002');
      await expect(loadman(page, 'Ravi')).toBeVisible();
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].args).toMatchObject({ p_order_id: 'ord-1002', p_gst_number: '33ABCDE1234F1Z5' });
    });

    test('records exactly one delivery even if Submit is pressed repeatedly', async ({ page }) => {
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      await submit(page).dblclick();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries).toHaveLength(1);
    });

    test('makes no unexpected backend calls', async ({ page }) => {
      await fillRequired(page);
      await loadman(page, 'Ravi').check();
      await submit(page).click();
      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();

      expect(mock.unexpected).toEqual([]);
    });
  });

  test.describe('when the backend is not ready', () => {
    test('refuses to record a delivery with paid load men when the price per brick is not set up', async ({ page }) => {
      const mock = await mockSupabase(page, { pricePerBrick: 'missing' });
      await signInAsEmployee(page);
      await openDelivery(page);
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Failed')).toBeVisible();
      await expect(page.getByText('Failed to update delivery')).toBeVisible();
      expect(mock.deliveries).toHaveLength(0);
    });

    test('still records a delivery with no paid load men when the price per brick is not set up', async ({ page }) => {
      const mock = await mockSupabase(page, { pricePerBrick: 'missing' });
      await signInAsEmployee(page);
      await openDelivery(page);
      await fillRequired(page);
      await loadman(page, 'Operator Ram').check();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries).toHaveLength(1);
    });

    test('a failed save shows an error popup and keeps the form so the employee can retry', async ({ page }) => {
      const mock = await mockSupabase(page, { deliveryFails: true });
      await signInAsEmployee(page);
      await openDelivery(page);
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Failed')).toBeVisible();
      await expect(page.getByText('Failed to update delivery')).toBeVisible();
      expect(mock.deliveries).toHaveLength(0);

      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page).toHaveURL(/delivery$/);
      await expect(time(page)).toHaveValue('10:00 AM');
      await expect(challan(page)).toHaveValue('DC-1');
      await expect(loadman(page, 'Ravi')).toBeChecked();
      await expect(submit(page)).toBeEnabled();
    });

    test('the employee can record the delivery after an earlier failure', async ({ page }) => {
      const mock = await mockSupabase(page, { deliveryFails: true });
      await signInAsEmployee(page);
      await openDelivery(page);
      await fillRequired(page);
      await loadman(page, 'Ravi').check();
      await submit(page).click();
      await page.getByRole('button', { name: 'OK' }).click();

      // The backend recovers: a route registered later takes precedence over the failing one.
      await page.route('**/rest/v1/rpc/complete_delivery_with_wages', async (route) => {
        mock.deliveries.push({ fn: 'complete_delivery_with_wages', args: route.request().postDataJSON() });
        await route.fulfill({
          status: 200,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-headers': '*',
            'content-type': 'application/json',
          },
          body: 'null',
        });
      });
      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries).toHaveLength(1);
    });
  });

  test.describe('an order that is already delivered', () => {
    test.beforeEach(async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-0999');
    });

    test('is shown view-only, with the customer and a Delivered badge', async ({ page }) => {
      await expect(page.getByText('View delivery information')).toBeVisible();
      await expect(page.getByText('This order has been delivered and cannot be edited.')).toBeVisible();
      await expect(page.getByText('Customer: Anita Rao')).toBeVisible();
      await expect(page.getByText('Phone: 9876543299')).toBeVisible();
      await expect(page.getByText('Delivered', { exact: true })).toBeVisible();
    });

    test('shows the recorded delivery details', async ({ page }) => {
      await expect(time(page)).toHaveValue('10:00 AM');
      await expect(challan(page)).toHaveValue('DC-77');
      await expect(loadingType(page)).toHaveValue('LOADING_ONLY');
      await expect(loadman(page, 'Ravi')).toBeChecked();
      await expect(page.getByText('Selected: Ravi')).toBeVisible();
    });

    test('locks every field and every load man, and has no Submit button', async ({ page }) => {
      for (const field of [time(page), location(page), challan(page), loadingType(page)]) {
        await expect(field).toBeDisabled();
      }
      for (const name of ['Ravi', 'Kumar', 'Operator Ram']) await expect(loadman(page, name)).toBeDisabled();
      await expect(submit(page)).toBeHidden();
    });
  });

  test.describe('when the customer loads for themselves', () => {
    test('assigns no load men and pays no wages, even if some were ticked before switching', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page);
      await fillRequired(page);
      await loadman(page, 'Ravi').check();
      await loadman(page, 'Kumar').check();
      await loadingType(page).selectOption('CUSTOMER_SELF');

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries).toHaveLength(1);
      expect(mock.deliveries[0].fn).toBe('complete_delivery');
      expect(mock.deliveries[0].args).toMatchObject({ p_loading_type: 'CUSTOMER_SELF', p_loadmen: [] });
      expect(mock.deliveries[0].args).not.toHaveProperty('p_wage_loadmen');
    });

    test('still pays wages if the type is switched back before saving', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page);
      await fillRequired(page);
      await loadman(page, 'Ravi').check();
      await loadingType(page).selectOption('CUSTOMER_SELF');
      await loadingType(page).selectOption('LOADING_UNLOADING');

      await submit(page).click();

      await expect(page.getByText('Delivery Entry Successful')).toBeVisible();
      expect(mock.deliveries[0].fn).toBe('complete_delivery_with_wages');
      expect(mock.deliveries[0].args).toMatchObject({ p_loadmen: ['emp-ravi'], p_wage_loadmen: ['emp-ravi'] });
    });
  });

  test.describe('when the order cannot be loaded', () => {
    test('tells the employee, instead of showing an empty form, and offers a way back', async ({ page }) => {
      await mockSupabase(page, { orderFails: true });
      await signInAsEmployee(page);

      await page.goto('/employee/orders/ord-1001/delivery');

      await expect(page.getByRole('alert')).toContainText('Failed to load order details');
      await expect(page.getByLabel('Order ID')).toBeHidden();
      await expect(submit(page)).toBeHidden();
      await page.getByRole('button', { name: /Back to Orders/ }).click();
      await expect(page).toHaveURL(/\/employee\/orders$/);
    });
  });

  test.describe('errors clear as the field is corrected', () => {
    test.beforeEach(async ({ page }) => {
      await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page);
      await location(page).fill('');
      await submit(page).click();
    });

    test('each error disappears as soon as its field is corrected, and the others stay', async ({ page }) => {
      await expect(page.getByText('Time is required')).toBeVisible();

      await time(page).selectOption('09:00 AM');
      await expect(page.getByText('Time is required')).toBeHidden();
      await expect(page.getByText('Location is required')).toBeVisible();

      await location(page).fill('Gate 3');
      await expect(page.getByText('Location is required')).toBeHidden();
      await expect(page.getByText('Delivery challan number is required')).toBeVisible();

      await challan(page).fill('DC-9');
      await expect(page.getByText('Delivery challan number is required')).toBeHidden();
      await expect(page.getByText('At least one load man must be selected')).toBeVisible();

      await loadman(page, 'Ravi').check();
      await expect(page.getByText('At least one load man must be selected')).toBeHidden();
    });

    test('switching to customer self loading clears the load man error', async ({ page }) => {
      await expect(page.getByText('At least one load man must be selected')).toBeVisible();

      await loadingType(page).selectOption('CUSTOMER_SELF');

      await expect(page.getByText('At least one load man must be selected')).toBeHidden();
    });
  });

  test.describe('problems with details taken from the order', () => {
    test('a part-paid order with no amount recorded says why it cannot be submitted', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsEmployee(page);
      await openDelivery(page, 'ord-0777');
      await fillRequired(page);
      await loadman(page, 'Ravi').check();

      await submit(page).click();

      await expect(
        page.getByText('Paid amount is required for a part-paid order. Please ask an administrator to record it.'),
      ).toBeVisible();
      await expect(page).toHaveURL(/delivery$/);
      expect(mock.deliveries).toHaveLength(0);
    });
  });
});
