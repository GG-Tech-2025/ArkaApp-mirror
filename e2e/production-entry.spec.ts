import { expect, test, type Page } from '@playwright/test';
import { signInAsEmployee } from './support/employee';
import { mockSupabase, type SupabaseMock } from './support/supabase-mock';

// A fixed mid-month morning: today, earlier days and later days are all on one calendar page.
const NOW = new Date(2026, 9, 15, 10, 0, 0);

const FIELDS = {
  round: /^Round/,
  bricks: /^Bricks/,
  wetAsh: /^Wet Ash/,
  marblePowder: /^Marble Powder/,
  crusherPowder: /^Crusher Powder/,
  flyAsh: /^Fly Ash/,
  cement: /^Cement/,
};
type FieldKey = keyof typeof FIELDS;

const REQUIRED_MESSAGES: Record<FieldKey, string> = {
  round: 'Round is required',
  bricks: 'Bricks is required',
  wetAsh: 'Wet Ash is required',
  marblePowder: 'Marble Powder is required',
  crusherPowder: 'Crusher Powder is required',
  flyAsh: 'Fly Ash is required',
  cement: 'Cement is required',
};

const VALID: Record<FieldKey, string> = {
  round: '2',
  bricks: '1000',
  wetAsh: '150.5',
  marblePowder: '80',
  crusherPowder: '60',
  flyAsh: '40',
  cement: '12.5',
};

const field = (page: Page, key: FieldKey) => page.getByLabel(FIELDS[key]);
const notes = (page: Page) => page.getByLabel('Notes');
const submit = (page: Page) => page.getByRole('button', { name: /^Submit/ });
const dateButton = (page: Page) => page.getByRole('button', { name: /2026/ });

async function openForm(page: Page) {
  await page.getByRole('button', { name: /Production Entry/ }).click();
  await expect(page.getByRole('heading', { name: 'Production Entry' })).toBeVisible();
}

async function fillValid(page: Page, overrides: Partial<Record<FieldKey, string>> = {}) {
  const values = { ...VALID, ...overrides };
  for (const key of Object.keys(values) as FieldKey[]) {
    if (values[key] !== '') await field(page, key).fill(values[key]);
  }
}

