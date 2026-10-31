import { expect, test, type Page } from '@playwright/test';
import { signInAsAdmin } from './support/admin';
import { EMPLOYEES, mockSupabase, type SupabaseMock } from './support/supabase-mock';

const table = (page: Page) => page.getByRole('table');
const rowFor = (page: Page, name: string) => table(page).getByRole('row', { name: new RegExp(name) });
const search = (page: Page) => page.getByPlaceholder('Search by name or phone...');

async function openEmployees(page: Page) {
  await page.getByRole('button', { name: /Employee Management/ }).click();
  await expect(page.getByRole('heading', { name: 'Employee Management' })).toBeVisible();
  await expect(table(page).getByText('Ravi Kumar')).toBeVisible();
}

const f = {
  name: (page: Page) => page.getByLabel(/^Employee Name/),
  phone: (page: Page) => page.getByLabel(/^Phone Number/),
  altPhone: (page: Page) => page.getByLabel(/^Alternate Phone/),
  blood: (page: Page) => page.getByLabel(/^Blood Group/),
  aadhar: (page: Page) => page.getByLabel(/^Aadhar Number/),
  permanent: (page: Page) => page.getByLabel(/^Permanent Address/),
  local: (page: Page) => page.getByLabel(/^Local Address/),
  role: (page: Page) => page.getByLabel(/^Employee Role/),
  category: (page: Page) => page.getByLabel('Category'),
  deduction: (page: Page) => page.getByLabel(/^Deduction Amount/),
  emName: (page: Page) => page.getByLabel(/^Emergency Contact Name/),
  emPhone: (page: Page) => page.getByLabel(/^Emergency Contact Number/),
};

async function fillValid(page: Page, role = 'Mason', phone = '9111111111') {
  await f.name(page).fill('Karthik Raja');
  await f.phone(page).fill(phone);
  await f.blood(page).selectOption('B+');
  await f.aadhar(page).fill('999988887777');
  await f.permanent(page).fill('8 Temple Street, Madurai');
  await f.role(page).selectOption({ label: role });
}

