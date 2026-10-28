import { expect, test, type Page } from '@playwright/test';
import { signInAsAdmin } from './support/admin';
import { EMPLOYEES, mockSupabase, type SupabaseMock } from './support/supabase-mock';

// Today is fixed to 15 October 2026, so the salary being calculated is September's.
const NOW = new Date(Date.UTC(2026, 9, 15, 10, 0, 0));

const ledgerCard = (page: Page, name: string) =>
  page.getByText(name, { exact: true }).locator('xpath=ancestor::div[.//button[contains(.,"Open Ledger")]][1]');

async function openSalaryLedger(page: Page) {
  await page.getByRole('button', { name: /Salary Ledger/ }).click();
  await expect(page.getByRole('heading', { name: 'Employee Salary Ledger' })).toBeVisible();
  await expect(page.getByText('Ravi Kumar', { exact: true })).toBeVisible();
}

async function openLedgerOf(page: Page, name: string) {
  await ledgerCard(page, name).getByRole('button', { name: /Open Ledger/ }).click();
  await expect(page.getByRole('heading', { name: 'Salary Ledger Details' })).toBeVisible();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

test.describe('Salary (admin)', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
  });

  test.describe('the salary ledger list', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page);
      await signInAsAdmin(page);
      await openSalaryLedger(page);
    });

    test('is reached from the Salary Ledger card on the dashboard', async ({ page }) => {
      await expect(page).toHaveURL(/\/admin\/employees\/salary-ledger$/);
      await expect(page.getByText('View and manage employee salary records')).toBeVisible();
    });

    test('shows each active employee with id, role, category and running balance', async ({ page }) => {
      await expect(ledgerCard(page, 'Ravi Kumar')).toContainText('emp-1');
      await expect(ledgerCard(page, 'Ravi Kumar')).toContainText('Loader');
      await expect(ledgerCard(page, 'Ravi Kumar')).toContainText('Loadmen');
      await expect(ledgerCard(page, 'Ravi Kumar')).toContainText('₹5,150');
      await expect(ledgerCard(page, 'Anita Rao')).toContainText('Fixed Salary');
      await expect(ledgerCard(page, 'Anita Rao')).toContainText('₹0');
      await expect(page.getByText('Old Hand', { exact: true })).toBeHidden();
    });

    test('the Inactive tab lists inactive employees instead', async ({ page }) => {
      await page.getByRole('button', { name: 'Inactive', exact: true }).click();

      await expect(page.getByText('Old Hand', { exact: true })).toBeVisible();
      await expect(page.getByText('Ravi Kumar', { exact: true })).toBeHidden();
    });

    test('searches by name, and says so when nobody matches', async ({ page }) => {
      const search = page.getByPlaceholder('Search by name, or phone number...');

      await search.fill('anita');
      await expect(page.getByText('Ravi Kumar', { exact: true })).toBeHidden();
      await expect(page.getByText('Anita Rao', { exact: true })).toBeVisible();

      await search.fill('zzzz');
      await expect(page.getByText('No active employees found')).toBeVisible();
    });

    test('Back to Home returns to the dashboard', async ({ page }) => {
      await page.getByRole('button', { name: /Back to Home/ }).click();

      await expect(page).toHaveURL(/\/admin\/home$/);
    });

    test('makes no unexpected backend calls', async () => {
      expect(mock.unexpected).toEqual([]);
    });
  });

  test.describe('calculating the salary', () => {
    async function openCalculate(page: Page) {
      await openSalaryLedger(page);
      await page.getByRole('button', { name: /Calculate Salary/ }).click();
      await expect(page.getByRole('heading', { name: 'Calculate Salary' })).toBeVisible();
    }

    test('names last month, and lists the fixed-salary employees with their counts and base salary', async ({ page }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);
      await openCalculate(page);

      await expect(page.getByText(/Generate fixed salary for/)).toContainText('September 2026');
      await expect(page.getByText('Deduction for absent and half day has already been made.')).toBeVisible();
      const row = page.getByRole('row', { name: /Anita Rao/ });
      await expect(row).toBeVisible();
      const cells = await row.getByRole('cell').allTextContents();
      expect(cells.slice(3, 7)).toEqual(['5', '1', '1', '1']); // present, absent, leave, half day
      await expect(row.getByRole('spinbutton')).toHaveValue('25000');
      await expect(page.getByRole('row', { name: /Mohan Das/ })).toBeHidden(); // daily wage, not fixed
    });

    test('generates the salary with the base and final figures, then shows the month as done', async ({ page }) => {
      const mock = await mockSupabase(page);
      await signInAsAdmin(page);
      await openCalculate(page);
      await page.getByRole('row', { name: /Anita Rao/ }).getByRole('spinbutton').fill('24000');

      await page.getByRole('button', { name: 'Generate Salary' }).click();

      await expect(page.getByText('Salary for September 2026 has been generated successfully!')).toBeVisible();
      expect(mock.salaryBatches).toEqual([
        {
          p_month: '2026-09-01',
          p_items: [
            {
              employee_id: 'emp-2',
              present_days: 5,
              absent_days: 1,
              leave_days: 1,
              half_days: 1,
              base_salary: 25000,
              final_salary: 24000,
            },
          ],
        },
      ]);
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page.getByText('Salary Already Generated')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Generate Salary' })).toBeHidden();
    });

    test('cannot be run twice: reopening shows the month as already done', async ({ page }) => {
      await mockSupabase(page, { salaryGenerated: '2026-09-01' });
      await signInAsAdmin(page);
      await openSalaryLedger(page);

      await page.getByRole('button', { name: /Calculate Salary/ }).click();

      await expect(page.getByText('Salary Already Generated')).toBeVisible();
      await expect(page.getByText(/Please wait till next month to do the calculation/)).toBeVisible();
      await expect(page.getByRole('table')).toBeHidden();
    });

    test('says so when there are no fixed-salary employees', async ({ page }) => {
      await mockSupabase(page, { employees: EMPLOYEES.filter((e) => e.role_id !== 'role-supervisor') });
      await signInAsAdmin(page);
      await openCalculate(page);

      await expect(page.getByText('No active fixed salary employees found.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Generate Salary' })).toBeHidden();
    });

    test('says so when generating fails, and the month is not marked as done', async ({ page }) => {
      const mock = await mockSupabase(page, { salaryGenerateFails: true });
      await signInAsAdmin(page);
      await openCalculate(page);

      await page.getByRole('button', { name: 'Generate Salary' }).click();

      await expect(page.getByText('Failed to generate salary. Please try again.')).toBeVisible();
      await expect(page.getByText('Salary Already Generated')).toBeHidden();
      await expect(page.getByRole('button', { name: 'Generate Salary' })).toBeEnabled();
      expect(mock.salaryBatches).toHaveLength(0);
    });

    test('Back to Salary Ledger returns to the list', async ({ page }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);
      await openCalculate(page);

      await page.getByRole('button', { name: /Back to Salary Ledger/ }).click();

      await expect(page).toHaveURL(/\/admin\/employees\/salary-ledger$/);
    });
  });

  test.describe('an employee\'s ledger', () => {
    test.beforeEach(async ({ page }) => {
      await mockSupabase(page);
      await signInAsAdmin(page);
      await openSalaryLedger(page);
      await openLedgerOf(page, 'Ravi Kumar');
    });

    const table = (page: Page) => page.getByRole('table');
    const rowFor = (page: Page, text: string) => table(page).getByRole('row', { name: new RegExp(text) });

    test('shows the employee and the running balance', async ({ page }) => {
      await expect(page).toHaveURL(/\/admin\/employees\/salary-ledger\/emp-1$/);
      await expect(page.getByText('Loader', { exact: true })).toBeVisible();
      await expect(page.getByText('Current Running Balance').locator('xpath=following-sibling::p')).toHaveText('₹5,150');
    });

    test('lists the transactions newest first, with credits as + and payments as -', async ({ page }) => {
      const rows = await table(page).getByRole('row').allTextContents();
      expect(rows[1]).toContain('Auto-entry for 2026-10-08');
      expect(rows[2]).toContain('Festival advance');
      expect(rows[3]).toContain('Opening wages');
      await expect(rowFor(page, 'Auto-entry for 2026-10-08')).toContainText('+₹650');
      await expect(rowFor(page, 'Festival advance')).toContainText('-₹500');
      await expect(rowFor(page, 'Festival advance')).toContainText('CASH');
      await expect(page.getByText('3 of 3')).toBeVisible();
    });

    test('the audit window shows a transaction\'s details and closes', async ({ page }) => {
      await rowFor(page, 'Festival advance').getByTitle('View Audit Details').click();

      await expect(page.getByRole('heading', { name: 'Audit Details' })).toBeVisible();
      await expect(page.getByText('Transaction ID').locator('xpath=following-sibling::p')).toHaveText('led-2');
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('heading', { name: 'Audit Details' })).toBeHidden();
    });

    test('Oldest First reverses the order once applied', async ({ page }) => {
      await page.getByLabel('Sort Order').selectOption('oldest');
      await page.getByRole('button', { name: /Apply Filter/ }).click();

      await expect(table(page).getByRole('row').nth(1)).toContainText('Opening wages');
    });

    test('a date range keeps only the transactions inside it, including the whole To date', async ({ page }) => {
      await page.getByLabel('From Date').fill('2026-10-04');
      await page.getByLabel('To Date').fill('2026-10-05');
      await page.getByRole('button', { name: /Apply Filter/ }).click();

      await expect(rowFor(page, 'Festival advance')).toBeVisible();
      await expect(table(page).getByText('Opening wages')).toBeHidden();
      await expect(table(page).getByText(/Auto-entry for 2026-10-08/)).toBeHidden();
      await expect(page.getByText('1 of 1')).toBeVisible();
    });

    test('Clear Filter brings everything back', async ({ page }) => {
      await page.getByLabel('From Date').fill('2026-10-06');
      await page.getByRole('button', { name: /Apply Filter/ }).click();
      await expect(table(page).getByText('Opening wages')).toBeHidden();

      await page.getByRole('button', { name: 'Clear Filter' }).click();

      await expect(page.getByText('3 of 3')).toBeVisible();
      await expect(page.getByLabel('From Date')).toHaveValue('');
    });

    test('an employee with no transactions says so', async ({ page }) => {
      await page.getByRole('button', { name: /Back to Salary Ledger/ }).click();

      await openLedgerOf(page, 'Anita Rao');

      await expect(page.getByText('No salary transactions recorded for this employee.')).toBeVisible();
    });

    test('Add Payment and Back to Salary Ledger navigate', async ({ page }) => {
      await page.getByRole('button', { name: /Add Payment/ }).click();
      await expect(page).toHaveURL(/\/salary-ledger\/emp-1\/add-payment$/);
      await page.getByRole('button', { name: /Back to Ledger/ }).click();
      await expect(page).toHaveURL(/\/salary-ledger\/emp-1$/);

      await page.getByRole('button', { name: /Back to Salary Ledger/ }).click();
      await expect(page).toHaveURL(/\/admin\/employees\/salary-ledger$/);
    });
  });

  test.describe('adding a payment', () => {
    let mock: SupabaseMock;

    const f = {
      entryType: (page: Page) => page.getByLabel(/^Type of Entry/),
      amount: (page: Page) => page.getByLabel(/^Amount/),
      dateTime: (page: Page) => page.getByLabel(/^Date & Time/),
      notes: (page: Page) => page.getByLabel(/^Notes/),
      mode: (page: Page) => page.getByLabel(/^Mode of Payment/),
      sai: (page: Page) => page.getByLabel(/^SAI/),
      rai: (page: Page) => page.getByLabel(/^RAI/),
    };
    const confirm = (page: Page) => page.getByRole('button', { name: /^Confirm (Payment|Settlement)$/ });

    async function openAddPayment(page: Page, employee = 'Ravi Kumar') {
      await openSalaryLedger(page);
      await openLedgerOf(page, employee);
      await page.getByRole('button', { name: /Add Payment/ }).click();
      await expect(page.getByRole('heading', { name: 'Add Payment / Settlement' })).toBeVisible();
      await expect(f.entryType(page)).toBeVisible();
    }

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page);
      await signInAsAdmin(page);
    });

    test('shows the employee and balance, and starts on UPI with the current date and time', async ({ page }) => {
      await openAddPayment(page);

      await expect(page.getByText('Record a payment or settlement entry')).toBeVisible();
      await expect(page.getByText('Current Balance').locator('xpath=following-sibling::p')).toHaveText('₹5,150');
      await expect(f.mode(page)).toHaveValue('UPI');
      await expect(f.dateTime(page)).toHaveValue('2026-10-15T10:00');
      await expect(f.sai(page).locator('option')).toHaveText(['Select Account', 'HDFC-1234 (₹100,000)', 'SBI-9999 (₹800)']);
    });

    test('an empty form lists what is missing and saves nothing', async ({ page }) => {
      await openAddPayment(page);

      await confirm(page).click();

      await expect(page.getByText('Entry type is required')).toBeVisible();
      await expect(page.getByText('Please enter a valid amount')).toBeVisible();
      await expect(page.getByText('SAI is required')).toBeVisible();
      await expect(page.getByText('RAI is required')).toBeVisible();
      expect(mock.ledgerEntries).toHaveLength(0);
    });

    test('records an advance paid from a bank account, and the ledger and balance show it', async ({ page }) => {
      await openAddPayment(page);
      await f.entryType(page).selectOption('Advance Payment');
      await f.amount(page).fill('1000');
      await f.notes(page).fill('Medical need');
      await f.sai(page).selectOption({ label: 'HDFC-1234 (₹100,000)' });
      await f.rai(page).fill('  Ravi HDFC 5555  ');
      await expect(page.getByText(/New balance after this transaction/)).toContainText('₹4,150');

      await confirm(page).click();

      await expect(page.getByText('Entry Added Successfully')).toBeVisible();
      expect(mock.ledgerEntries).toEqual([
        expect.objectContaining({
          p_employee_id: 'emp-1',
          p_entry_type: 'ADVANCE',
          p_amount: 1000,
          p_payment_mode: 'UPI',
          p_sender_account_id: 'acc-bank',
          p_receiver_account: 'Ravi HDFC 5555',
          p_notes: 'Medical need',
        }),
      ]);
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page).toHaveURL(/\/salary-ledger\/emp-1$/);
      await expect(page.getByText('Current Running Balance').locator('xpath=following-sibling::p')).toHaveText('₹4,150');
      await expect(page.getByRole('row', { name: /Medical need/ })).toContainText('-₹1,000');
    });

    test('records a cash payment with no accounts', async ({ page }) => {
      await openAddPayment(page);
      await f.entryType(page).selectOption('Weekly Payment');
      await f.amount(page).fill('250');
      await f.mode(page).selectOption('Cash');
      await expect(page.getByText('Available account balance: ₹3,000')).toBeVisible();
      await expect(f.sai(page)).toBeHidden();

      await confirm(page).click();

      await expect(page.getByText('Entry Added Successfully')).toBeVisible();
      expect(mock.ledgerEntries[0]).toMatchObject({
        p_entry_type: 'WEEKLY',
        p_amount: 250,
        p_payment_mode: 'CASH',
        p_sender_account_id: null,
        p_receiver_account: null,
      });
    });

    test('records a bank transfer as BANK', async ({ page }) => {
      await openAddPayment(page);
      await f.entryType(page).selectOption('Emergency Payment');
      await f.amount(page).fill('100');
      await f.mode(page).selectOption('Bank Transfer');
      await f.sai(page).selectOption({ label: 'HDFC-1234 (₹100,000)' });
      await f.rai(page).fill('Ravi');

      await confirm(page).click();

      await expect(page.getByText('Entry Added Successfully')).toBeVisible();
      expect(mock.ledgerEntries[0]).toMatchObject({ p_entry_type: 'EMERGENCY', p_payment_mode: 'BANK' });
    });

    test('a full settlement fills the whole balance, locks the amount, and clears the ledger balance', async ({ page }) => {
      await openAddPayment(page);
      await f.entryType(page).selectOption('Full Settlement');
      await expect(f.amount(page)).toHaveValue('5150');
      await expect(f.amount(page)).toBeDisabled();
      await f.mode(page).selectOption('Cash');

      await expect(confirm(page)).toHaveText('Confirm Settlement');
      await confirm(page).click();

      await expect(page.getByText('Insufficient account balance (₹3,000 available)')).toBeVisible();
      await f.mode(page).selectOption('Bank Transfer');
      await f.sai(page).selectOption({ label: 'HDFC-1234 (₹100,000)' });
      await f.rai(page).fill('Ravi');
      await confirm(page).click();
      await expect(page.getByText('Entry Added Successfully')).toBeVisible();
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page.getByText('Current Running Balance').locator('xpath=following-sibling::p')).toHaveText('₹0');
    });

    test('a part settlement larger than the balance is refused', async ({ page }) => {
      await openAddPayment(page);
      await f.entryType(page).selectOption('Partial Settlement');
      await f.amount(page).fill('5151');
      await f.sai(page).selectOption({ label: 'HDFC-1234 (₹100,000)' });
      await f.rai(page).fill('Ravi');

      await confirm(page).click();

      await expect(page.getByText('Settlement amount cannot exceed pending balance')).toBeVisible();
      expect(mock.ledgerEntries).toHaveLength(0);
    });

    test('a payment larger than the chosen account holds is refused', async ({ page }) => {
      await openAddPayment(page);
      await f.entryType(page).selectOption('Advance Payment');
      await f.amount(page).fill('900');
      await f.sai(page).selectOption({ label: 'SBI-9999 (₹800)' });
      await f.rai(page).fill('Ravi');

      await confirm(page).click();

      await expect(page.getByText('Insufficient account balance (₹800 available)')).toBeVisible();
      expect(mock.ledgerEntries).toHaveLength(0);
    });

    test('a date and time in the future is refused', async ({ page }) => {
      await openAddPayment(page);
      await f.entryType(page).selectOption('Advance Payment');
      await f.amount(page).fill('100');
      await f.sai(page).selectOption({ label: 'HDFC-1234 (₹100,000)' });
      await f.rai(page).fill('Ravi');
      await f.dateTime(page).fill('2026-10-16T09:00');

      await confirm(page).click();

      await expect(page.getByText('Date cannot be in the future')).toBeVisible();
      expect(mock.ledgerEntries).toHaveLength(0);
    });

    test('a manual salary entry hides the payment mode and accounts, warns, and raises the balance', async ({ page }) => {
      await openAddPayment(page);
      await f.entryType(page).selectOption('Manual Salary Entry');

      await expect(f.mode(page)).toBeHidden();
      await expect(f.sai(page)).toBeHidden();
      await expect(page.getByText('⚠️ Salary Credit Warning')).toBeVisible();
      await f.amount(page).fill('650');
      await expect(page.getByText(/New balance after this transaction/)).toContainText('₹5,800');

      await confirm(page).click();
      await expect(page.getByText('Entry Added Successfully')).toBeVisible();
      expect(mock.ledgerEntries[0]).toMatchObject({
        p_entry_type: 'SALARY_MANUAL_ENTRY',
        p_payment_mode: null,
        p_sender_account_id: null,
      });
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page.getByText('Current Running Balance').locator('xpath=following-sibling::p')).toHaveText('₹5,800');
    });

    test('a full settlement cannot be confirmed when nothing is owed', async ({ page }) => {
      await openAddPayment(page, 'Mohan Das');
      await expect(page.getByText('Current Balance').locator('xpath=following-sibling::p')).toHaveText('₹0');

      await f.entryType(page).selectOption('Full Settlement');

      await expect(confirm(page)).toBeDisabled();
    });

    test('Cancel returns to the ledger without saving', async ({ page }) => {
      await openAddPayment(page);
      await f.entryType(page).selectOption('Advance Payment');
      await f.amount(page).fill('100');

      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(page).toHaveURL(/\/salary-ledger\/emp-1$/);
      expect(mock.ledgerEntries).toHaveLength(0);
    });
  });

  test.describe('when saving a payment fails', () => {
    test('shows the error, keeps the form, and records nothing', async ({ page }) => {
      const mock = await mockSupabase(page, { ledgerSaveFails: true });
      await signInAsAdmin(page);
      await openSalaryLedger(page);
      await openLedgerOf(page, 'Ravi Kumar');
      await page.getByRole('button', { name: /Add Payment/ }).click();
      await page.getByLabel(/^Type of Entry/).selectOption('Weekly Payment');
      await page.getByLabel(/^Amount/).fill('100');
      await page.getByLabel(/^Mode of Payment/).selectOption('Cash');

      await page.getByRole('button', { name: 'Confirm Payment' }).click();

      await expect(page.getByText('Failed to Save Entry')).toBeVisible();
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page.getByLabel(/^Amount/)).toHaveValue('100');
      expect(mock.ledgerEntries).toHaveLength(0);
    });
  });
});
