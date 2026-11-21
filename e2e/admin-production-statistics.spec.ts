import { expect, test, type Page } from '@playwright/test';
import { signInAsAdmin } from './support/admin';
import { signInAsEmployee } from './support/employee';
import { mockSupabase, type MockOptions } from './support/supabase-mock';

// The screen formats dates in the browser's timezone; pin one so a run gives the same result anywhere.
test.use({ timezoneId: 'Asia/Kolkata' });

type Row = Record<string, unknown>;

const entry = (overrides: Row = {}): Row => ({
  id: 'p', production_date: '2026-10-14', bricks: 9000, round: 25,
  wet_ash_kg: 500, marble_powder_kg: 120.5, crusher_powder_kg: 80, fly_ash_kg: 40,
  cement_bags: 12, notes: 'Second shift ran late', created_by: 'u1', created_at: '2026-10-14T10:00:00Z',
  ...overrides,
});

const LATEST = entry({ id: 'p3' });
const MIDDLE = entry({ id: 'p2', production_date: '2026-10-13', bricks: 7500, round: 10, wet_ash_kg: 200, marble_powder_kg: 0, crusher_powder_kg: 0, fly_ash_kg: 0, cement_bags: 4, notes: 'Kiln two was restarted after lunch because the burner stalled' });
const OLDEST = entry({ id: 'p1', production_date: '2026-10-12', bricks: 6000, round: 1, wet_ash_kg: 300, marble_powder_kg: 0, crusher_powder_kg: 0, fly_ash_kg: 0, cement_bags: 0, notes: null });
const HISTORY = [LATEST, MIDDLE, OLDEST];