test.describe('Production Entry screen', () => {
  let mock: SupabaseMock;

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    mock = await mockSupabase(page);
    await signInAsEmployee(page);
    await openForm(page);
  });

  test.describe('form', () => {
    test('shows every production field with its unit, starting empty with today as the date', async ({ page }) => {
      await expect(page.getByText('Enter the production details for today')).toBeVisible();
      await expect(page.getByText(/Wet Ash \(Kg\)/)).toBeVisible();
      await expect(page.getByText(/Marble Powder \(Kg\)/)).toBeVisible();
      await expect(page.getByText(/Crusher Powder \(Kg\)/)).toBeVisible();
      await expect(page.getByText(/Fly Ash \(Kg\)/)).toBeVisible();
      await expect(page.getByText(/Cement \(Bags\)/)).toBeVisible();
      for (const key of Object.keys(FIELDS) as FieldKey[]) await expect(field(page, key)).toHaveValue('');
      await expect(notes(page)).toHaveValue('');
      await expect(dateButton(page)).toContainText('October 15th, 2026');
      expect(mock.unexpected).toEqual([]);
    });

    test('Back to Home returns to the dashboard without recording anything', async ({ page }) => {
      await page.getByRole('button', { name: /Back to Home/ }).click();

      await expect(page).toHaveURL(/\/employee\/home$/);
      expect(mock.productionEntries).toHaveLength(0);
    });
  });

  test.describe('validation', () => {
    test('an empty form reports every missing figure, but not the date, and records nothing', async ({ page }) => {
      await submit(page).click();

      for (const message of Object.values(REQUIRED_MESSAGES)) await expect(page.getByText(message)).toBeVisible();
      await expect(page.getByText('Date is required')).toBeHidden();
      await expect(page).toHaveURL(/production-entry$/);
      expect(mock.productionEntries).toHaveLength(0);
    });

    for (const key of Object.keys(REQUIRED_MESSAGES) as FieldKey[]) {
      test(`leaving only ${key} empty reports just that field`, async ({ page }) => {
        await fillValid(page, { [key]: '' });

        await submit(page).click();

        await expect(page.getByText(REQUIRED_MESSAGES[key])).toBeVisible();
        await expect(page.getByText(/ is required$/)).toHaveCount(1);
        expect(mock.productionEntries).toHaveLength(0);
      });
    }

    test('a zero figure counts as missing', async ({ page }) => {
      await fillValid(page, { bricks: '0' });

      await submit(page).click();

      await expect(page.getByText('Bricks is required')).toBeVisible();
      expect(mock.productionEntries).toHaveLength(0);
    });

    test('a round above 99 is refused, and the message goes away when the round is edited', async ({ page }) => {
      await fillValid(page, { round: '100' });
      await submit(page).click();
      await expect(page.getByText('Round cannot exceed 99')).toBeVisible();
      expect(mock.productionEntries).toHaveLength(0);

      await field(page, 'round').fill('99');

      await expect(page.getByText('Round cannot exceed 99')).toBeHidden();
    });

    test('round 99 is the highest accepted', async ({ page }) => {
      await fillValid(page, { round: '99' });

      await submit(page).click();

      await expect(page.getByText('Production Entry Successful')).toBeVisible();
      expect(mock.productionEntries[0]).toMatchObject({ p_round: 99 });
    });

    test('the Notes box is optional', async ({ page }) => {
      await fillValid(page);

      await submit(page).click();

      await expect(page.getByText('Production Entry Successful')).toBeVisible();
    });

    test('the round error clears the moment the round is edited', async ({ page }) => {
      await submit(page).click();
      await expect(page.getByText(REQUIRED_MESSAGES.round)).toBeVisible();

      await field(page, 'round').fill('3');

      await expect(page.getByText(REQUIRED_MESSAGES.round)).toBeHidden();
    });
  });

  test.describe('negative quantities', () => {
    for (const [key, label] of [
      ['bricks', 'Bricks'],
      ['wetAsh', 'Wet Ash'],
      ['marblePowder', 'Marble Powder'],
      ['crusherPowder', 'Crusher Powder'],
      ['flyAsh', 'Fly Ash'],
      ['cement', 'Cement'],
    ] as Array<[FieldKey, string]>) {
      test(`a negative ${label} is refused with a message and records nothing`, async ({ page }) => {
        await fillValid(page, { [key]: '-5' });

        await submit(page).click();

        await expect(page.getByText(`${label} cannot be negative`)).toBeVisible();
        await expect(page).toHaveURL(/production-entry$/);
        expect(mock.productionEntries).toHaveLength(0);
      });
    }

    test('the message goes away once the figure is corrected, and the entry can then be saved', async ({ page }) => {
      await fillValid(page, { bricks: '-5' });
      await submit(page).click();
      await expect(page.getByText('Bricks cannot be negative')).toBeVisible();

      await field(page, 'bricks').fill('500');
      await expect(page.getByText('Bricks cannot be negative')).toBeHidden();
      await submit(page).click();

      await expect(page.getByText('Production Entry Successful')).toBeVisible();
      expect(mock.productionEntries[0]).toMatchObject({ p_bricks: 500 });
    });
  });

  test.describe('round must be at least 1', () => {
    for (const round of ['0', '-1']) {
      test(`round ${round} is refused with a message and records nothing`, async ({ page }) => {
        await fillValid(page, { round });

        await submit(page).click();

        await expect(page.getByText('Round must be at least 1')).toBeVisible();
        expect(mock.productionEntries).toHaveLength(0);
      });
    }

    test('round 1 is the lowest accepted', async ({ page }) => {
      await fillValid(page, { round: '1' });

      await submit(page).click();

      await expect(page.getByText('Production Entry Successful')).toBeVisible();
      expect(mock.productionEntries[0]).toMatchObject({ p_round: 1 });
    });
  });

  test.describe('figure errors clear as the figure is corrected', () => {
    for (const key of ['bricks', 'wetAsh', 'marblePowder', 'crusherPowder', 'flyAsh', 'cement'] as FieldKey[]) {
      test(`the ${key} error disappears as soon as ${key} is edited`, async ({ page }) => {
        await submit(page).click();
        await expect(page.getByText(REQUIRED_MESSAGES[key])).toBeVisible();

        await field(page, key).fill('5');

        await expect(page.getByText(REQUIRED_MESSAGES[key])).toBeHidden();
      });
    }

    test('correcting one figure leaves the other errors showing', async ({ page }) => {
      await submit(page).click();

      await field(page, 'bricks').fill('500');

      await expect(page.getByText(REQUIRED_MESSAGES.bricks)).toBeHidden();
      await expect(page.getByText(REQUIRED_MESSAGES.wetAsh)).toBeVisible();
      await expect(page.getByText(REQUIRED_MESSAGES.round)).toBeVisible();
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
    test('records the entry and confirms it, then OK returns to the dashboard', async ({ page }) => {
      await fillValid(page);
      await notes(page).fill('  Machine 2 was slow  ');

      await submit(page).click();

      await expect(page.getByText('Production Entry Successful')).toBeVisible();
      await expect(page.getByText('Production details have been entered successfully.')).toBeVisible();
      expect(mock.productionEntries).toEqual([
        {
          p_production_date: '2026-10-15',
          p_round: 2,
          p_bricks: 1000,
          p_wet_ash_kg: 150.5,
          p_marble_powder_kg: 80,
          p_crusher_powder_kg: 60,
          p_fly_ash_kg: 40,
          p_cement_bags: 12.5,
          p_notes: 'Machine 2 was slow',
        },
      ]);

      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page).toHaveURL(/\/employee\/home$/);
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    test('sends no notes when the box is empty or only spaces', async ({ page }) => {
      await fillValid(page);
      await notes(page).fill('     ');

      await submit(page).click();

      await expect(page.getByText('Production Entry Successful')).toBeVisible();
      expect(mock.productionEntries[0]).toMatchObject({ p_notes: null });
    });

    test('records the date that was picked', async ({ page }) => {
      await fillValid(page);
      await dateButton(page).click();
      await page.getByRole('gridcell', { name: '3', exact: true }).click();

      await submit(page).click();

      await expect(page.getByText('Production Entry Successful')).toBeVisible();
      expect(mock.productionEntries[0]).toMatchObject({ p_production_date: '2026-10-03' });
    });

    test('records exactly one entry even if Submit is pressed repeatedly', async ({ page }) => {
      await fillValid(page);

      await submit(page).dblclick();

      await expect(page.getByText('Production Entry Successful')).toBeVisible();
      expect(mock.productionEntries).toHaveLength(1);
    });

    test('makes no unexpected backend calls on the happy path', async ({ page }) => {
      await fillValid(page);
      await submit(page).click();
      await expect(page.getByText('Production Entry Successful')).toBeVisible();

      expect(mock.unexpected).toEqual([]);
    });
  });
});

test.describe('Production Entry screen, when the backend fails', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
  });

  test('a failed save shows an error popup and keeps the form so the employee can retry', async ({ page }) => {
    const mock = await mockSupabase(page, { productionFails: true });
    await signInAsEmployee(page);
    await openForm(page);
    await fillValid(page);
    await notes(page).fill('keep me');

    await submit(page).click();

    await expect(page.getByText('Submission Failed')).toBeVisible();
    await expect(page.getByText('Failed to submit production entry')).toBeVisible();
    expect(mock.productionEntries).toHaveLength(0);

    await page.getByRole('button', { name: 'OK' }).click();

    await expect(page).toHaveURL(/production-entry$/);
    await expect(field(page, 'round')).toHaveValue('2');
    await expect(field(page, 'bricks')).toHaveValue('1000');
    await expect(field(page, 'wetAsh')).toHaveValue('150.5');
    await expect(field(page, 'cement')).toHaveValue('12.5');
    await expect(notes(page)).toHaveValue('keep me');
    await expect(submit(page)).toBeEnabled();
  });

  test('the employee can record the entry after an earlier failure', async ({ page }) => {
    const mock = await mockSupabase(page, { productionFails: true });
    await signInAsEmployee(page);
    await openForm(page);
    await fillValid(page);
    await submit(page).click();
    await page.getByRole('button', { name: 'OK' }).click();

    // The backend recovers: a route registered later takes precedence over the failing one.
    await page.route('**/rest/v1/rpc/record_production_entry', async (route) => {
      mock.productionEntries.push(route.request().postDataJSON());
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

    await expect(page.getByText('Production Entry Successful')).toBeVisible();
    expect(mock.productionEntries).toHaveLength(1);
  });
});
