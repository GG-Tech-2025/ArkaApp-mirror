import { expect, test, type Page } from '@playwright/test';
import { signInAsEmployee } from './support/employee';
import { mockSupabase, TEST_USER, type SupabaseMock } from './support/supabase-mock';

// A fixed mid-month morning: today, earlier days and later days are all on one calendar page.
const NOW = new Date(2026, 9, 15, 10, 0, 0);

const material = (page: Page) => page.getByLabel(/^Material/);
const vendor = (page: Page) => page.getByLabel(/^Vendor/);
const quantity = (page: Page) => page.getByLabel(/^Quantity/);
const submit = (page: Page) => page.getByRole('button', { name: /^Submit/ });
const dateButton = (page: Page) => page.getByRole('button', { name: /2026/ });

async function openForm(page: Page) {
  await page.getByRole('button', { name: /Material Purchase Entry/ }).click();
  await expect(page.getByRole('heading', { name: 'Material Purchase Entry' })).toBeVisible();
  await expect(material(page)).toBeEnabled();
  await expect(vendor(page)).toBeEnabled();
}

async function fillValid(page: Page, amount = '25') {
  await material(page).selectOption({ label: 'Cement' });
  await vendor(page).selectOption({ label: 'ABC Suppliers' });
  await quantity(page).fill(amount);
}

test.describe('Material Purchase Entry screen', () => {
  let mock: SupabaseMock;

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    mock = await mockSupabase(page);
    await signInAsEmployee(page);
    await openForm(page);
  });

  test.describe('form', () => {
    test('loads the materials and vendors from the server', async ({ page }) => {
      await expect(material(page).locator('option')).toHaveText([
        'Select Material',
        'Cement',
        'Fly Ash Powder',
        'Wet Ash',
      ]);
      await expect(vendor(page).locator('option')).toHaveText(['Select Vendor', 'ABC Suppliers', 'XYZ Materials']);
    });

    test('starts empty, with today selected as the date', async ({ page }) => {
      await expect(material(page)).toHaveValue('');
      await expect(vendor(page)).toHaveValue('');
      await expect(quantity(page)).toHaveValue('');
      await expect(dateButton(page)).toContainText('October 15th, 2026');
    });

    test('shows the unit of the chosen material next to the quantity', async ({ page }) => {
      await expect(page.getByText(/^Quantity/)).not.toContainText('(');

      await material(page).selectOption({ label: 'Cement' });
      await expect(page.getByText(/^Quantity/)).toContainText('(bags)');
      await expect(quantity(page)).toHaveAttribute('placeholder', 'Enter quantity in bags');

      await material(page).selectOption({ label: 'Wet Ash' });
      await expect(page.getByText(/^Quantity/)).toContainText('(tons)');
    });

    test('Back to Home returns to the dashboard without saving anything', async ({ page }) => {
      await page.getByRole('button', { name: /Back to Home/ }).click();

      await expect(page).toHaveURL(/\/employee\/home$/);
      expect(mock.procurements).toHaveLength(0);
    });
  });

  test.describe('validation', () => {
    test('an empty form reports the missing material, vendor and quantity and saves nothing', async ({ page }) => {
      await submit(page).click();

      await expect(page.getByText('Material is required')).toBeVisible();
      await expect(page.getByText('Vendor is required')).toBeVisible();
      await expect(page.getByText('Quantity is required')).toBeVisible();
      await expect(page.getByText('Date is required')).toBeHidden();
      await expect(page).toHaveURL(/material-entry$/);
      expect(mock.procurements).toHaveLength(0);
    });

    for (const [label, value] of [
      ['zero', '0'],
      ['a negative number', '-3'],
    ]) {
      test(`${label} is not accepted as a quantity`, async ({ page }) => {
        await fillValid(page, value);

        await submit(page).click();

        await expect(page.getByText('Quantity is required')).toBeVisible();
        expect(mock.procurements).toHaveLength(0);
      });
    }

    test('each error disappears as soon as its field is corrected', async ({ page }) => {
      await submit(page).click();
      await expect(page.getByText('Material is required')).toBeVisible();

      await material(page).selectOption({ label: 'Cement' });
      await expect(page.getByText('Material is required')).toBeHidden();
      await expect(page.getByText('Vendor is required')).toBeVisible();

      await vendor(page).selectOption({ label: 'XYZ Materials' });
      await expect(page.getByText('Vendor is required')).toBeHidden();
      await expect(page.getByText('Quantity is required')).toBeVisible();

      await quantity(page).fill('4');
      await expect(page.getByText('Quantity is required')).toBeHidden();
    });
  });

  test.describe('date picker', () => {
    test('opens on the current month and only allows today or earlier', async ({ page }) => {
      await dateButton(page).click();

      await expect(page.getByText('October 2026')).toBeVisible();
      await expect(page.getByRole('gridcell', { name: '15', exact: true })).toBeEnabled();
      await expect(page.getByRole('gridcell', { name: '14', exact: true })).toBeEnabled();
      await expect(page.getByRole('gridcell', { name: '16', exact: true })).toBeDisabled();
      await expect(page.getByRole('gridcell', { name: '31', exact: true })).toBeDisabled();
    });

    test('picking an earlier day updates the date shown', async ({ page }) => {
      await dateButton(page).click();

      await page.getByRole('gridcell', { name: '10', exact: true }).click();

      await expect(dateButton(page)).toContainText('October 10th, 2026');
    });
  });

  test.describe('saving', () => {
    test('saves the purchase and confirms it, then OK returns to the dashboard', async ({ page }) => {
      await fillValid(page, '12.5');

      await submit(page).click();

      await expect(page.getByText('Purchase Successful')).toBeVisible();
      await expect(page.getByText('Material purchase entry has been recorded successfully.')).toBeVisible();
      expect(mock.procurements).toEqual([
        {
          material_id: 'mat-cement',
          vendor_id: 'ven-abc',
          quantity: 12.5,
          date: '2026-10-15',
          approved: false,
          rate_per_unit: 0,
          total_price: 0,
          created_by: TEST_USER.id,
        },
      ]);

      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page).toHaveURL(/\/employee\/home$/);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('saves the date that was picked', async ({ page }) => {
      await fillValid(page);
      await dateButton(page).click();
      await page.getByRole('gridcell', { name: '3', exact: true }).click();

      await submit(page).click();

      await expect(page.getByText('Purchase Successful')).toBeVisible();
      expect(mock.procurements[0]).toMatchObject({ date: '2026-10-03' });
    });

    test('records exactly one purchase even if Submit is pressed repeatedly', async ({ page }) => {
      await fillValid(page);

      await submit(page).dblclick();

      await expect(page.getByText('Purchase Successful')).toBeVisible();
      expect(mock.procurements).toHaveLength(1);
    });

    test('shows no unexpected backend calls on the happy path', async () => {
      expect(mock.unexpected).toEqual([]);
    });
  });
});

