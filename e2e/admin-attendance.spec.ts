import { expect, test, type Page } from '@playwright/test';
import { signInAsAdmin } from './support/admin';
import { ATTENDANCE, mockSupabase, type SupabaseMock } from './support/supabase-mock';

// Today is fixed to 15 October 2026 (the screens work out "today" from the UTC date).
const NOW = new Date(Date.UTC(2026, 9, 15, 10, 0, 0));

const cardFor = (page: Page, name: string) =>
  page.getByText(name, { exact: true }).locator('xpath=ancestor::div[.//button[normalize-space()="Present"]][1]');
const mark = (page: Page, name: string, status: string) =>
  cardFor(page, name).getByRole('button', { name: status, exact: true }).click();
const status = (page: Page, name: string, label: string) => cardFor(page, name).getByRole('button', { name: label, exact: true });
const date = (page: Page) => page.getByLabel('Select Date');
const save = (page: Page) => page.getByRole('button', { name: 'Save Attendance' });

async function openAttendance(page: Page) {
  await page.getByRole('button', { name: /Employee Management/ }).click();
  await page.getByRole('button', { name: /Attendance/ }).click();
  await expect(page.getByRole('heading', { name: 'Employee Attendance' })).toBeVisible();
  await expect(page.getByText('Mohan Das', { exact: true })).toBeVisible();
}

