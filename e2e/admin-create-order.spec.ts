import { expect, test, type Page } from '@playwright/test';
import { signInAsAdmin } from './support/admin';
import { mockSupabase, type MockOptions, type SupabaseMock } from './support/supabase-mock';

// A fixed mid-month morning: "today" is 2026-10-15.
const NOW = new Date(2026, 9, 15, 10, 0, 0);

const f = {
  customer: (page: Page) => page.getByLabel(/^Customer \*/),
  quantity: (page: Page) => page.getByLabel(/^Brick Quantity/),
  price: (page: Page) => page.getByLabel(/^Price Per Brick/),
  paper: (page: Page) => page.getByLabel('Paper Price'),
  location: (page: Page) => page.getByLabel(/^Location/),
  finalPrice: (page: Page) => page.getByLabel(/^Final Price/),
  gst: (page: Page) => page.getByLabel(/^GST Number/),
  dc: (page: Page) => page.getByLabel(/^Delivery Challan Number/),
  loadingType: (page: Page) => page.getByLabel('Loading Type'),
  create: (page: Page) => page.getByRole('button', { name: /^Creat(e|ing)/, exact: false }).last(),
};

const loadman = (page: Page, name: string) => page.getByRole('checkbox', { name });

async function openCreateOrder(page: Page, options: MockOptions = {}): Promise<SupabaseMock> {
  await page.clock.setFixedTime(NOW);
  const mock = await mockSupabase(page, { signedInAs: 'admin', ...options });
  await signInAsAdmin(page);
  await page.getByRole('button', { name: /Order Management/ }).click();
  await page.getByRole('button', { name: /Create Order/ }).click();
  await expect(page.getByRole('heading', { name: 'Create Order' })).toBeVisible();
  return mock;
}

/** Types in the customer box and picks the match once the search (which waits for a pause in typing) answers. */
async function searchAndPick(page: Page, term: string, label: string) {
  await f.customer(page).fill(term);
  await page.getByRole('button', { name: label }).click({ timeout: 8_000 });
  await expect(f.customer(page)).toHaveValue(label);
}

async function pickDeliveryDate(page: Page, day: string) {
  await page.getByRole('button', { name: /Select delivery date|, 20\d\d$/ }).click();
  await page.getByRole('gridcell', { name: day, exact: true }).click();
}

async function fillRest(page: Page) {
  await f.quantity(page).fill('1000');
  await pickDeliveryDate(page, '20');
  await f.price(page).fill('8.5');
  await f.location(page).fill('12 MG Road, Coimbatore');
  await f.finalPrice(page).fill('9000');
}