/** Signs in as the admin and opens Production Statistics from the dashboard. */
async function openProduction(page: Page, options: MockOptions = { productionHistory: HISTORY }) {
  await mockSupabase(page, { signedInAs: 'admin', ...options });
  await signInAsAdmin(page);
  await page.getByRole('heading', { name: 'Production Statistics' }).click();
  await expect(page).toHaveURL(/\/admin\/production$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Production Statistics' })).toBeVisible();
}

const card = (page: Page) => page.getByRole('heading', { name: 'Last Production' }).locator('..');
const row = (page: Page, date: string) => page.getByRole('row', { name: new RegExp(date) });
const labelled = (page: Page, label: string) => page.getByText(label, { exact: true }).locator('..');
// The graph is an SVG with no roles, so it can only be found by recharts' own class names.
const dots = (page: Page) => page.locator('.recharts-line-dots .recharts-dot');
const legend = (page: Page) => page.locator('.recharts-legend-item-text');
const ring = (page: Page) => page.locator('circle[stroke="#10B981"]');

test.describe('Production Statistics (admin)', () => {
  test.describe('getting there', () => {
    test('opens from the dashboard and says what the screen is for', async ({ page }) => {
      await openProduction(page);
      await expect(page.getByText('View production metrics and performance')).toBeVisible();
      await expect(page.getByRole('heading', { name: "This Month's Production" })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Last Production' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Production History' })).toBeVisible();
    });

    test('Back to Home returns to the dashboard', async ({ page }) => {
      await openProduction(page);
      await page.getByRole('button', { name: 'Back to Home' }).click();
      await expect(page).toHaveURL(/\/admin\/home$/);
      await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    });

    test('can be opened straight from its address, and Back to Home still goes to the dashboard', async ({ page }) => {
      await mockSupabase(page, { signedInAs: 'admin', productionHistory: HISTORY });
      await signInAsAdmin(page);
      await page.goto('/admin/production');
      await expect(page.getByRole('heading', { level: 1, name: 'Production Statistics' })).toBeVisible();
      await expect(row(page, '14-Oct-2026')).toBeVisible();
      await page.getByRole('button', { name: 'Back to Home' }).click();
      await expect(page).toHaveURL(/\/admin\/home$/);
    });

    test('someone who is not signed in is sent to the admin login', async ({ page }) => {
      await mockSupabase(page, { signedInAs: 'admin', productionHistory: HISTORY });
      await page.goto('/admin/production');
      await expect(page).toHaveURL(/\/admin\/login$/);
      await expect(page.getByRole('heading', { name: 'Production Statistics' })).toBeHidden();
    });

    test('an employee cannot open it: they are signed out and sent to the admin login', async ({ page }) => {
      await mockSupabase(page, { productionHistory: HISTORY });
      await signInAsEmployee(page);
      await page.goto('/admin/production');
      await expect(page).toHaveURL(/\/admin\/login$/);
      await expect(page.getByRole('heading', { name: 'Production Statistics' })).toBeHidden();
    });
  });

  test.describe('while the history loads', () => {
    test('says "Loading chart…" and then draws the chart', async ({ page }) => {
      await openProduction(page, { productionHistory: HISTORY, productionHistoryDelayMs: 1500 });
      await expect(page.getByText('Loading chart…')).toBeVisible();
      await expect(legend(page)).toBeHidden();
      await expect(page.getByText('Loading chart…')).toBeHidden();
      await expect(legend(page)).toHaveText('Bricks Produced');
      await expect(row(page, '14-Oct-2026')).toBeVisible();
    });
  });

  test.describe("This Month's Production graph", () => {
    test('plots a point per day, oldest on the left, with short date labels and a legend', async ({ page }) => {
      await openProduction(page);
      await expect(legend(page)).toBeVisible();
      await expect(dots(page)).toHaveCount(3);
      const labels = page.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value');
      await expect(labels).toHaveText(['12 Oct', '13 Oct', '14 Oct']);
    });

    test('hovering a point shows the bricks for that day', async ({ page }) => {
      await openProduction(page);
      await dots(page).nth(2).hover();
      await expect(page.locator('.recharts-tooltip-wrapper')).toContainText('14 Oct');
      await expect(page.locator('.recharts-tooltip-wrapper')).toContainText('Bricks Produced');
      await expect(page.locator('.recharts-tooltip-wrapper')).toContainText('9000');
    });

    test('plots only the 30 most recent days when there are more, but the table lists them all', async ({ page }) => {
      const days = Array.from({ length: 35 }, (_, i) => {
        const d = new Date(Date.UTC(2026, 9, 31 - i));
        return entry({ id: `d${i}`, production_date: d.toISOString().slice(0, 10), bricks: 1000 + i });
      });
      await openProduction(page, { productionHistory: days });
      await expect(dots(page)).toHaveCount(30);
      await expect(page.getByRole('row')).toHaveCount(36);
    });

    test('draws no points when there is no history', async ({ page }) => {
      await openProduction(page, { productionHistory: [] });
      await expect(legend(page)).toBeVisible();
      await expect(dots(page)).toHaveCount(0);
    });
  });

  test.describe('Last Production card', () => {
    test("shows the newest day's bricks against the 15,000 target, and its round", async ({ page }) => {
      await openProduction(page);
      await expect(card(page)).toContainText('9,000');
      await expect(card(page)).toContainText('/ 15,000');
      await expect(labelled(page, 'Round:')).toContainText('25');
    });

    test('shows each material in tons with the total kg beneath, and cement in bags', async ({ page }) => {
      await openProduction(page);
      await expect(labelled(page, 'Wet Ash:')).toContainText('12.50 Tons');
      await expect(labelled(page, 'Wet Ash:')).toContainText('12,500 kg');
      await expect(labelled(page, 'Marble Powder:')).toContainText('3.01 Tons');
      await expect(labelled(page, 'Marble Powder:')).toContainText('3,012.5 kg');
      await expect(labelled(page, 'Crusher Powder:')).toContainText('2.00 Tons');
      await expect(labelled(page, 'Crusher Powder:')).toContainText('2,000 kg');
      await expect(labelled(page, 'Fly Ash:')).toContainText('1.00 Tons');
      await expect(labelled(page, 'Fly Ash:')).toContainText('1,000 kg');
      await expect(labelled(page, 'Cement:')).toContainText('12 Bags');
      await expect(labelled(page, 'Cement:')).not.toContainText('kg');
    });

    test('fills the ring in proportion to the target', async ({ page }) => {
      await openProduction(page, { productionHistory: [entry({ bricks: 7500 })] });
      // Half the target done, so half of the 440 ring is left empty.
      await expect(ring(page)).toHaveAttribute('stroke-dashoffset', '220');
    });

    test('shows a full ring when production beats the target', async ({ page }) => {
      await openProduction(page, { productionHistory: [entry({ bricks: 20000 })] });
      await expect(card(page)).toContainText('20,000');
      await expect(ring(page)).toHaveAttribute('stroke-dashoffset', '0');
    });

    test('shows dashes and an empty ring when nothing has been produced yet', async ({ page }) => {
      await openProduction(page, { productionHistory: [] });
      for (const label of ['Round:', 'Wet Ash:', 'Marble Powder:', 'Crusher Powder:', 'Fly Ash:', 'Cement:']) {
        await expect(labelled(page, label)).toContainText('-');
      }
      await expect(ring(page)).toHaveAttribute('stroke-dashoffset', '440');
    });
  });

  test.describe('Production History table', () => {
    test('has a column for each figure, in both units for the materials', async ({ page }) => {
      await openProduction(page);
      await expect(page.getByRole('columnheader')).toHaveText([
        'Date', 'No of Bricks', 'Round',
        'Wet Ash (Tons / kg)', 'Marble Powder (Tons / kg)', 'Crusher Powder (Tons / kg)', 'Fly Ash (Tons / kg)',
        'Cement (Bags)', 'Notes', 'Details',
      ]);
    });

    test('lists every day, newest first', async ({ page }) => {
      await openProduction(page);
      const rows = page.getByRole('row');
      await expect(rows).toHaveCount(4); // header + 3
      await expect(rows.nth(1)).toContainText('14-Oct-2026');
      await expect(rows.nth(2)).toContainText('13-Oct-2026');
      await expect(rows.nth(3)).toContainText('12-Oct-2026');
    });

    test('shows each figure formatted for reading', async ({ page }) => {
      await openProduction(page);
      const cells = row(page, '14-Oct-2026').getByRole('cell');
      await expect(cells.nth(0)).toHaveText('14-Oct-2026');
      await expect(cells.nth(1)).toHaveText('9,000');
      await expect(cells.nth(2)).toHaveText('25');
      await expect(cells.nth(3)).toHaveText(/^12\.50 Tons\s*12,500 kg$/);
      await expect(cells.nth(4)).toHaveText(/^3\.01 Tons\s*3,012\.5 kg$/);
      await expect(cells.nth(5)).toHaveText(/^2\.00 Tons\s*2,000 kg$/);
      await expect(cells.nth(6)).toHaveText(/^1\.00 Tons\s*1,000 kg$/);
      await expect(cells.nth(7)).toHaveText('12');
    });

    test('shortens a long note, shows a short one in full, and a dash when there is none', async ({ page }) => {
      await openProduction(page);
      await expect(row(page, '13-Oct-2026')).toContainText('Kiln two was restarted af...');
      await expect(row(page, '13-Oct-2026')).not.toContainText('burner stalled');
      await expect(row(page, '14-Oct-2026')).toContainText('Second shift ran late');
      await expect(row(page, '12-Oct-2026').getByRole('cell').nth(8)).toHaveText('—');
    });

    test('shows half a bag of cement as 7.5, in the card, the table and the details', async ({ page }) => {
      await openProduction(page, { productionHistory: [entry({ cement_bags: 7.5 })] });
      await expect(labelled(page, 'Cement:')).toContainText('7.5 Bags');
      await expect(row(page, '14-Oct-2026').getByRole('cell').nth(7)).toHaveText('7.5');
      await page.getByRole('button', { name: 'View details for 14-Oct-2026' }).click();
      await expect(page.getByRole('heading', { name: 'Production Entry' }).locator('..')).toContainText('7.5 Bags');
    });

    test('shows zero for a material the backend left empty', async ({ page }) => {
      await openProduction(page, {
        productionHistory: [entry({ wet_ash_kg: null, marble_powder_kg: null, crusher_powder_kg: null, fly_ash_kg: null, cement_bags: null })],
      });
      const cells = row(page, '14-Oct-2026').getByRole('cell');
      await expect(cells.nth(3)).toHaveText(/^0\.00 Tons\s*0 kg$/);
      await expect(cells.nth(7)).toHaveText('0');
    });

    test('has only its header when there is no history, and no Load More button', async ({ page }) => {
      await openProduction(page, { productionHistory: [] });
      await expect(page.getByRole('row')).toHaveCount(1);
      await expect(page.getByRole('button', { name: 'Load More' })).toBeHidden();
    });
  });

  test.describe('entry details', () => {
    test('opens for the chosen day with every figure and the working for each material', async ({ page }) => {
      await openProduction(page);
      await expect(page.getByRole('heading', { name: 'Production Entry' })).toBeHidden();
      await page.getByRole('button', { name: 'View details for 14-Oct-2026' }).click();

      const details = page.getByRole('heading', { name: 'Production Entry' }).locator('..');
      await expect(details).toContainText('14-Oct-2026');
      await expect(details).toContainText('9,000');
      await expect(details).toContainText('500 kg × 25 rounds = 12,500 kg');
      await expect(details).toContainText('120.5 kg × 25 rounds = 3,012.5 kg');
      await expect(details).toContainText('80 kg × 25 rounds = 2,000 kg');
      await expect(details).toContainText('40 kg × 25 rounds = 1,000 kg');
      await expect(details).toContainText('12 Bags');
    });

    test('shows the whole note, which the table shortens', async ({ page }) => {
      await openProduction(page);
      await page.getByRole('button', { name: 'View details for 13-Oct-2026' }).click();
      await expect(page.getByText('Kiln two was restarted after lunch because the burner stalled')).toBeVisible();
    });

    test('says "1 round" for a single round and shows a dash when there is no note', async ({ page }) => {
      await openProduction(page);
      await page.getByRole('button', { name: 'View details for 12-Oct-2026' }).click();
      const details = page.getByRole('heading', { name: 'Production Entry' }).locator('..');
      await expect(details).toContainText('300 kg × 1 round = 300 kg');
      await expect(details.getByText('Notes').locator('..')).toContainText('—');
    });

    test('Close dismisses it, and another day can be opened afterwards', async ({ page }) => {
      await openProduction(page);
      await page.getByRole('button', { name: 'View details for 14-Oct-2026' }).click();
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('heading', { name: 'Production Entry' })).toBeHidden();

      await page.getByRole('button', { name: 'View details for 13-Oct-2026' }).click();
      await expect(page.getByRole('heading', { name: 'Production Entry' }).locator('..')).toContainText('13-Oct-2026');
    });

    test('works from the keyboard', async ({ page }) => {
      await openProduction(page);
      await page.getByRole('button', { name: 'View details for 14-Oct-2026' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: 'Production Entry' })).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: 'Production Entry' })).toBeHidden();
    });
  });

  test.describe('when the history cannot be loaded', () => {
    test('shows an error popup, and OK returns to the dashboard', async ({ page }) => {
      await openProduction(page, { productionHistoryFails: true });
      await expect(page.getByRole('heading', { name: 'Error Loading Data' })).toBeVisible();
      await expect(page.getByText('Failed to load production entries. Please try again.')).toBeVisible();
      await expect(page.getByRole('row')).toHaveCount(1);

      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page).toHaveURL(/\/admin\/home$/);
      await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    });
  });

  test.describe('dates in other timezones', () => {
    test.describe('in New York, behind UTC', () => {
      test.use({ timezoneId: 'America/New_York' });

      test('still show the day that was recorded, not the day before', async ({ page }) => {
        await openProduction(page);
        await expect(page.getByRole('row').nth(1)).toContainText('14-Oct-2026');
        await expect(page.getByRole('button', { name: 'View details for 14-Oct-2026' })).toBeVisible();
        await expect(page.locator('.recharts-xAxis .recharts-cartesian-axis-tick-value')).toHaveText(['12 Oct', '13 Oct', '14 Oct']);
      });
    });

    test.describe('in Auckland, ahead of UTC', () => {
      test.use({ timezoneId: 'Pacific/Auckland' });

      test('show the day that was recorded', async ({ page }) => {
        await openProduction(page);
        await expect(page.getByRole('row').nth(1)).toContainText('14-Oct-2026');
      });
    });
  });

  test.describe('on a phone', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
    });

    test('the page does not scroll sideways: only the table does', async ({ page }) => {
      await openProduction(page);
      await expect(row(page, '14-Oct-2026')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('the chart, the card and the details still work', async ({ page }) => {
      await openProduction(page);
      await expect(legend(page)).toBeVisible();
      await expect(labelled(page, 'Wet Ash:')).toContainText('12,500 kg');
      await page.getByRole('button', { name: 'View details for 14-Oct-2026' }).click();
      await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
      await page.getByRole('button', { name: 'Close' }).click();
      await page.getByRole('button', { name: 'Back to Home' }).click();
      await expect(page).toHaveURL(/\/admin\/home$/);
    });
  });
});
