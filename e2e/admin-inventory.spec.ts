import { expect, test, type Page } from '@playwright/test';
import { signInAsAdmin } from './support/admin';
import { mockSupabase, PROCUREMENTS, INVENTORY_STOCK, type MockOptions } from './support/supabase-mock';

// The screens format dates in the browser's timezone and filter by "this month", so pin both.
test.use({ timezoneId: 'Asia/Kolkata' });
const NOW = new Date(2026, 9, 15, 10, 0, 0); // 15 Oct 2026: "Current month" is October, "Last month" September

type Row = Record<string, unknown>;

const production = (overrides: Row = {}): Row => ({
  id: 'prod-1', production_date: '2026-10-14', bricks: 9000, round: 25,
  wet_ash_kg: 500, marble_powder_kg: 120.5, crusher_powder_kg: 80, fly_ash_kg: 40,
  cement_bags: 12, notes: null, created_by: 'u1', created_at: '2026-10-14T10:00:00Z',
  ...overrides,
});
const HISTORY = [
  production(),
  production({ id: 'prod-2', production_date: '2026-10-13', bricks: 7500, round: 10, wet_ash_kg: 200, marble_powder_kg: 0, crusher_powder_kg: 0, fly_ash_kg: 0, cement_bags: 4 }),
];

const ADJUSTMENT_WITHOUT_REASON = {
  id: 'adj-2',
  adjustment_date: '2026-10-11',
  actual_bricks: 100, adjusted_bricks: 120,
  actual_wet_ash_kg: null, adjusted_wet_ash_kg: null,
  actual_marble_powder_kg: null, adjusted_marble_powder_kg: null,
  actual_crusher_powder_kg: null, adjusted_crusher_powder_kg: null,
  actual_fly_ash_kg: null, adjusted_fly_ash_kg: null,
  actual_cement_bags: null, adjusted_cement_bags: null,
  reason: null, created_by: 'u1', created_at: '2026-10-11T09:00:00Z',
};