test.describe('Admin Create Order', () => {
  test.describe('the form', () => {
    test.beforeEach(async ({ page }) => {
      await openCreateOrder(page);
    });

    test('opens empty, with today\'s date fixed and the default loading type', async ({ page }) => {
      await expect(f.customer(page)).toHaveValue('');
      await expect(page.getByLabel('Date')).toHaveValue('2026-10-15');
      await expect(page.getByLabel('Date')).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Select delivery date' })).toBeVisible();
      await expect(f.loadingType(page)).toHaveValue('LOADING_UNLOADING');
      await expect(f.create(page)).toBeEnabled();
    });

    test('works out the paper price and the price per brick as the numbers are typed', async ({ page }) => {
      await expect(f.paper(page)).toBeDisabled();
      await f.quantity(page).fill('1000');
      await f.price(page).fill('8.5');
      await f.finalPrice(page).fill('9000');

      await expect(f.paper(page)).toHaveValue('₹8,500');
      await expect(page.getByText('Price per brick: ₹9.00')).toBeVisible();
    });

    test('upper-cases the GST number and stops at 15 characters', async ({ page }) => {
      await f.gst(page).pressSequentially('33abcde1234f1z5extra');

      await expect(f.gst(page)).toHaveValue('33ABCDE1234F1Z5');
    });

    test('shows the date that was picked and does not let a past day be picked', async ({ page }) => {
      await page.getByRole('button', { name: 'Select delivery date' }).click();
      await expect(page.getByRole('gridcell', { name: '14', exact: true })).toBeDisabled();

      await page.getByRole('gridcell', { name: '20', exact: true }).click();

      await expect(page.getByRole('button', { name: 'October 20th, 2026' })).toBeVisible();
    });
  });

  test.describe('creating the order', () => {
    test('creates it with the customer, the loadmen and every detail, then goes back to the orders', async ({ page }) => {
      const mock = await openCreateOrder(page);
      await searchAndPick(page, 'Rajesh', '9876543210, Rajesh Kumar');
      await fillRest(page);
      await f.dc(page).fill('DC-101');
      await loadman(page, 'Ravi Kumar').check();
      await f.loadingType(page).selectOption('LOADING_ONLY');

      await f.create(page).click();

      await expect(page.getByRole('heading', { name: 'Order Placed Successfully' })).toBeVisible();
      expect(mock.orderCreates).toEqual([
        {
          p_order: {
            customer_id: 'cust-1',
            order_date: '2026-10-15',
            delivery_date: '2026-10-20',
            brick_quantity: 1000,
            price_per_brick: 8.5,
            paper_price: 8500,
            final_price: 9000,
            location: '12 MG Road, Coimbatore',
            payment_status: 'NOT_PAID',
            amount_paid: 0,
            gst_number: null,
            dc_number: 'DC-101',
            loading_type: 'LOADING_ONLY',
          },
          p_loadmen: ['emp-1'],
        },
      ]);

      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page).toHaveURL(/\/admin\/orders$/);
      await expect(page.getByRole('heading', { name: 'Order Management' })).toBeVisible();
    });

    test('uses the GST number of the customer picked', async ({ page }) => {
      const mock = await openCreateOrder(page);
      await searchAndPick(page, 'Priya', '9876543211, Priya Sharma');
      await expect(f.gst(page)).toHaveValue('33ABCDE1234F1Z5');
      await fillRest(page);

      await f.create(page).click();

      await expect(page.getByRole('heading', { name: 'Order Placed Successfully' })).toBeVisible();
      expect((mock.orderCreates[0].p_order as Record<string, unknown>).gst_number).toBe('33ABCDE1234F1Z5');
    });

    test('sends no loadmen for customer self loading, even after some were ticked', async ({ page }) => {
      const mock = await openCreateOrder(page);
      await searchAndPick(page, 'Rajesh', '9876543210, Rajesh Kumar');
      await fillRest(page);
      await loadman(page, 'Ravi Kumar').check();
      await loadman(page, 'Mohan Das').check();
      await f.loadingType(page).selectOption('CUSTOMER_SELF');

      await f.create(page).click();

      await expect(page.getByRole('heading', { name: 'Order Placed Successfully' })).toBeVisible();
      expect(mock.orderCreates[0]).toMatchObject({ p_order: { loading_type: 'CUSTOMER_SELF' }, p_loadmen: [] });
    });

    test('shows why it failed and keeps the form for another try', async ({ page }) => {
      const mock = await openCreateOrder(page, { orderCreateFails: true });
      await searchAndPick(page, 'Rajesh', '9876543210, Rajesh Kumar');
      await fillRest(page);

      await f.create(page).click();

      await expect(page.getByRole('heading', { name: 'Creation Failed' })).toBeVisible();
      await expect(page.getByText('Not enough stock for this order')).toBeVisible();
      expect(mock.orderCreates).toEqual([]);

      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page.getByRole('heading', { name: 'Creation Failed' })).toBeHidden();
      await expect(f.location(page)).toHaveValue('12 MG Road, Coimbatore');
      await expect(f.finalPrice(page)).toHaveValue('9000');
      await expect(page).toHaveURL(/\/admin\/orders\/create$/);
    });
  });

  test.describe('validation', () => {
    test('lists every missing required field when an empty form is submitted', async ({ page }) => {
      const mock = await openCreateOrder(page);

      await f.create(page).click();

      for (const message of [
        'Customer is required',
        'Brick quantity must be greater than 0',
        'Delivery date is required',
        'Price per brick must be greater than 0',
        'Delivery location is required',
        'Final price must be greater than 0',
      ]) {
        await expect(page.getByText(message)).toBeVisible();
      }
      expect(mock.orderCreates).toEqual([]);
    });

    test('rejects a GST number that is not 15 characters', async ({ page }) => {
      const mock = await openCreateOrder(page);
      await searchAndPick(page, 'Rajesh', '9876543210, Rajesh Kumar');
      await fillRest(page);
      await f.gst(page).fill('33ABCDE12');

      await f.create(page).click();

      await expect(page.getByText('GST Number must be exactly 15 characters')).toBeVisible();
      expect(mock.orderCreates).toEqual([]);
    });

    test('forgets the customer when the search box is edited after picking one', async ({ page }) => {
      const mock = await openCreateOrder(page);
      await searchAndPick(page, 'Rajesh', '9876543210, Rajesh Kumar');
      await fillRest(page);

      await f.customer(page).focus();
      await page.keyboard.press('End');
      await page.keyboard.press('Backspace');
      await expect(f.customer(page)).toHaveValue('9876543210, Rajesh Kuma');
      await f.create(page).click();

      await expect(page.getByText('Customer is required')).toBeVisible();
      expect(mock.orderCreates).toEqual([]);
    });
  });

  test.describe('finding the customer', () => {
    test('lists every customer that matches what was typed', async ({ page }) => {
      await openCreateOrder(page);

      await f.customer(page).fill('98765432');

      await expect(page.getByRole('button', { name: '9876543210, Rajesh Kumar' })).toBeVisible({ timeout: 8_000 });
      await expect(page.getByRole('button', { name: '9876543211, Priya Sharma' })).toBeVisible();
    });

    test('lists nothing, and the form keeps working, when the search fails', async ({ page }) => {
      await openCreateOrder(page, { customerSearchFails: true });

      await f.customer(page).fill('Rajesh');
      await page.waitForResponse(/customers/, { timeout: 8_000 });

      await expect(page.getByRole('button', { name: /Rajesh Kumar/ })).toHaveCount(0);
      await expect(f.create(page)).toBeEnabled();
    });

    test.describe('known gaps', () => {
      test('says so when nobody matches', async ({ page }) => {
        test.fail();
        await openCreateOrder(page);

        await f.customer(page).fill('0000000000');
        await page.waitForResponse(/customers/, { timeout: 8_000 });

        await expect(page.getByText('No customers found')).toBeVisible({ timeout: 1_000 });
      });
    });
  });

  test.describe('adding a new customer from the order form', () => {
    const modal = (page: Page) => page.getByRole('heading', { name: 'Customer Creation' });
    // The modal's GST label cannot be used to find its field: see the known gap below.
    const modalGst = (page: Page) => page.getByPlaceholder('Enter 15-character GST Number');
    const goToModal = async (page: Page) => page.getByRole('button', { name: 'Go to create customer' }).click();
    const fillCustomer = async (page: Page) => {
      await page.getByLabel(/^Customer Name/).fill('New Person');
      await page.getByLabel(/^Phone Number/).fill('9000000099');
      await page.getByLabel(/^Address/).fill('7 Temple Street, Salem');
    };

    test('opens and closes without picking anyone', async ({ page }) => {
      await openCreateOrder(page);

      await goToModal(page);
      await expect(modal(page)).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).click();

      await expect(modal(page)).toBeHidden();
      await expect(f.customer(page)).toHaveValue('');
    });

    test('names every missing field when created empty', async ({ page }) => {
      const mock = await openCreateOrder(page);
      await goToModal(page);

      await page.getByRole('button', { name: 'Create', exact: true }).last().click();

      await expect(page.getByText('Name is required')).toBeVisible();
      await expect(page.getByText('Phone number is required')).toBeVisible();
      await expect(page.getByText('Address is required')).toBeVisible();
      expect(mock.customerCreates).toEqual([]);
    });

    test('only accepts letters in the name and digits in the phone number', async ({ page }) => {
      await openCreateOrder(page);
      await goToModal(page);

      await page.getByLabel(/^Customer Name/).pressSequentially('Ne3w P_erson!');
      await page.getByLabel(/^Phone Number/).pressSequentially('90a00-000099x');

      await expect(page.getByLabel(/^Customer Name/)).toHaveValue('New Person');
      await expect(page.getByLabel(/^Phone Number/)).toHaveValue('9000000099');
    });

    test('rejects a short phone number and a GST number that is not 15 characters', async ({ page }) => {
      const mock = await openCreateOrder(page);
      await goToModal(page);
      await fillCustomer(page);
      await page.getByLabel(/^Phone Number/).fill('90000');
      await modalGst(page).fill('33ABC');

      await page.getByRole('button', { name: 'Create', exact: true }).last().click();

      await expect(page.getByText('Phone number must be 10 digits')).toBeVisible();
      await expect(page.getByText('Enter valid GST Number')).toBeVisible();
      expect(mock.customerCreates).toEqual([]);
    });

    test('creates the customer and picks them for the order', async ({ page }) => {
      const mock = await openCreateOrder(page);
      await goToModal(page);
      await fillCustomer(page);

      await page.getByRole('button', { name: 'Create', exact: true }).last().click();

      await expect(modal(page)).toBeHidden();
      await expect(f.customer(page)).toHaveValue('9000000099, New Person');
      expect(mock.customerCreates).toEqual([
        { name: 'New Person', phone: '9000000099', address: '7 Temple Street, Salem', gst_number: null },
      ]);
    });

    test('shows the server\'s reason and keeps what was typed when the customer cannot be created', async ({ page }) => {
      await openCreateOrder(page, { customerCreateFails: true });
      await goToModal(page);
      await fillCustomer(page);

      await page.getByRole('button', { name: 'Create', exact: true }).last().click();

      await expect(page.getByText('A customer with this phone number already exists')).toBeVisible();
      await expect(page.getByLabel(/^Customer Name/)).toHaveValue('New Person');
      await expect(f.customer(page)).toHaveValue('');
    });

    test.describe('known gaps', () => {
      // The order form and the modal both give their GST field id="gstNumber", so the modal's
      // "GST Number" label belongs to the order form's field: clicking it focuses the wrong input.
      test('clicking the modal\'s GST Number label focuses the modal\'s own field', async ({ page }) => {
        test.fail();
        await openCreateOrder(page);
        await goToModal(page);

        await page.getByText('GST Number', { exact: true }).last().click();

        await expect(modalGst(page)).toBeFocused({ timeout: 1_000 });
      });

      test('shows the customer created confirmation before the modal closes', async ({ page }) => {
        test.fail();
        await openCreateOrder(page);
        await goToModal(page);
        await fillCustomer(page);

        await page.getByRole('button', { name: 'Create', exact: true }).last().click();

        await expect(page.getByRole('heading', { name: 'Customer Created Successfully' })).toBeVisible({ timeout: 1_000 });
      });
    });
  });

  test.describe('the loadmen and the loading type', () => {
    test.beforeEach(async ({ page }) => {
      await openCreateOrder(page);
    });

    test('lists the active staff, and shows who is ticked', async ({ page }) => {
      await expect(loadman(page, 'Ravi Kumar')).not.toBeChecked();
      await expect(loadman(page, 'Old Hand')).toHaveCount(0);

      await loadman(page, 'Ravi Kumar').check();
      await loadman(page, 'Mohan Das').check();

      await expect(page.getByText('Selected: Ravi Kumar, Mohan Das')).toBeVisible();
    });

    test('hides the loadmen for customer self loading and drops those that were ticked', async ({ page }) => {
      await loadman(page, 'Ravi Kumar').check();
      await loadman(page, 'Mohan Das').check();

      await f.loadingType(page).selectOption('CUSTOMER_SELF');
      await expect(loadman(page, 'Ravi Kumar')).toBeHidden();
      await f.loadingType(page).selectOption('LOADING_ONLY');

      await expect(loadman(page, 'Ravi Kumar')).not.toBeChecked();
      await expect(loadman(page, 'Mohan Das')).not.toBeChecked();
      await expect(page.getByText(/^Selected:/)).toBeHidden();
    });

    test('keeps the ticked loadmen when switched between the other loading types', async ({ page }) => {
      await loadman(page, 'Ravi Kumar').check();

      await f.loadingType(page).selectOption('LOADING_ONLY');

      await expect(loadman(page, 'Ravi Kumar')).toBeChecked();
    });
  });
});