async function markEveryone(page: Page, label: 'Mark All Present' | 'Mark All Leave') {
  await page.getByRole('button', { name: label }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
}

test.describe('Attendance (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
  });

  test.describe('the day\'s list', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page);
      await signInAsAdmin(page);
      await openAttendance(page);
    });

    test('opens on today, with the date limited to today at most', async ({ page }) => {
      await expect(date(page)).toHaveValue('2026-10-15');
      await expect(date(page)).toHaveAttribute('max', '2026-10-15');
    });

    test('lists the active employees who are paid by the day or month, but not load men', async ({ page }) => {
      await expect(page.getByText('Anita Rao', { exact: true })).toBeVisible();
      await expect(page.getByText('Mohan Das', { exact: true })).toBeVisible();
      await expect(page.getByText('Ravi Kumar', { exact: true })).toBeHidden();
      await expect(page.getByText('Old Hand', { exact: true })).toBeHidden();
    });

    test('shows each employee\'s role and category, and the four choices, none chosen', async ({ page }) => {
      await expect(cardFor(page, 'Anita Rao')).toContainText('Supervisor');
      await expect(cardFor(page, 'Anita Rao')).toContainText('Fixed Salary');
      await expect(cardFor(page, 'Mohan Das')).toContainText('Daily Wages');
      await expect(cardFor(page, 'Mohan Das').getByRole('button')).toHaveText(['Present', 'Absent', 'Half Day', 'Leave']);
    });

    test('Back to Employee Management and View Attendance navigate', async ({ page }) => {
      await page.getByRole('button', { name: /View Attendance/ }).click();
      await expect(page).toHaveURL(/\/admin\/employees\/attendance\/view$/);
      await page.getByRole('button', { name: /Back to Attendance/ }).click();
      await expect(page).toHaveURL(/\/admin\/employees\/attendance$/);

      await page.getByRole('button', { name: /Back to Employee Management/ }).click();
      await expect(page).toHaveURL(/\/admin\/employees$/);
    });

    test('makes no unexpected backend calls', async () => {
      expect(mock.unexpected).toEqual([]);
    });
  });

  test.describe('marking and saving', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page);
      await signInAsAdmin(page);
      await openAttendance(page);
    });

    test('Save with someone unmarked is refused with a message', async ({ page }) => {
      await mark(page, 'Mohan Das', 'Present');

      await save(page).click();

      await expect(page.getByText('Attendance is required for all employees. Please mark attendance for everyone.')).toBeVisible();
      expect(mock.attendanceSaves).toHaveLength(0);
    });

    test('the warning goes away as soon as someone is marked', async ({ page }) => {
      await save(page).click();
      await expect(page.getByText(/Attendance is required for all employees/)).toBeVisible();

      await mark(page, 'Mohan Das', 'Present');

      await expect(page.getByText(/Attendance is required for all employees/)).toBeHidden();
    });

    test('a status can be changed before saving', async ({ page }) => {
      await mark(page, 'Mohan Das', 'Absent');
      await mark(page, 'Mohan Das', 'Present');

      await expect(status(page, 'Mohan Das', 'Present')).toHaveClass(/bg-green-600/);
      await expect(status(page, 'Mohan Das', 'Absent')).not.toHaveClass(/bg-red-600/);
    });

    test('Mark All Present asks first, Cancel changes nothing, Confirm marks everyone', async ({ page }) => {
      await page.getByRole('button', { name: 'Mark All Present' }).click();
      await expect(page.getByText('Confirm Bulk Action')).toBeVisible();
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(status(page, 'Mohan Das', 'Present')).not.toHaveClass(/bg-green-600/);

      await markEveryone(page, 'Mark All Present');

      await expect(status(page, 'Mohan Das', 'Present')).toHaveClass(/bg-green-600/);
      await expect(status(page, 'Anita Rao', 'Present')).toHaveClass(/bg-green-600/);
    });

    test('Mark All Leave replaces earlier choices', async ({ page }) => {
      await mark(page, 'Mohan Das', 'Present');

      await markEveryone(page, 'Mark All Leave');

      await expect(status(page, 'Mohan Das', 'Leave')).toHaveClass(/bg-orange-600/);
      await expect(status(page, 'Anita Rao', 'Leave')).toHaveClass(/bg-orange-600/);
    });

    test('saves the day, with a day\'s wage for the daily-wage employee and nothing extra for a fixed salary', async ({ page }) => {
      await markEveryone(page, 'Mark All Present');

      await save(page).click();

      await expect(page.getByText('Attendance saved successfully!')).toBeVisible();
      expect(mock.attendanceSaves).toHaveLength(1);
      const body = mock.attendanceSaves[0] as { p_date: string; p_attendance: unknown[]; p_entries: Array<Record<string, unknown>> };
      expect(body.p_date).toBe('2026-10-15');
      expect(body.p_attendance).toEqual([
        { employee_id: 'emp-2', status: 'PRESENT' },
        { employee_id: 'emp-3', status: 'PRESENT' },
      ]);
      expect(body.p_entries).toEqual([
        expect.objectContaining({
          employee_id: 'emp-3',
          entry_type: 'SALARY_AUTO_ENTRY',
          amount: 650,
          notes: 'Auto-entry for 2026-10-15 — Present',
        }),
      ]);
    });

    test('a half day pays half, and a fixed-salary employee who is absent or on a half day is charged their deduction', async ({ page }) => {
      await mark(page, 'Mohan Das', 'Half Day');
      await mark(page, 'Anita Rao', 'Absent');
      await save(page).click();
      await expect(page.getByText('Attendance saved successfully!')).toBeVisible();

      const entries = (mock.attendanceSaves[0] as { p_entries: Array<Record<string, unknown>> }).p_entries;
      expect(entries).toContainEqual(expect.objectContaining({ employee_id: 'emp-3', entry_type: 'SALARY_AUTO_ENTRY', amount: 325 }));
      expect(entries).toContainEqual(expect.objectContaining({ employee_id: 'emp-2', entry_type: 'DEDUCTION', amount: 250, notes: 'Deduction for 2026-10-15 — Absent' }));
    });

    test('a fixed-salary half day is charged half the deduction', async ({ page }) => {
      await mark(page, 'Mohan Das', 'Leave');
      await mark(page, 'Anita Rao', 'Half Day');
      await save(page).click();
      await expect(page.getByText('Attendance saved successfully!')).toBeVisible();

      const entries = (mock.attendanceSaves[0] as { p_entries: Array<Record<string, unknown>> }).p_entries;
      expect(entries).toEqual([expect.objectContaining({ employee_id: 'emp-2', entry_type: 'DEDUCTION', amount: 125 })]);
    });

    test('after saving, the day is read-only and cannot be changed again', async ({ page }) => {
      await markEveryone(page, 'Mark All Present');
      await save(page).click();
      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page.getByText('Attendance for this date has already been recorded and cannot be modified.')).toBeVisible();
      await expect(save(page)).toBeHidden();
      await expect(page.getByRole('button', { name: 'Mark All Present' })).toBeHidden();
      await expect(status(page, 'Mohan Das', 'Present')).toBeDisabled();
    });

    test('reopening the screen shows the saved day as read-only with the recorded statuses', async ({ page }) => {
      await mark(page, 'Mohan Das', 'Half Day');
      await mark(page, 'Anita Rao', 'Leave');
      await save(page).click();
      await page.getByRole('button', { name: 'OK' }).click();

      await page.reload();

      await expect(page.getByText('Mohan Das', { exact: true })).toBeVisible();
      await expect(status(page, 'Mohan Das', 'Half Day')).toHaveClass(/bg-yellow-600/);
      await expect(status(page, 'Anita Rao', 'Leave')).toHaveClass(/bg-orange-600/);
      await expect(save(page)).toBeHidden();
    });
  });

  test.describe('other dates', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page);
      await signInAsAdmin(page);
      await openAttendance(page);
    });

    test('yesterday can still be marked, with a note that it is a past date', async ({ page }) => {
      await date(page).fill('2026-10-14');

      await expect(page.getByText('You are marking attendance for a past date.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Mark All Present' })).toBeVisible();
    });

    test('attendance for a past date is saved against that date', async ({ page }) => {
      await date(page).fill('2026-10-13');
      await expect(page.getByText('You are marking attendance for a past date.')).toBeVisible();
      await markEveryone(page, 'Mark All Present');

      await save(page).click();

      await expect(page.getByText('Attendance saved successfully!')).toBeVisible();
      expect((mock.attendanceSaves[0] as { p_date: string }).p_date).toBe('2026-10-13');
    });

    test('a date more than three days back cannot be changed', async ({ page }) => {
      await date(page).fill('2026-10-11');

      await expect(page.getByText('You cannot modify attendance for dates more than 3 days in the past.')).toBeVisible();
      await expect(save(page)).toBeHidden();
      await expect(status(page, 'Mohan Das', 'Present')).toBeDisabled();
    });

    test('three days back is the oldest that can still be changed', async ({ page }) => {
      await date(page).fill('2026-10-12');

      await expect(page.getByRole('button', { name: 'Mark All Present' })).toBeVisible();
    });
  });

  test.describe('inactive employees', () => {
    test('are listed under the Inactive tab, read-only', async ({ page }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);
      await openAttendance(page);

      await page.getByRole('button', { name: 'Inactive Employees' }).click();

      await expect(page.getByText('Old Hand', { exact: true })).toBeVisible();
      await expect(page.getByText('Mohan Das', { exact: true })).toBeHidden();
      await expect(save(page)).toBeHidden();
      await expect(page.getByRole('button', { name: 'Present', exact: true })).toBeDisabled();
    });
  });

  test.describe('when saving fails', () => {
    test('says so, keeps the choices, and does not mark the day as saved', async ({ page }) => {
      const mock = await mockSupabase(page, { attendanceSaveFails: true });
      await signInAsAdmin(page);
      await openAttendance(page);
      await markEveryone(page, 'Mark All Present');

      await save(page).click();

      await expect(page.getByText('Failed to save attendance. Please try again.')).toBeVisible();
      await expect(page.getByText('Attendance saved successfully!')).toBeHidden();
      await expect(status(page, 'Mohan Das', 'Present')).toHaveClass(/bg-green-600/);
      await expect(save(page)).toBeEnabled();
      expect(mock.attendanceSaves).toHaveLength(0);
    });
  });
});