test.describe('Employee Management (admin)', () => {
  test.describe('the list', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page, { signedInAs: 'admin' });
      await signInAsAdmin(page);
      await openEmployees(page);
    });

    test('shows the active employees with id, phone, role and category', async ({ page }) => {
      await expect(page.getByText('Manage employee records and information')).toBeVisible();
      await expect(rowFor(page, 'Ravi Kumar')).toContainText('emp-1');
      await expect(rowFor(page, 'Ravi Kumar')).toContainText('9000000011');
      await expect(rowFor(page, 'Ravi Kumar')).toContainText('Loader');
      await expect(rowFor(page, 'Ravi Kumar')).toContainText('Loadmen');
      await expect(rowFor(page, 'Anita Rao')).toContainText('Fixed Salary');
      await expect(rowFor(page, 'Mohan Das')).toContainText('Daily Wages');
      await expect(table(page).getByText('Old Hand')).toBeHidden();
    });

    test('shows how many are active and inactive', async ({ page }) => {
      await expect(page.getByText('Active Employees', { exact: true }).locator('xpath=following-sibling::p')).toHaveText('3');
      await expect(page.getByText('Inactive Employees', { exact: true }).locator('xpath=following-sibling::p')).toHaveText('1');
    });

    test('the Inactive tab lists inactive employees instead', async ({ page }) => {
      await page.getByRole('button', { name: 'Inactive', exact: true }).click();

      await expect(table(page).getByText('Old Hand')).toBeVisible();
      await expect(table(page).getByText('Ravi Kumar')).toBeHidden();
      await page.getByRole('button', { name: 'Active', exact: true }).click();
      await expect(table(page).getByText('Ravi Kumar')).toBeVisible();
    });

    test('Back to Home returns to the dashboard', async ({ page }) => {
      await page.getByRole('button', { name: /Back to Home/ }).click();

      await expect(page).toHaveURL(/\/admin\/home$/);
    });

    test('makes no unexpected backend calls', async () => {
      expect(mock.unexpected).toEqual([]);
    });
  });

  test.describe('searching', () => {
    test.beforeEach(async ({ page }) => {
      await mockSupabase(page, { signedInAs: 'admin' });
      await signInAsAdmin(page);
      await openEmployees(page);
    });

    test('finds employees by name', async ({ page }) => {
      await search(page).fill('anita');

      await expect(table(page).getByText('Ravi Kumar')).toBeHidden();
      await expect(table(page).getByText('Anita Rao')).toBeVisible();
    });

    test('finds employees by phone number', async ({ page }) => {
      await search(page).fill('9000000013');

      await expect(table(page).getByText('Mohan Das')).toBeVisible();
      await expect(table(page).getByText('Ravi Kumar')).toBeHidden();
    });

    test('says so when nobody matches, and clearing the search brings everyone back', async ({ page }) => {
      await search(page).fill('zzzz');
      await expect(page.getByText('No active employees found.')).toBeVisible();

      await search(page).fill('');

      await expect(table(page).getByText('Ravi Kumar')).toBeVisible();
    });

    test('searches the inactive list when that tab is open', async ({ page }) => {
      await page.getByRole('button', { name: 'Inactive', exact: true }).click();
      await expect(table(page).getByText('Old Hand')).toBeVisible();

      await search(page).fill('nobody');

      await expect(page.getByText('No inactive employees found.')).toBeVisible();
    });
  });

  test.describe('loading more', () => {
    test('shows twenty at a time and adds the rest on Load More', async ({ page }) => {
      const many = Array.from({ length: 25 }, (_, i) => ({
        ...EMPLOYEES[0],
        id: `emp-bulk-${i}`,
        name: `Worker ${String(i).padStart(2, '0')}`,
        phone: `91000000${String(i).padStart(2, '0')}`,
        created_at: new Date(Date.UTC(2026, 9, 1, 0, 0, 25 - i)).toISOString(),
      }));
      await mockSupabase(page, { signedInAs: 'admin', employees: many });
      await signInAsAdmin(page);
      await page.getByRole('button', { name: /Employee Management/ }).click();
      await expect(table(page).getByText('Worker 00')).toBeVisible();

      await expect(table(page).getByRole('row')).toHaveCount(21); // header + 20
      await expect(page.getByText('Active Employees', { exact: true }).locator('xpath=following-sibling::p')).toHaveText('25');

      await page.getByRole('button', { name: 'Load More' }).click();

      await expect(table(page).getByRole('row')).toHaveCount(26);
      await expect(table(page).getByText('Worker 24')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Load More' })).toBeHidden();
    });
  });

  test.describe('activating and deactivating', () => {
    test.beforeEach(async ({ page }) => {
      await mockSupabase(page, { signedInAs: 'admin' });
      await signInAsAdmin(page);
      await openEmployees(page);
    });

    test('No leaves the employee as they were', async ({ page }) => {
      await rowFor(page, 'Ravi Kumar').getByTitle('Set Inactive').click();
      await expect(page.getByText('Are you sure you want to set this employee as inactive?')).toBeVisible();

      await page.getByRole('button', { name: 'No' }).click();

      await expect(page.getByText('Set Employee Inactive')).toBeHidden();
      await expect(table(page).getByText('Ravi Kumar')).toBeVisible();
    });

    test('Yes moves the employee to the Inactive tab and updates the counts', async ({ page }) => {
      await rowFor(page, 'Ravi Kumar').getByTitle('Set Inactive').click();

      await page.getByRole('button', { name: 'Yes' }).click();

      await expect(table(page).getByText('Ravi Kumar')).toBeHidden();
      await expect(page.getByText('Active Employees', { exact: true }).locator('xpath=following-sibling::p')).toHaveText('2');
      await expect(page.getByText('Inactive Employees', { exact: true }).locator('xpath=following-sibling::p')).toHaveText('2');
      await page.getByRole('button', { name: 'Inactive', exact: true }).click();
      await expect(table(page).getByText('Ravi Kumar')).toBeVisible();
    });

    test('an inactive employee can be activated again', async ({ page }) => {
      await page.getByRole('button', { name: 'Inactive', exact: true }).click();
      await rowFor(page, 'Old Hand').getByTitle('Set Active').click();
      await expect(page.getByText('Are you sure you want to activate this employee?')).toBeVisible();

      await page.getByRole('button', { name: 'Yes' }).click();

      await expect(table(page).getByText('Old Hand')).toBeHidden();
      await page.getByRole('button', { name: 'Active', exact: true }).click();
      await expect(table(page).getByText('Old Hand')).toBeVisible();
    });
  });

  test.describe('navigation from the list', () => {
    test.beforeEach(async ({ page }) => {
      await mockSupabase(page, { signedInAs: 'admin' });
      await signInAsAdmin(page);
      await openEmployees(page);
    });

    for (const [name, url] of [
      ['Role & Salary Setup', /\/admin\/employees\/role-setup$/],
      ['Attendance', /\/admin\/employees\/attendance$/],
      ['Create Employee', /\/admin\/employees\/create$/],
    ] as const) {
      test(`${name} opens its screen`, async ({ page }) => {
        await page.getByRole('button', { name: new RegExp(name) }).click();

        await expect(page).toHaveURL(url);
      });
    }

    test('Edit opens that employee\'s edit screen', async ({ page }) => {
      await rowFor(page, 'Anita Rao').getByTitle('Edit').click();

      await expect(page).toHaveURL(/\/admin\/employees\/emp-2\/edit$/);
      await expect(page.getByRole('heading', { name: 'Edit Employee' })).toBeVisible();
      await expect(f.name(page)).toHaveValue('Anita Rao');
    });
  });

  test.describe('creating an employee', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page, { signedInAs: 'admin' });
      await signInAsAdmin(page);
      await openEmployees(page);
      await page.getByRole('button', { name: /Create Employee/ }).click();
      await expect(page.getByRole('heading', { name: 'Add New Employee' })).toBeVisible();
      await expect(f.role(page)).toBeVisible();
    });

    test('lists the active roles, and fills the category from the chosen one', async ({ page }) => {
      await expect(f.role(page).locator('option')).toHaveText(['Select role', 'Loader', 'Mason', 'Supervisor']);

      await f.role(page).selectOption({ label: 'Supervisor' });

      await expect(f.category(page)).toHaveValue('Fixed Salary');
      await expect(f.deduction(page)).toBeVisible();
    });

    test('an empty form lists every missing detail and saves nothing', async ({ page }) => {
      await page.getByRole('button', { name: 'Create', exact: true }).click();

      for (const message of [
        'Employee name is required',
        'Phone number is required',
        'Blood group is required',
        'Aadhar number is required',
        'Permanent address is required',
        'Employee role is required',
      ]) {
        await expect(page.getByText(message)).toBeVisible();
      }
      expect(mock.employeeTable).toHaveLength(EMPLOYEES.length);
    });

    test('names accept only letters, phone numbers only digits, and the Aadhar number twelve digits', async ({ page }) => {
      await f.name(page).pressSequentially('Ravi 42 K@umar');
      await f.phone(page).pressSequentially('90a00-000011999');
      await f.aadhar(page).pressSequentially('1234-5678 9012 3456');

      await expect(f.name(page)).toHaveValue('Ravi  Kumar');
      await expect(f.phone(page)).toHaveValue('9000000011');
      await expect(f.aadhar(page)).toHaveValue('123456789012');
    });

    test('a short phone, Aadhar or emergency number is refused', async ({ page }) => {
      await fillValid(page);
      await f.phone(page).fill('90000');
      await f.aadhar(page).fill('1234');
      await f.emPhone(page).fill('98765');

      await page.getByRole('button', { name: 'Create', exact: true }).click();

      await expect(page.getByText('Phone number must be 10 digits')).toBeVisible();
      await expect(page.getByText('Aadhar number must be 12 digits')).toBeVisible();
      await expect(page.getByText('Emergency contact number must be 10 digits')).toBeVisible();
      expect(mock.employeeTable).toHaveLength(EMPLOYEES.length);
    });

    test('a fixed-salary role needs a deduction amount', async ({ page }) => {
      await fillValid(page, 'Supervisor');

      await page.getByRole('button', { name: 'Create', exact: true }).click();

      await expect(page.getByText('Deduction amount is required for fixed salary employees')).toBeVisible();
      expect(mock.employeeTable).toHaveLength(EMPLOYEES.length);
    });

    test('saves the employee, confirms it, and shows them at the top of the list', async ({ page }) => {
      await fillValid(page);
      await f.altPhone(page).fill('9222222222');
      await f.local(page).fill('3 Lake View, Erode');
      await f.emName(page).fill('Meena Devi');
      await f.emPhone(page).fill('9333333333');

      await page.getByRole('button', { name: 'Create', exact: true }).click();

      await expect(page.getByText('Employee Created Successfully')).toBeVisible();
      await expect(page.getByText('The employee has been created successfully.')).toBeVisible();
      expect(mock.employeeTable[0]).toMatchObject({
        name: 'Karthik Raja',
        phone: '9111111111',
        alternate_phone: '9222222222',
        blood_group: 'B+',
        aadhar: '999988887777',
        permanent_address: '8 Temple Street, Madurai',
        local_address: '3 Lake View, Erode',
        role_id: 'role-mason',
        emergency_contact_name: 'Meena Devi',
        emergency_contact_phone: '9333333333',
        active: true,
      });

      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page).toHaveURL(/\/admin\/employees$/);
      await expect(table(page).getByRole('row').nth(1)).toContainText('Karthik Raja');
      await expect(page.getByText('Active Employees', { exact: true }).locator('xpath=following-sibling::p')).toHaveText('4');
    });

    test('saves a fixed-salary employee with the deduction amount', async ({ page }) => {
      await fillValid(page, 'Supervisor');
      await f.deduction(page).fill('300');

      await page.getByRole('button', { name: 'Create', exact: true }).click();

      await expect(page.getByText('Employee Created Successfully')).toBeVisible();
      expect(mock.employeeTable[0]).toMatchObject({ role_id: 'role-supervisor', deduction_amount: 300 });
    });

    test('a phone number already in use is refused and nothing is added', async ({ page }) => {
      await fillValid(page, 'Mason', '9000000011');

      await page.getByRole('button', { name: 'Create', exact: true }).click();

      await expect(page.getByText('Creation Failed')).toBeVisible();
      expect(mock.employeeTable).toHaveLength(EMPLOYEES.length);
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(f.name(page)).toHaveValue('Karthik Raja');
    });

    test('Cancel returns to the list without saving', async ({ page }) => {
      await fillValid(page);

      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(page).toHaveURL(/\/admin\/employees$/);
      expect(mock.employeeTable).toHaveLength(EMPLOYEES.length);
    });

    test('Create New Role goes to the role form and comes back to this form afterwards', async ({ page }) => {
      await page.getByRole('button', { name: 'Create New Role' }).click();
      await expect(page.getByRole('heading', { name: 'Create New Role' })).toBeVisible();
      await page.getByLabel(/^Role Name/).fill('Driver');
      await page.getByLabel(/^Employee Category/).selectOption('Daily Wages');
      await page.getByLabel(/^Per Day Wage/).fill('700');
      await page.getByRole('button', { name: 'Create Role' }).click();
      await expect(page.getByText('Role Created Successfully')).toBeVisible();

      await page.getByRole('button', { name: 'OK' }).click();

      await expect(page).toHaveURL(/\/admin\/employees\/create$/);
      await expect(f.role(page).locator('option')).toContainText(['Select role', 'Driver', 'Loader', 'Mason', 'Supervisor']);
    });
  });

  test.describe('editing an employee', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page, { signedInAs: 'admin' });
      await signInAsAdmin(page);
      await openEmployees(page);
      await rowFor(page, 'Ravi Kumar').getByTitle('Edit').click();
      await expect(f.name(page)).toHaveValue('Ravi Kumar');
    });

    test('starts filled in from the employee\'s record', async ({ page }) => {
      await expect(page.getByText('Update employee details — emp-1')).toBeVisible();
      await expect(f.phone(page)).toHaveValue('9000000011');
      await expect(f.blood(page)).toHaveValue('O+');
      await expect(f.aadhar(page)).toHaveValue('123456789011');
      await expect(f.role(page)).toHaveValue('role-loader');
      await expect(f.category(page)).toHaveValue('Loadmen');
    });

    test('saves a changed name and shows it in the list', async ({ page }) => {
      await f.name(page).fill('Ravi Shankar');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByText('Employee Updated Successfully')).toBeVisible();
      expect(mock.employeeTable.find((e) => e.id === 'emp-1')).toMatchObject({ name: 'Ravi Shankar', phone: '9000000011' });
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page).toHaveURL(/\/admin\/employees$/);
      await expect(table(page).getByText('Ravi Shankar')).toBeVisible();
      await expect(table(page).getByText('Ravi Kumar')).toBeHidden();
    });

    test('changing the role changes the category in the list', async ({ page }) => {
      await f.role(page).selectOption({ label: 'Mason' });
      await expect(f.category(page)).toHaveValue('Daily Wages');

      await page.getByRole('button', { name: 'Save Changes' }).click();
      await page.getByRole('button', { name: 'OK' }).click();

      await expect(rowFor(page, 'Ravi Kumar')).toContainText('Daily Wages');
    });

    test('cleared required details are reported and nothing is saved', async ({ page }) => {
      await f.name(page).fill('');
      await f.aadhar(page).fill('');
      await f.permanent(page).fill('');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByText('Employee name is required')).toBeVisible();
      await expect(page.getByText('Aadhar number is required')).toBeVisible();
      await expect(page.getByText('Permanent address is required')).toBeVisible();
      expect(mock.employeeTable.find((e) => e.id === 'emp-1')).toMatchObject({ name: 'Ravi Kumar' });
    });

    test('changing the phone to one already in use is refused', async ({ page }) => {
      await f.phone(page).fill('9000000012');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByText('Update Failed')).toBeVisible();
      expect(mock.employeeTable.find((e) => e.id === 'emp-1')).toMatchObject({ phone: '9000000011' });
    });

    test('Cancel returns to the list without saving', async ({ page }) => {
      await f.name(page).fill('Someone Else');

      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(page).toHaveURL(/\/admin\/employees$/);
      expect(mock.employeeTable.find((e) => e.id === 'emp-1')).toMatchObject({ name: 'Ravi Kumar' });
    });

    test('an employee that does not exist shows a load error', async ({ page }) => {
      await page.goto('/admin/employees/emp-missing/edit');

      await expect(page.getByText('Update Failed')).toBeVisible();
      await expect(page.getByText('Failed to load employee details. Please refresh and try again.')).toBeVisible();
    });
  });

  test.describe('when the backend fails', () => {
    test('a failed create shows the error and keeps the form for another try', async ({ page }) => {
      const mock = await mockSupabase(page, { signedInAs: 'admin', adminSavesFail: true });
      await signInAsAdmin(page);
      await openEmployees(page);
      await page.getByRole('button', { name: /Create Employee/ }).click();
      await expect(f.role(page)).toBeVisible();
      await fillValid(page);

      await page.getByRole('button', { name: 'Create', exact: true }).click();

      await expect(page.getByText('Creation Failed')).toBeVisible();
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(f.name(page)).toHaveValue('Karthik Raja');
      await expect(page).toHaveURL(/\/admin\/employees\/create$/);
      expect(mock.employeeTable).toHaveLength(EMPLOYEES.length);
    });

    test('a failed edit shows the error and leaves the employee unchanged', async ({ page }) => {
      const mock = await mockSupabase(page, { signedInAs: 'admin', adminSavesFail: true });
      await signInAsAdmin(page);
      await openEmployees(page);
      await rowFor(page, 'Ravi Kumar').getByTitle('Edit').click();
      await f.name(page).fill('Changed Name');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByText('Update Failed')).toBeVisible();
      expect(mock.employeeTable.find((e) => e.id === 'emp-1')).toMatchObject({ name: 'Ravi Kumar' });
    });
  });

  // Gaps found while writing these tests, written as the behaviour the screen should have.
  // `test.fail()` expects them to fail, so they pass today and go red once the gap is fixed;
  // remove the `test.fail()` line then.
  test.describe('known gaps', () => {
    test('the list tells the administrator when employees cannot be loaded', async ({ page }) => {
      test.fail();
      await mockSupabase(page, { signedInAs: 'admin', adminListsFail: true });
      await signInAsAdmin(page);
      await page.getByRole('button', { name: /Employee Management/ }).click();

      await expect(page.getByRole('alert')).toBeVisible({ timeout: 2500 });
    });

    test('an error clears as soon as the field is corrected', async ({ page }) => {
      test.fail();
      await mockSupabase(page, { signedInAs: 'admin' });
      await signInAsAdmin(page);
      await openEmployees(page);
      await page.getByRole('button', { name: /Create Employee/ }).click();
      await expect(f.role(page)).toBeVisible();
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await expect(page.getByText('Employee name is required')).toBeVisible();

      await f.name(page).fill('R');

      await expect(page.getByText('Employee name is required')).toBeHidden({ timeout: 1500 });
    });
  });
});