test.describe('Material Purchase Entry screen, when the backend fails', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
  });

  test('a failed save shows an error popup and keeps the form so the employee can retry', async ({ page }) => {
    await mockSupabase(page, { procurementFails: true });
    await signInAsEmployee(page);
    await openForm(page);
    await fillValid(page, '8');

    await submit(page).click();

    await expect(page.getByText('Submission Failed')).toBeVisible();
    await expect(page.getByText('Failed to save material purchase')).toBeVisible();

    await page.getByRole('button', { name: 'OK' }).click();

    await expect(page).toHaveURL(/material-entry$/);
    await expect(material(page)).toHaveValue('mat-cement');
    await expect(vendor(page)).toHaveValue('ven-abc');
    await expect(quantity(page)).toHaveValue('8');
    await expect(submit(page)).toBeEnabled();
  });

  test('the employee can save successfully after an earlier failure', async ({ page }) => {
    const mock = await mockSupabase(page, { procurementFails: true });
    await signInAsEmployee(page);
    await openForm(page);
    await fillValid(page);
    await submit(page).click();
    await page.getByRole('button', { name: 'OK' }).click();

    // The backend recovers: replace the failing route with a working one.
    await page.route('**/rest/v1/procurements', async (route) => {
      mock.procurements.push(route.request().postDataJSON());
      await route.fulfill({
        status: 201,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      });
    });
    await submit(page).click();

    await expect(page.getByText('Purchase Successful')).toBeVisible();
    expect(mock.procurements).toHaveLength(1);
  });

  test('when the lists cannot be loaded the form still opens, with nothing to choose', async ({ page }) => {
    await mockSupabase(page, { listsFail: true });
    await signInAsEmployee(page);
    await openForm(page);

    await expect(material(page).locator('option')).toHaveText(['Select Material']);
    await expect(vendor(page).locator('option')).toHaveText(['Select Vendor']);
  });
});