test.describe('Attendance overview (admin)', () => {
  // Mohan: present every day from the 1st to the 14th except the 2nd (absent) and the 3rd (leave);
  // Anita: three days; Old Hand (inactive): the 1st and 2nd. Nobody was recorded on the 4th.
  const october = () => {
    const rows: Array<Record<string, unknown>> = [];
    for (let day = 1; day <= 14; day++) {
      if (day === 4) continue;
      rows.push({
        employee_id: 'emp-3',
        date: `2026-10-${String(day).padStart(2, '0')}`,
        status: day === 2 ? 'ABSENT' : day === 3 ? 'LEAVE' : 'PRESENT',
      });
    }
    rows.push(
      { employee_id: 'emp-2', date: '2026-10-01', status: 'PRESENT' },
      { employee_id: 'emp-2', date: '2026-10-02', status: 'HALF_DAY' },
      { employee_id: 'emp-2', date: '2026-10-03', status: 'PRESENT' },
      { employee_id: 'emp-9', date: '2026-10-01', status: 'PRESENT' },
      { employee_id: 'emp-9', date: '2026-10-02', status: 'PRESENT' },
    );
    return rows;
  };

  const table = (page: Page) => page.getByRole('table');
  const rowFor = (page: Page, name: string) => table(page).getByRole('row', { name: new RegExp(name) });

  async function openOverview(page: Page) {
    await page.clock.setFixedTime(NOW);
    await mockSupabase(page, { attendance: [...ATTENDANCE, ...october()] });
    await signInAsAdmin(page);
    await openAttendance(page);
    await page.getByRole('button', { name: /View Attendance/ }).click();
    await expect(page.getByRole('heading', { name: 'Attendance Overview' })).toBeVisible();
    await expect(table(page).getByText('Mohan Das')).toBeVisible();
  }

  test('shows each employee\'s days as P, A, H or L, with a column for every day up to today', async ({ page }) => {
    await openOverview(page);

    const mohan = await rowFor(page, 'Mohan Das').getByRole('cell').allTextContents();
    expect(mohan[1]).toBe('P');
    expect(mohan[2]).toBe('A');
    expect(mohan[3]).toBe('L');
    await expect(table(page).getByRole('columnheader')).toHaveCount(1 + 15 + 4);
    const anita = await rowFor(page, 'Anita Rao').getByRole('cell').allTextContents();
    expect(anita[2]).toBe('H');
  });

  test('totals each employee\'s statuses', async ({ page }) => {
    await openOverview(page);

    const mohan = await rowFor(page, 'Mohan Das').getByRole('cell').allTextContents();
    expect(mohan.slice(-4)).toEqual(['11', '1', '0', '1']);
    const anita = await rowFor(page, 'Anita Rao').getByRole('cell').allTextContents();
    expect(anita.slice(-4)).toEqual(['2', '0', '1', '0']);
  });

  test('marks the date nobody was recorded for, and says how many were missed', async ({ page }) => {
    await openOverview(page);

    await expect(table(page).getByRole('columnheader', { name: /^4/ })).toHaveAttribute('title', 'No attendance recorded for this date');
    await expect(page.getByText('1 date')).toBeVisible();
    await expect(page.getByText(/has no attendance recorded/)).toBeVisible();
  });

  test('lists an inactive employee who has records, with an Inactive badge and greyed-out later days', async ({ page }) => {
    await openOverview(page);

    await expect(rowFor(page, 'Old Hand')).toContainText('Inactive');
    const cells = rowFor(page, 'Old Hand').getByRole('cell');
    await expect(cells.nth(3)).toHaveAttribute('title', 'Employee was inactive');
  });

  test('offers only the months from the app start, and the year list from the start year', async ({ page }) => {
    await openOverview(page);

    await expect(page.getByRole('combobox').first().locator('option')).toHaveText(['October', 'November', 'December']);
    await expect(page.getByRole('combobox').nth(1).locator('option').first()).toHaveText('2026');
  });

  test('a later month shows no days yet', async ({ page }) => {
    await openOverview(page);

    await page.getByRole('combobox').first().selectOption('November');

    await expect(table(page).getByRole('columnheader')).toHaveCount(5); // name, P, A, H, L
  });

  test('Back to Attendance returns to the day\'s list', async ({ page }) => {
    await openOverview(page);

    await page.getByRole('button', { name: /Back to Attendance/ }).click();

    await expect(page).toHaveURL(/\/admin\/employees\/attendance$/);
  });
});
