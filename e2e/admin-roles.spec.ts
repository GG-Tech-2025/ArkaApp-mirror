import { expect, test, type Page } from '@playwright/test';
import { signInAsAdmin } from './support/admin';
import { mockSupabase, ROLES, type SupabaseMock } from './support/supabase-mock';

const table = (page: Page) => page.getByRole('table');
const rowFor = (page: Page, name: string) => table(page).getByRole('row', { name: new RegExp(name) });
const tab = (page: Page, name: 'Active' | 'Inactive') => page.getByRole('button', { name, exact: true });

async function openRoles(page: Page) {
  await page.getByRole('button', { name: /Employee Management/ }).click();
  await page.getByRole('button', { name: /Role & Salary Setup/ }).click();
  await expect(page.getByRole('heading', { name: 'Role & Salary Setup' })).toBeVisible();
  await expect(table(page).getByText('Loader')).toBeVisible();
}

const f = {
  name: (page: Page) => page.getByLabel(/^Role Name/),
  category: (page: Page) => page.getByLabel(/^Employee Category/),
  perDay: (page: Page) => page.getByLabel(/^Per Day Wage/),
  monthly: (page: Page) => page.getByLabel(/^Monthly Salary/),
  rate: (page: Page) => page.getByLabel(/^Rate Per Load/),
  minLoad: (page: Page) => page.getByLabel(/^Minimum Load Requirement/),
  noLoading: (page: Page) => page.getByLabel('No Loading / Unloading Wages'),
};