/** Signs in as the admin and opens Inventory Management from the dashboard. */
async function openInventory(page: Page, options: MockOptions = {}) {
  const mock = await mockSupabase(page, { signedInAs: 'admin', productionHistory: HISTORY, ...options });
  await page.clock.setFixedTime(NOW);
  await signInAsAdmin(page);
  await page.getByRole('heading', { name: 'Inventory Management' }).click();
  await expect(page).toHaveURL(/\/admin\/inventory$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Inventory Management' })).toBeVisible();
  return mock;
}

/** Signs in and opens a screen of the inventory module straight from its address. */
async function openAddress(page: Page, path: string, options: MockOptions = {}) {
  const mock = await mockSupabase(page, { signedInAs: 'admin', productionHistory: HISTORY, ...options });
  await page.clock.setFixedTime(NOW);
  await signInAsAdmin(page);
  await page.goto(path);
  return mock;
}

const tab = (page: Page, name: 'Procurement' | 'Usage' | 'Adjustments') =>
  page.getByRole('button', { name, exact: true });
const chip = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const periodFilter = (page: Page) => page.getByRole('combobox');
const unapprovedButton = (page: Page) => page.getByRole('button', { name: /^Unapproved procurements/ });
const adjustmentsButton = (page: Page) => page.getByRole('button', { name: 'Make adjustments' });
/** The disabled, pre-filled fields in the approve window have labels that are not tied to them, so find them by their label text. */
const approveWindow = (page: Page) => page.getByRole('heading', { name: 'Approve Procurement' }).locator('..');
const approveField = (page: Page, label: string) =>
  approveWindow(page).getByText(label, { exact: true }).locator('..').locator('input');
/** The number under a label on the Raw Material Stock summary cards. */
const summary = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator('xpath=following-sibling::p[1]');
/** The label above a value on the stock cards: "Wet Ash" then "34,308 Kg (34.31 Tons)". */
const stockOf = (page: Page, material: string) =>
  page.getByText(material, { exact: true }).first().locator('..').locator('p').nth(1);

test.describe('Inventory Management (admin)', () => {
  test.describe('getting there', () => {
    test('opens from the dashboard and says what the screen is for', async ({ page }) => {
      await openInventory(page);
      await expect(page.getByText('Track stock, production, and raw material usage')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Bricks Ready' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Raw Material Stock' })).toBeVisible();
    });

    test('Back to Home returns to the dashboard', async ({ page }) => {
      await openInventory(page);
      await page.getByRole('button', { name: 'Back to Home' }).click();
      await expect(page).toHaveURL(/\/admin\/home$/);
      await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    });

    test('can be opened straight from its address', async ({ page }) => {
      await openAddress(page, '/admin/inventory');
      await expect(page.getByRole('heading', { level: 1, name: 'Inventory Management' })).toBeVisible();
      await expect(page.getByText('33,100', { exact: true })).toBeVisible();
    });
  });

  test.describe('stock figures', () => {
    test('shows the bricks ready and every raw material in kg with its tons or bags', async ({ page }) => {
      await openInventory(page);
      await expect(page.getByText('33,100', { exact: true })).toBeVisible();
      await expect(stockOf(page, 'Wet Ash')).toHaveText('34,308 Kg (34.31 Tons)');
      await expect(stockOf(page, 'Marble Powder')).toHaveText('14,260 Kg (14.26 Tons)');
      await expect(stockOf(page, 'Crusher Powder')).toHaveText('18,422.5 Kg (18.42 Tons)');
      await expect(stockOf(page, 'Fly Ash')).toHaveText('7,975 Kg (7.97 Tons)');
      await expect(stockOf(page, 'Cement')).toHaveText('2,775 Kg (56 Bags)');
    });

    test('works out how many bricks the stock could still make and what limits it', async ({ page }) => {
      await openInventory(page);
      // crusher powder: 18,422.5 kg / 1,800 kg per round = 10 rounds, the fewest of any material
      await expect(page.getByText('Bricks (10 rounds)')).toBeVisible();
      await expect(page.getByText('1,750', { exact: true })).toBeVisible();
      await expect(page.getByText('Limited by: Crusher Powder')).toBeVisible();
    });

    test('shows a material that has gone negative (production ran ahead of approvals) with its minus sign', async ({ page }) => {
      await openInventory(page, {
        stockRows: INVENTORY_STOCK.map((s) => (s.materials.name === 'Cement' ? { ...s, quantity: -2225 } : s)),
      });
      await expect(stockOf(page, 'Cement')).toHaveText('-2,225 Kg (-45 Bags)');
      await expect(stockOf(page, 'Wet Ash')).toHaveText('34,308 Kg (34.31 Tons)');
    });

    test('shows zeros when nothing is stocked yet', async ({ page }) => {
      await openInventory(page, { stockRows: [], bricksReady: 0, procurementRows: [], adjustments: [], productionHistory: [] });
      await expect(stockOf(page, 'Wet Ash')).toHaveText('0 Kg (0.00 Tons)');
      await expect(stockOf(page, 'Cement')).toHaveText('0 Kg (0 Bags)');
      await expect(page.getByText('Bricks (0 rounds)')).toBeVisible();
    });

    test('loads without crashing when the stock cannot be read, showing empty figures', async ({ page }) => {
      await openInventory(page, { inventoryLoadFails: true });
      await expect(stockOf(page, 'Wet Ash')).toHaveText('0 Kg (0.00 Tons)');
      await expect(page.getByText('No procurements found')).toBeVisible();
    });
  });

  test.describe('Procurement tab', () => {
    test('lists this month\'s approved procurements, newest first, in tons, bags and units', async ({ page }) => {
      await openInventory(page);
      await expect(page.getByText('Total Price', { exact: true })).toHaveCount(3);
      await expect(page.getByText('60 Tons')).toBeVisible();
      await expect(page.getByText('100 Bags')).toBeVisible();
      await expect(page.getByText('5 Units')).toBeVisible();
      await expect(page.getByText('₹54,000')).toBeVisible();
      await expect(page.getByText('₹38,000')).toBeVisible();
      await expect(page.getByText('₹16,000')).toBeVisible();
      await expect(page.getByText('10-Oct-2026')).toBeVisible();
      await expect(page.getByText('ABC Suppliers').first()).toBeVisible();
      await expect(page.getByText('XYZ Materials')).toBeVisible();
      // the pending requests (12 to 14 Oct) are not in this list
      await expect(page.getByText('14-Oct-2026')).toHaveCount(0);
    });

    test('filters by material, and says so when a material has no procurements', async ({ page }) => {
      await openInventory(page);
      await chip(page, 'Cement').click();
      await expect(page.getByText('Total Price', { exact: true })).toHaveCount(1);
      await expect(page.getByText('100 Bags')).toBeVisible();

      await chip(page, 'Marble Powder').click();
      await expect(page.getByText('No procurements found')).toBeVisible();

      await chip(page, 'All').click();
      await expect(page.getByText('Total Price', { exact: true })).toHaveCount(3);
    });

    test.describe('period', () => {
      test('Last month lists September', async ({ page }) => {
        await openInventory(page);
        await periodFilter(page).selectOption('Last month');
        await expect(page.getByText('Total Price', { exact: true })).toHaveCount(1);
        await expect(page.getByText('30 Tons')).toBeVisible();
        await expect(page.getByText('12-Sep-2026')).toBeVisible();
      });

      test('Last year lists last calendar year', async ({ page }) => {
        await openInventory(page);
        await periodFilter(page).selectOption('Last year');
        await expect(page.getByText('80 Bags')).toBeVisible();
        await expect(page.getByText('₹28,800')).toBeVisible();
        await expect(page.getByText('Total Price', { exact: true })).toHaveCount(1);
      });

      test('Custom range asks for both dates before it applies, then filters by them', async ({ page }) => {
        await openInventory(page);
        await periodFilter(page).selectOption('Custom range');
        await expect(page.getByRole('heading', { name: 'Custom Date Range' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Apply Filter' })).toBeDisabled();

        await page.getByLabel(/^Start/).fill('2026-09-01');
        await expect(page.getByRole('button', { name: 'Apply Filter' })).toBeDisabled();
        await page.getByLabel(/^End/).fill('2026-09-20');
        await expect(page.getByRole('button', { name: 'Apply Filter' })).toBeEnabled();
        await page.getByRole('button', { name: 'Apply Filter' }).click();

        await expect(page.getByRole('heading', { name: 'Custom Date Range' })).toHaveCount(0);
        await expect(periodFilter(page)).toHaveValue('Custom range');
        await expect(page.getByText('12-Sep-2026')).toBeVisible();
        await expect(page.getByText('Total Price', { exact: true })).toHaveCount(1);
      });

      test('cancelling the custom range keeps the period that was showing', async ({ page }) => {
        await openInventory(page);
        await periodFilter(page).selectOption('Custom range');
        await page.getByRole('button', { name: 'Cancel' }).click();

        await expect(page.getByRole('heading', { name: 'Custom Date Range' })).toHaveCount(0);
        await expect(periodFilter(page)).toHaveValue('Current month');
        await expect(page.getByText('Total Price', { exact: true })).toHaveCount(3);
      });
    });

    test('shows ten at a time and loads ten more on request', async ({ page }) => {
      const many = Array.from({ length: 12 }, (_, i) => ({
        ...PROCUREMENTS[0],
        id: `proc-many-${i}`,
        date: `2026-10-${String(i + 1).padStart(2, '0')}`,
      }));
      await openInventory(page, { procurementRows: many });
      await expect(page.getByText('Total Price', { exact: true })).toHaveCount(10);

      await page.getByRole('button', { name: 'Load More' }).click();
      await expect(page.getByText('Total Price', { exact: true })).toHaveCount(12);
      await expect(page.getByRole('button', { name: 'Load More' })).toHaveCount(0);
    });

    test('says so when there are no approved procurements at all', async ({ page }) => {
      await openInventory(page, { procurementRows: [] });
      await expect(page.getByText('No procurements found')).toBeVisible();
    });
  });

  test.describe('Usage tab', () => {
    test('lists production entries with each material in kg and tons, cement in bags', async ({ page }) => {
      await openInventory(page);
      await tab(page, 'Usage').click();
      const latest = page.getByRole('row', { name: /14-Oct-2026/ });
      await expect(latest).toContainText('9,000');
      await expect(latest).toContainText('25');
      await expect(latest).toContainText('500 Kg (0.50 Tons)');
      await expect(latest).toContainText('120.5 Kg (0.12 Tons)');
      await expect(latest).toContainText('80 Kg (0.08 Tons)');
      await expect(latest).toContainText('40 Kg (0.04 Tons)');
      await expect(latest).toContainText('12 Bags (600 Kg)');
      await expect(page.getByRole('row', { name: /13-Oct-2026/ })).toContainText('4 Bags (200 Kg)');
    });

    test('says so when nothing was produced in the period', async ({ page }) => {
      await openInventory(page, { productionHistory: [] });
      await tab(page, 'Usage').click();
      await expect(page.getByText('No production entries found')).toBeVisible();
    });

    test('follows the period filter', async ({ page }) => {
      await openInventory(page);
      await tab(page, 'Usage').click();
      await periodFilter(page).selectOption('Last month');
      await expect(page.getByText('No production entries found')).toBeVisible();
    });

    test('the material chips belong to the Procurement tab only', async ({ page }) => {
      await openInventory(page);
      await expect(chip(page, 'Cement')).toBeVisible();
      await tab(page, 'Usage').click();
      await expect(chip(page, 'Cement')).toHaveCount(0);
      await tab(page, 'Procurement').click();
      await expect(chip(page, 'Cement')).toBeVisible();
    });
  });

  test.describe('Adjustments tab', () => {
    test('shows what was counted, what it was corrected to, and by how much', async ({ page }) => {
      await openInventory(page);
      await tab(page, 'Adjustments').click();
      const row = page.getByRole('row', { name: /12-Oct-2026/ });
      await expect(row).toContainText('33,100 → 33,000(-100)');
      await expect(row).toContainText('14,260 → 14,300(+40)');
      await expect(row).toContainText('34,308 → 34,308(0)');
      await expect(row).toContainText('N/A');
      await expect(row).toContainText('Physical count correction');
    });

    test('says so when there are no adjustments', async ({ page }) => {
      await openInventory(page, { adjustments: [] });
      await tab(page, 'Adjustments').click();
      await expect(page.getByText('No adjustments found')).toBeVisible();
    });

    test('shows N/A when an adjustment has no reason', async ({ page }) => {
      await openInventory(page, { adjustments: [{ ...ADJUSTMENT_WITHOUT_REASON }] });
      await tab(page, 'Adjustments').click();
      await expect(page.getByRole('row', { name: /11-Oct-2026/ })).toContainText('N/A');
    });
  });

  test.describe('Make adjustments', () => {
    test('opens with the current figures filled in, cement in bags', async ({ page }) => {
      await openInventory(page);
      await adjustmentsButton(page).click();
      await expect(page.getByRole('heading', { name: 'Make Adjustments' })).toBeVisible();
      await expect(page.getByLabel('Bricks Ready')).toHaveValue('33100');
      await expect(page.getByLabel('Wet Ash (Kg)')).toHaveValue('34308');
      await expect(page.getByLabel('Marble Powder (Kg)')).toHaveValue('14260');
      await expect(page.getByLabel('Crusher Powder (Kg)')).toHaveValue('18422.5');
      await expect(page.getByLabel('Fly Ash (Kg)')).toHaveValue('7975');
      await expect(page.getByLabel('Cement (Bags)')).toHaveValue('55.5');
      await expect(page.getByLabel('Reason (Optional)')).toHaveValue('');
    });

    test('saves the counted figures, shows the confirmation, and the stock cards and history update', async ({ page }) => {
      const mock = await openInventory(page);
      await adjustmentsButton(page).click();
      await page.getByLabel('Bricks Ready').fill('33000');
      await page.getByLabel('Wet Ash (Kg)').fill('30000');
      await page.getByLabel('Cement (Bags)').fill('40');
      await page.getByLabel('Reason (Optional)').fill('Recount after the rain');
      await page.getByRole('button', { name: 'Submit' }).click();

      await expect(page.getByRole('heading', { name: 'Adjustment Submitted' })).toBeVisible();
      await expect(page.getByText('The inventory adjustment has been recorded successfully.')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Make Adjustments' })).toHaveCount(0);
      expect(mock.adjustmentCreates).toEqual([
        {
          p_adjustment_date: '2026-10-15',
          p_actual_bricks: 33100,
          p_actual_wet_ash_kg: 34308,
          p_actual_marble_powder_kg: 14260,
          p_actual_crusher_powder_kg: 18422.5,
          p_actual_fly_ash_kg: 7975,
          p_actual_cement_bags: 55.5,
          p_adjusted_bricks: 33000,
          p_adjusted_wet_ash_kg: 30000,
          p_adjusted_marble_powder_kg: 14260,
          p_adjusted_crusher_powder_kg: 18422.5,
          p_adjusted_fly_ash_kg: 7975,
          p_adjusted_cement_bags: 40,
          p_reason: 'Recount after the rain',
        },
      ]);

      await page.getByRole('button', { name: 'OK' }).click();
      await expect(stockOf(page, 'Wet Ash')).toHaveText('30,000 Kg (30.00 Tons)');
      await expect(stockOf(page, 'Cement')).toHaveText('2,000 Kg (40 Bags)');
      await expect(page.getByText('33,000', { exact: true })).toBeVisible();

      await tab(page, 'Adjustments').click();
      const today = page.getByRole('row', { name: /15-Oct-2026/ });
      await expect(today).toContainText('33,100 → 33,000(-100)');
      await expect(today).toContainText('34,308 → 30,000(-4,308)');
      await expect(today).toContainText('Recount after the rain');
    });

    test('saves without a reason', async ({ page }) => {
      const mock = await openInventory(page);
      await adjustmentsButton(page).click();
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect(page.getByRole('heading', { name: 'Adjustment Submitted' })).toBeVisible();
      expect(mock.adjustmentCreates[0].p_reason).toBeNull();
    });

    test('Cancel closes it without saving anything', async ({ page }) => {
      const mock = await openInventory(page);
      await adjustmentsButton(page).click();
      await page.getByLabel('Wet Ash (Kg)').fill('1');
      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(page.getByRole('heading', { name: 'Make Adjustments' })).toHaveCount(0);
      expect(mock.adjustmentCreates).toHaveLength(0);
      await expect(stockOf(page, 'Wet Ash')).toHaveText('34,308 Kg (34.31 Tons)');
    });

    test('reopening starts again from the current figures, not from what was typed before', async ({ page }) => {
      await openInventory(page);
      await adjustmentsButton(page).click();
      await page.getByLabel('Wet Ash (Kg)').fill('1');
      await page.getByRole('button', { name: 'Cancel' }).click();
      await adjustmentsButton(page).click();
      await expect(page.getByLabel('Wet Ash (Kg)')).toHaveValue('34308');
    });

    test('when saving fails it stays open with what was typed and shows no confirmation', async ({ page }) => {
      const mock = await openInventory(page, { adjustmentFails: true });
      await adjustmentsButton(page).click();
      await page.getByLabel('Wet Ash (Kg)').fill('30000');
      await page.getByRole('button', { name: 'Submit' }).click();

      await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled();
      await expect(page.getByRole('heading', { name: 'Make Adjustments' })).toBeVisible();
      await expect(page.getByLabel('Wet Ash (Kg)')).toHaveValue('30000');
      await expect(page.getByRole('heading', { name: 'Adjustment Submitted' })).toHaveCount(0);
      expect(mock.adjustmentCreates).toHaveLength(0);
      await expect(stockOf(page, 'Wet Ash')).toHaveText('34,308 Kg (34.31 Tons)');
    });
  });

  test.describe('Unapproved procurements', () => {
    test('the button shows how many are waiting and opens the list', async ({ page }) => {
      await openInventory(page);
      await expect(unapprovedButton(page)).toContainText('3');
      await unapprovedButton(page).click();
      await expect(page).toHaveURL(/\/admin\/inventory\/unapproved-procurements$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Unapproved Procurements' })).toBeVisible();
      await expect(page.getByText('Review and approve pending procurement requests')).toBeVisible();
    });

    test('the button shows no number when nothing is waiting', async ({ page }) => {
      await openInventory(page, { procurementRows: PROCUREMENTS.filter((p) => p.approved) });
      await expect(unapprovedButton(page)).toHaveText('Unapproved procurements');
    });

    test('lists every pending request with its quantity in the unit it will be approved in', async ({ page }) => {
      await openInventory(page);
      await unapprovedButton(page).click();
      await expect(page.getByRole('button', { name: 'Approve procurement' })).toHaveCount(3);
      await expect(page.getByText('30 Tons')).toBeVisible();
      await expect(page.getByText('200 Bags')).toBeVisible();
      await expect(page.getByText('3 Units')).toBeVisible();
      await expect(page.getByText(/ kg$/i)).toHaveCount(0);
    });

    test('Back to Inventory Management returns to the inventory', async ({ page }) => {
      await openInventory(page);
      await unapprovedButton(page).click();
      await page.getByRole('button', { name: 'Back to Inventory Management' }).click();
      await expect(page).toHaveURL(/\/admin\/inventory$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Inventory Management' })).toBeVisible();
    });

    test('says so when nothing is waiting', async ({ page }) => {
      await openInventory(page, { procurementRows: PROCUREMENTS.filter((p) => p.approved) });
      await unapprovedButton(page).click();
      await expect(page.getByText('No unapproved procurements for this period')).toBeVisible();
    });

    test('shows an error when the list cannot be loaded', async ({ page }) => {
      await openAddress(page, '/admin/inventory/unapproved-procurements', { inventoryLoadFails: true });
      await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible();
      await expect(page.getByText('Failed to load procurements. Please try again.')).toBeVisible();
    });

    test.describe('approving', () => {
      const openCrusher = async (page: Page, options: MockOptions = {}) => {
        const mock = await openInventory(page, options);
        await unapprovedButton(page).click();
        // newest first: crusher powder (14 Oct), cement (13 Oct), wet ash (12 Oct)
        await page.getByRole('button', { name: 'Approve procurement' }).first().click();
        await expect(page.getByRole('heading', { name: 'Approve Procurement' })).toBeVisible();
        return mock;
      };

      test('opens with the request filled in and Approve off until a price is entered', async ({ page }) => {
        await openCrusher(page);
        await expect(approveField(page, 'Material')).toHaveValue('Crusher Powder');
        await expect(approveField(page, 'Vendor')).toHaveValue('ABC Suppliers');
        await expect(approveField(page, 'Quantity')).toHaveValue('3 Units');
        await expect(approveField(page, 'Total Price')).toHaveValue('₹0');
        await expect(approveField(page, 'Material')).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
      });

      test('names the price in the same unit as the quantity', async ({ page }) => {
        await openCrusher(page);
        await expect(page.getByLabel(/Price per Unit/)).toBeVisible();
        await page.getByRole('button', { name: 'Close modal' }).click();
        await page.getByRole('button', { name: 'Approve procurement' }).nth(1).click();
        await expect(page.getByLabel(/Price per Bag/)).toBeVisible();
        await expect(approveField(page, 'Quantity')).toHaveValue('200 Bags');
        await page.getByRole('button', { name: 'Close modal' }).click();
        await page.getByRole('button', { name: 'Approve procurement' }).nth(2).click();
        await expect(page.getByLabel(/Price per Ton/)).toBeVisible();
        await expect(approveField(page, 'Quantity')).toHaveValue('30 Tons');
      });

      test('works out the total from the price and enables Approve', async ({ page }) => {
        await openCrusher(page);
        await page.getByLabel(/Price per Unit/).fill('3000');
        await expect(approveField(page, 'Total Price')).toHaveValue('₹9,000');
        await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled();
      });

      test('approving sends the price and total, confirms, and drops it from the list', async ({ page }) => {
        const mock = await openCrusher(page);
        await page.getByLabel(/Price per Unit/).fill('3000');
        await page.getByRole('button', { name: 'Approve', exact: true }).click();

        await expect(page.getByRole('heading', { name: 'Procurement Approved' })).toBeVisible();
        await expect(page.getByText('Procurement has been approved successfully.')).toBeVisible();
        expect(mock.approvals).toEqual([{ p_procurement_id: 'proc-u3', p_rate_per_unit: 3000, p_total_price: 9000 }]);

        await page.getByRole('button', { name: 'OK' }).click();
        await expect(page.getByRole('button', { name: 'Approve procurement' })).toHaveCount(2);
        await expect(page.getByText('3 Units')).toHaveCount(0);
      });

      test('the approved quantity reaches the stock (in kg) and the procurement list, and the badge counts down', async ({ page }) => {
        await openCrusher(page);
        await page.getByLabel(/Price per Unit/).fill('3000');
        await page.getByRole('button', { name: 'Approve', exact: true }).click();
        await page.getByRole('button', { name: 'OK' }).click();
        await page.getByRole('button', { name: 'Back to Inventory Management' }).click();

        // 3 loads x 4,500 kg = 13,500 kg on top of 18,422.5 kg
        await expect(stockOf(page, 'Crusher Powder')).toHaveText('31,922.5 Kg (31.92 Tons)');
        await expect(unapprovedButton(page)).toContainText('2');
        await expect(page.getByText('3 Units')).toBeVisible();
        await expect(page.getByText('₹9,000')).toBeVisible();
        await expect(page.getByText('Total Price', { exact: true })).toHaveCount(4);
      });

      test('a cement approval adds 50 kg per bag; a wet ash approval adds 1,000 kg per ton', async ({ page }) => {
        await openInventory(page);
        await unapprovedButton(page).click();
        await page.getByRole('button', { name: 'Approve procurement' }).nth(1).click(); // 200 bags
        await page.getByLabel(/Price per Bag/).fill('380');
        await page.getByRole('button', { name: 'Approve', exact: true }).click();
        await page.getByRole('button', { name: 'OK' }).click();
        await page.getByRole('button', { name: 'Approve procurement' }).nth(1).click(); // 30 tons
        await page.getByLabel(/Price per Ton/).fill('900');
        await page.getByRole('button', { name: 'Approve', exact: true }).click();
        await page.getByRole('button', { name: 'OK' }).click();
        await page.getByRole('button', { name: 'Back to Inventory Management' }).click();

        await expect(stockOf(page, 'Cement')).toHaveText('12,775 Kg (256 Bags)');
        await expect(stockOf(page, 'Wet Ash')).toHaveText('64,308 Kg (64.31 Tons)');
        await expect(unapprovedButton(page)).toContainText('1'); // only the crusher powder request is left
      });

      test('closing the window without approving changes nothing', async ({ page }) => {
        const mock = await openCrusher(page);
        await page.getByLabel(/Price per Unit/).fill('3000');
        await page.getByRole('button', { name: 'Close modal' }).click();

        await expect(page.getByRole('heading', { name: 'Approve Procurement' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Approve procurement' })).toHaveCount(3);
        expect(mock.approvals).toHaveLength(0);
      });

      test('reopening a request starts with an empty price', async ({ page }) => {
        await openCrusher(page);
        await page.getByLabel(/Price per Unit/).fill('3000');
        await page.getByRole('button', { name: 'Close modal' }).click();
        await page.getByRole('button', { name: 'Approve procurement' }).first().click();
        await expect(page.getByLabel(/Price per Unit/)).toHaveValue('');
        await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
      });

      test('when approving fails it says so, keeps the request, and changes no stock', async ({ page }) => {
        const mock = await openCrusher(page, { approveFails: true });
        await page.getByLabel(/Price per Unit/).fill('3000');
        await page.getByRole('button', { name: 'Approve', exact: true }).click();

        await expect(page.getByText('Failed to approve procurement. Please try again.')).toBeVisible();
        expect(mock.approvals).toHaveLength(0);
        await page.getByRole('button', { name: 'OK' }).click();
        await page.getByRole('button', { name: 'Close modal' }).click();
        await expect(page.getByRole('button', { name: 'Approve procurement' })).toHaveCount(3);
        await page.getByRole('button', { name: 'Back to Inventory Management' }).click();
        await expect(stockOf(page, 'Crusher Powder')).toHaveText('18,422.5 Kg (18.42 Tons)');
      });
    });

    test.describe('rejecting', () => {
      test('rejecting deletes the request, confirms, and leaves the stock alone', async ({ page }) => {
        const mock = await openInventory(page);
        await unapprovedButton(page).click();
        await page.getByRole('button', { name: 'Approve procurement' }).nth(1).click(); // cement
        await page.getByRole('button', { name: 'Reject' }).click();

        await expect(page.getByRole('heading', { name: 'Procurement Rejected' })).toBeVisible();
        await expect(page.getByText('Procurement has been rejected and deleted.')).toBeVisible();
        expect(mock.procurementRejections).toEqual(['proc-u2']);

        await page.getByRole('button', { name: 'OK' }).click();
        await expect(page.getByRole('button', { name: 'Approve procurement' })).toHaveCount(2);
        await expect(page.getByText('200 Bags')).toHaveCount(0);
        await page.getByRole('button', { name: 'Back to Inventory Management' }).click();
        await expect(stockOf(page, 'Cement')).toHaveText('2,775 Kg (56 Bags)');
        await expect(unapprovedButton(page)).toContainText('2');
      });

      test('when rejecting fails it says so and keeps the request', async ({ page }) => {
        const mock = await openInventory(page, { rejectFails: true });
        await unapprovedButton(page).click();
        await page.getByRole('button', { name: 'Approve procurement' }).first().click();
        await page.getByRole('button', { name: 'Reject' }).click();

        await expect(page.getByText('Failed to reject procurement. Please try again.')).toBeVisible();
        expect(mock.procurementRejections).toHaveLength(0);
        await page.getByRole('button', { name: 'OK' }).click();
        await page.getByRole('button', { name: 'Close modal' }).click();
        await expect(page.getByRole('button', { name: 'Approve procurement' })).toHaveCount(3);
      });
    });
  });

  test.describe('Raw Material Stock screen', () => {
    const open = (page: Page, options: MockOptions = {}) => openAddress(page, '/admin/inventory/raw-material-stock', options);

    test('lists every material, alphabetically, in its own unit with the kg beside it', async ({ page }) => {
      await open(page);
      await expect(page.getByRole('heading', { level: 1, name: 'Raw Material Stock' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Cement', 'Crusher Powder', 'Fly Ash', 'Marble Powder', 'Wet Ash']);
      await expect(page.getByText('56 Bags (2,775 Kg)')).toBeVisible();
      await expect(page.getByText('4 Units (18,422.5 Kg)')).toBeVisible();
      await expect(page.getByText('7.97 Tons (7,975 Kg)')).toBeVisible();
      await expect(page.getByText('14.26 Tons (14,260 Kg)')).toBeVisible();
      await expect(page.getByText('34.31 Tons (34,308 Kg)')).toBeVisible();
    });

    test('summarises the number of materials, the total and the low stock', async ({ page }) => {
      await open(page);
      await expect(summary(page, 'Total Materials')).toHaveText('5');
      await expect(summary(page, 'Total Quantity')).toHaveText('77,740.5');
      await expect(summary(page, 'Low Stock Items')).toHaveText('0');
      await expect(page.getByText('Low stock ⚠️')).toHaveCount(0);
    });

    test('flags a material below 1,000 kg as low stock', async ({ page }) => {
      await open(page, {
        stockRows: INVENTORY_STOCK.map((s) => (s.materials.name === 'Cement' ? { ...s, quantity: 500 } : s)),
      });
      await expect(summary(page, 'Low Stock Items')).toHaveText('1');
      await expect(page.getByText('Low stock ⚠️')).toHaveCount(1);
      await expect(page.getByText('10 Bags (500 Kg)')).toBeVisible();
    });

    test('says when each material was last updated', async ({ page }) => {
      await open(page);
      await expect(page.getByText(/Last updated: 2 days ago/)).toHaveCount(5);
    });

    test('says so when no material is stocked', async ({ page }) => {
      await open(page, { stockRows: [] });
      await expect(page.getByText('No materials in inventory')).toBeVisible();
    });

    test('shows an error, which can be closed, when the stock cannot be loaded', async ({ page }) => {
      await open(page, { inventoryLoadFails: true });
      await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible();
      await expect(page.getByText('Failed to load inventory stock. Please try again.')).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('heading', { name: 'Error' })).toHaveCount(0);
    });
  });
  // Each of these describes what should happen and is expected to fail today (test.fail), so it
  // starts failing the suite, and can be promoted to a normal test, the day the gap is fixed.
  test.describe('known gaps', () => {
    test('an unknown address inside the module lands on Inventory Management', async ({ page }) => {
      test.fail(); // the catch-all redirects to "." which is the same address: a blank page
      await openAddress(page, '/admin/inventory/nothing-here');
      await expect(page.getByRole('heading', { level: 1, name: 'Inventory Management' })).toBeVisible();
    });

    for (const [screen, path] of [
      ['Raw Material Stock', '/admin/inventory/raw-material-stock'],
      ['Unapproved Procurements', '/admin/inventory/unapproved-procurements'],
    ]) {
      test(`Back to Inventory Management works on ${screen} opened straight from its address`, async ({ page }) => {
        test.fail(); // with no page to go back to, Back goes to a relative "inventory" that matches nothing
        await openAddress(page, path);
        await page.getByRole('button', { name: 'Back to Inventory Management' }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'Inventory Management' })).toBeVisible();
      });
    }

    test('Last month includes a procurement dated on the last day of the month', async ({ page }) => {
      test.fail(); // the end of the range is midnight local time, but dates are read as midnight UTC
      const lastDay = { ...PROCUREMENTS[3], id: 'proc-last-day', date: '2026-09-30' };
      await openInventory(page, { procurementRows: [...PROCUREMENTS, lastDay] });
      await periodFilter(page).selectOption('Last month');
      await expect(page.getByText('30-Sep-2026')).toBeVisible();
    });

    test('a failed approval does not announce "Procurement Approved"', async ({ page }) => {
      test.fail(); // the failure message is shown under the success title
      await openInventory(page, { approveFails: true });
      await unapprovedButton(page).click();
      await page.getByRole('button', { name: 'Approve procurement' }).first().click();
      await page.getByLabel(/Price per Unit/).fill('3000');
      await page.getByRole('button', { name: 'Approve', exact: true }).click();
      await expect(page.getByText('Failed to approve procurement. Please try again.')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Procurement Approved' })).toHaveCount(0);
    });

    test('a failed adjustment tells the administrator it failed', async ({ page }) => {
      test.fail(); // the error is kept in state but never shown
      await openInventory(page, { adjustmentFails: true });
      await adjustmentsButton(page).click();
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect(page.getByText(/adjustment failed|failed to submit/i)).toBeVisible();
    });
  });
});