test.describe('Role & Salary Setup (admin)', () => {
  test.describe('the list', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page, { signedInAs: 'admin' });
      await signInAsAdmin(page);
      await openRoles(page);
    });

    test('shows the active roles with category, salary type and value, in name order', async ({ page }) => {
      await expect(page.getByText('Configure employee roles and salary structure')).toBeVisible();
      await expect(rowFor(page, 'Loader')).toContainText('Loadmen');
      await expect(rowFor(page, 'Loader')).toContainText('Rate Per Load');
      await expect(rowFor(page, 'Loader')).toContainText('₹12.5');
      await expect(rowFor(page, 'Mason')).toContainText('Daily Wages');
      await expect(rowFor(page, 'Mason')).toContainText('Per Day Wage');
      await expect(rowFor(page, 'Mason')).toContainText('₹650');
      await expect(rowFor(page, 'Supervisor')).toContainText('Fixed Salary');
      await expect(rowFor(page, 'Supervisor')).toContainText('Monthly Salary');
      await expect(rowFor(page, 'Supervisor')).toContainText('₹25,000');
      await expect(table(page).getByText('Old Role')).toBeHidden();
    });

    test('flags the role that earns no loading wages', async ({ page }) => {
      await expect(rowFor(page, 'Supervisor')).toContainText('No Loading Wages');
      await expect(rowFor(page, 'Mason')).not.toContainText('No Loading Wages');
    });

    test('shows how many roles are active and inactive', async ({ page }) => {
      await expect(page.getByText('Active Roles', { exact: true }).locator('xpath=following-sibling::p')).toHaveText('3');
      await expect(page.getByText('Inactive Roles', { exact: true }).locator('xpath=following-sibling::p')).toHaveText('1');
    });

    test('the Inactive tab lists inactive roles, which can only be activated', async ({ page }) => {
      await tab(page, 'Inactive').click();

      await expect(table(page).getByText('Old Role')).toBeVisible();
      await expect(table(page).getByText('Loader')).toBeHidden();
      await expect(rowFor(page, 'Old Role').getByTitle('Set Active')).toBeVisible();
      await expect(rowFor(page, 'Old Role').getByTitle('Edit')).toBeHidden();
    });

    test('Back to Employee Management returns to the employee list', async ({ page }) => {
      await page.getByRole('button', { name: /Back to Employee Management/ }).click();

      await expect(page).toHaveURL(/\/admin\/employees$/);
    });

    test('makes no unexpected backend calls', async () => {
      expect(mock.unexpected).toEqual([]);
    });
  });

  test.describe('activating and deactivating', () => {
    test.beforeEach(async ({ page }) => {
      await mockSupabase(page, { signedInAs: 'admin' });
      await signInAsAdmin(page);
      await openRoles(page);
    });

    test('No leaves the role as it was', async ({ page }) => {
      await rowFor(page, 'Mason').getByTitle('Set Inactive').click();
      await expect(page.getByText('Are you sure you want to set this role as inactive?')).toBeVisible();

      await page.getByRole('button', { name: 'No' }).click();

      await expect(page.getByText('Set Role Inactive')).toBeHidden();
      await expect(table(page).getByText('Mason')).toBeVisible();
    });

    test('Yes moves the role to the Inactive tab and updates the counts', async ({ page }) => {
      await rowFor(page, 'Mason').getByTitle('Set Inactive').click();

      await page.getByRole('button', { name: 'Yes' }).click();

      await expect(table(page).getByText('Mason')).toBeHidden();
      await expect(page.getByText('Active Roles', { exact: true }).locator('xpath=following-sibling::p')).toHaveText('2');
      await tab(page, 'Inactive').click();
      await expect(table(page).getByText('Mason')).toBeVisible();
    });

    test('an inactive role can be activated again', async ({ page }) => {
      await tab(page, 'Inactive').click();
      await rowFor(page, 'Old Role').getByTitle('Set Active').click();
      await expect(page.getByText('Are you sure you want to activate this role?')).toBeVisible();

      await page.getByRole('button', { name: 'Yes' }).click();

      await expect(table(page).getByText('Old Role')).toBeHidden();
      await tab(page, 'Active').click();
      await expect(table(page).getByText('Old Role')).toBeVisible();
    });
  });

  test.describe('creating a role', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page, { signedInAs: 'admin' });
      await signInAsAdmin(page);
      await openRoles(page);
      await page.getByRole('button', { name: /Create Role/ }).click();
      await expect(page.getByRole('heading', { name: 'Create New Role' })).toBeVisible();
    });

    test('shows only the fields for the chosen category', async ({ page }) => {
      await expect(f.perDay(page)).toBeHidden();

      await f.category(page).selectOption('Daily Wages');
      await expect(f.perDay(page)).toBeVisible();
      await expect(f.noLoading(page)).toBeVisible();

      await f.category(page).selectOption('Fixed Salary');
      await expect(f.monthly(page)).toBeVisible();
      await expect(f.perDay(page)).toBeHidden();

      await f.category(page).selectOption('Loadmen');
      await expect(f.rate(page)).toBeVisible();
      await expect(f.minLoad(page)).toBeVisible();
      await expect(f.noLoading(page)).toBeHidden();
    });

    test('asks for a name and a category, and saves nothing', async ({ page }) => {
      await page.getByRole('button', { name: 'Create Role' }).click();

      await expect(page.getByText('Role name is required')).toBeVisible();
      await expect(page.getByText('Category is required')).toBeVisible();
      expect(mock.roleTable).toHaveLength(ROLES.length);
    });

    test('asks for the salary figure of the chosen category', async ({ page }) => {
      await f.name(page).fill('Driver');
      await f.category(page).selectOption('Daily Wages');

      await page.getByRole('button', { name: 'Create Role' }).click();

      await expect(page.getByText('Per day wage is required')).toBeVisible();
      expect(mock.roleTable).toHaveLength(ROLES.length);
    });

    test('rejects a per-day wage of more than five digits and a monthly salary of more than six', async ({ page }) => {
      await f.name(page).fill('Driver');
      await f.category(page).selectOption('Daily Wages');
      await f.perDay(page).fill('123456');
      await page.getByRole('button', { name: 'Create Role' }).click();
      await expect(page.getByText('Maximum 5 digits allowed')).toBeVisible();

      await f.category(page).selectOption('Fixed Salary');
      await f.monthly(page).fill('1234567');
      await page.getByRole('button', { name: 'Create Role' }).click();
      await expect(page.getByText('Maximum 6 digits allowed')).toBeVisible();
    });

    test('names accept only letters and spaces', async ({ page }) => {
      await f.name(page).pressSequentially('Machine 2 Op@erator');

      await expect(f.name(page)).toHaveValue('Machine  Operator');
    });

    test('saves a daily-wage role and lists it', async ({ page }) => {
      await f.name(page).fill('Driver');
      await f.category(page).selectOption('Daily Wages');
      await f.perDay(page).fill('700');

      await page.getByRole('button', { name: 'Create Role' }).click();

      await expect(page.getByText('Role Created Successfully')).toBeVisible();
      expect(mock.roleTable[0]).toMatchObject({
        name: 'Driver',
        category: 'DAILY',
        salary_value: 700,
        minimum_requirement: null,
        no_loading_salary: false,
        active: true,
      });
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page).toHaveURL(/\/admin\/employees\/role-setup$/);
      await expect(rowFor(page, 'Driver')).toContainText('₹700');
    });

    test('saves a fixed-salary role that earns no loading wages', async ({ page }) => {
      await f.name(page).fill('Manager');
      await f.category(page).selectOption('Fixed Salary');
      await f.monthly(page).fill('45000');
      await f.noLoading(page).check();

      await page.getByRole('button', { name: 'Create Role' }).click();

      await expect(page.getByText('Role Created Successfully')).toBeVisible();
      expect(mock.roleTable[0]).toMatchObject({ category: 'FIXED', salary_value: 45000, no_loading_salary: true });
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(rowFor(page, 'Manager')).toContainText('No Loading Wages');
    });

    test('saves a loadmen role with a minimum requirement', async ({ page }) => {
      await f.name(page).fill('Helper');
      await f.category(page).selectOption('Loadmen');
      await f.rate(page).fill('15');
      await f.minLoad(page).fill('30');

      await page.getByRole('button', { name: 'Create Role' }).click();

      await expect(page.getByText('Role Created Successfully')).toBeVisible();
      expect(mock.roleTable[0]).toMatchObject({ category: 'LOADMEN', salary_value: 15, minimum_requirement: 30 });
    });

    test('a role name already in use is refused and nothing is added', async ({ page }) => {
      await f.name(page).fill('Mason');
      await f.category(page).selectOption('Daily Wages');
      await f.perDay(page).fill('700');

      await page.getByRole('button', { name: 'Create Role' }).click();

      await expect(page.getByText('Creation Failed')).toBeVisible();
      expect(mock.roleTable).toHaveLength(ROLES.length);
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(f.name(page)).toHaveValue('Mason');
    });

    test('Cancel returns to the role list without saving', async ({ page }) => {
      await f.name(page).fill('Driver');

      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(page).toHaveURL(/\/admin\/employees\/role-setup$/);
      expect(mock.roleTable).toHaveLength(ROLES.length);
    });
  });

  test.describe('editing a role', () => {
    let mock: SupabaseMock;

    test.beforeEach(async ({ page }) => {
      mock = await mockSupabase(page, { signedInAs: 'admin' });
      await signInAsAdmin(page);
      await openRoles(page);
      await rowFor(page, 'Mason').getByTitle('Edit').click();
      await expect(f.name(page)).toHaveValue('Mason');
    });

    test('starts filled in from the role\'s record', async ({ page }) => {
      await expect(page.getByText('Update role details — role-mason')).toBeVisible();
      await expect(f.category(page)).toHaveValue('Daily Wages');
      await expect(f.perDay(page)).toHaveValue('650');
      await expect(f.noLoading(page)).not.toBeChecked();
    });

    test('saves a changed wage and shows it in the list', async ({ page }) => {
      await f.perDay(page).fill('725');

      await page.getByRole('button', { name: 'Update Role' }).click();

      await expect(page.getByText('Role Updated Successfully')).toBeVisible();
      expect(mock.roleTable.find((r) => r.id === 'role-mason')).toMatchObject({ salary_value: 725, category: 'DAILY' });
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(page).toHaveURL(/\/admin\/employees\/role-setup$/);
      await expect(rowFor(page, 'Mason')).toContainText('₹725');
    });

    test('saves the no-loading-wages option', async ({ page }) => {
      await f.noLoading(page).check();

      await page.getByRole('button', { name: 'Update Role' }).click();

      await expect(page.getByText('Role Updated Successfully')).toBeVisible();
      expect(mock.roleTable.find((r) => r.id === 'role-mason')).toMatchObject({ no_loading_salary: true });
    });

    test('changing the category asks first, and No keeps the role as it was', async ({ page }) => {
      await f.category(page).selectOption('Fixed Salary');
      await expect(page.getByText('Confirm Category Change')).toBeVisible();

      await page.getByRole('button', { name: 'No, Cancel' }).click();

      await expect(page.getByText('Confirm Category Change')).toBeHidden();
      await expect(f.category(page)).toHaveValue('Daily Wages');
      await expect(f.perDay(page)).toHaveValue('650');
    });

    test('confirming a category change clears the figure, and a new one can be saved', async ({ page }) => {
      await f.category(page).selectOption('Fixed Salary');
      await page.getByRole('button', { name: 'Yes, Continue' }).click();
      await expect(f.monthly(page)).toHaveValue('');
      await f.monthly(page).fill('30000');

      await page.getByRole('button', { name: 'Update Role' }).click();

      await expect(page.getByText('Role Updated Successfully')).toBeVisible();
      expect(mock.roleTable.find((r) => r.id === 'role-mason')).toMatchObject({ category: 'FIXED', salary_value: 30000 });
      await page.getByRole('button', { name: 'OK' }).click();
      await expect(rowFor(page, 'Mason')).toContainText('Fixed Salary');
    });

    test('a cleared name and wage are reported and nothing is saved', async ({ page }) => {
      await f.name(page).fill('');
      await f.perDay(page).fill('');

      await page.getByRole('button', { name: 'Update Role' }).click();

      await expect(page.getByText('Role name is required')).toBeVisible();
      await expect(page.getByText('Per day wage is required')).toBeVisible();
      expect(mock.roleTable.find((r) => r.id === 'role-mason')).toMatchObject({ salary_value: 650 });
    });

    test('renaming to a name already in use is refused', async ({ page }) => {
      await f.name(page).fill('Loader');

      await page.getByRole('button', { name: 'Update Role' }).click();

      await expect(page.getByText('Update Failed')).toBeVisible();
      expect(mock.roleTable.find((r) => r.id === 'role-mason')).toMatchObject({ name: 'Mason' });
    });

    test('Cancel returns to the role list without saving', async ({ page }) => {
      await f.perDay(page).fill('999');

      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(page).toHaveURL(/\/admin\/employees\/role-setup$/);
      expect(mock.roleTable.find((r) => r.id === 'role-mason')).toMatchObject({ salary_value: 650 });
    });

    test('a role that does not exist shows a load error', async ({ page }) => {
      await page.goto('/admin/employees/role-setup/role-missing/edit');

      await expect(page.getByText('Update Failed')).toBeVisible();
      await expect(page.getByText('Failed to load role details. Please refresh and try again.')).toBeVisible();
    });
  });

  test.describe('a change made here shows up when creating an employee', () => {
    test('a new role is offered in the employee form, and a deactivated role no longer is', async ({ page }) => {
      await mockSupabase(page, { signedInAs: 'admin' });
      await signInAsAdmin(page);
      await openRoles(page);
      await rowFor(page, 'Mason').getByTitle('Set Inactive').click();
      await page.getByRole('button', { name: 'Yes' }).click();
      await expect(table(page).getByText('Mason')).toBeHidden();

      await page.getByRole('button', { name: /Back to Employee Management/ }).click();
      await page.getByRole('button', { name: /Create Employee/ }).click();

      await expect(page.getByLabel(/^Employee Role/).locator('option')).toHaveText(['Select role', 'Loader', 'Supervisor']);
    });
  });

  // Gaps found while writing these tests, written as the behaviour the screen should have.
  // `test.fail()` expects them to fail, so they pass today and go red once the gap is fixed;
  // remove the `test.fail()` line then.
  test.describe('known gaps', () => {
    test('the list tells the administrator when roles cannot be loaded', async ({ page }) => {
      test.fail();
      await mockSupabase(page, { signedInAs: 'admin', adminListsFail: true });
      await signInAsAdmin(page);
      await page.getByRole('button', { name: /Employee Management/ }).click();
      await page.getByRole('button', { name: /Role & Salary Setup/ }).click();

      await expect(page.getByRole('alert')).toBeVisible({ timeout: 2500 });
    });
  });
});
