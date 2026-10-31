import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { RoleSalarySetupScreen } from './RoleSalarySetupScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({
  getActiveRoles: vi.fn(),
  getInactiveRoles: vi.fn(),
  updateRoleStatus: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const role = (id: string, name: string, category: string, salary: number, noLoading = false) => ({
  id,
  name,
  category,
  salary_value: salary,
  minimum_requirement: null,
  no_loading_salary: noLoading,
  active: true,
});

const ACTIVE = [
  role('r1', 'Loader', 'LOADMEN', 12.5),
  role('r2', 'Mason', 'DAILY', 650),
  role('r3', 'Supervisor', 'FIXED', 25000, true),
];
const INACTIVE = [role('r9', 'Old Role', 'DAILY', 400)];

const page = (data: unknown[], total = data.length, hasMore = false) => ({ data, total, hasMore });

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin/employees/role-setup']}>
      <Routes>
        <Route path="/admin/employees/role-setup" element={<RoleSalarySetupScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const table = () => screen.getByRole('table');
const rowFor = (name: string) => within(table()).getByRole('row', { name: new RegExp(name) });

async function loaded() {
  await waitFor(() => expect(within(table()).getByText('Loader')).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getActiveRoles.mockResolvedValue(page(ACTIVE) as never);
  mocked.getInactiveRoles.mockResolvedValue(page(INACTIVE) as never);
  mocked.updateRoleStatus.mockResolvedValue(undefined);
});

describe('RoleSalarySetupScreen', () => {
  describe('layout', () => {
    it('shows the heading and the Create Role action', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByRole('heading', { name: 'Role & Salary Setup' })).toBeInTheDocument();
      expect(screen.getByText('Configure employee roles and salary structure')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Role/ })).toBeInTheDocument();
    });

    it('shows how many roles are active and inactive', async () => {
      mocked.getActiveRoles.mockResolvedValue(page(ACTIVE, 9) as never);
      mocked.getInactiveRoles.mockResolvedValue(page(INACTIVE, 4) as never);
      renderScreen();
      await loaded();

      expect(screen.getByText('Active Roles').nextElementSibling).toHaveTextContent('9');
      expect(screen.getByText('Inactive Roles').nextElementSibling).toHaveTextContent('4');
    });

    it('shows a loading message until the first list arrives', () => {
      mocked.getActiveRoles.mockReturnValue(new Promise(() => {}));
      mocked.getInactiveRoles.mockReturnValue(new Promise(() => {}));
      renderScreen();

      expect(screen.getByText('Loading roles...')).toBeInTheDocument();
    });
  });

  describe('the list', () => {
    it.each([
      ['Loader', 'Loadmen', 'Rate Per Load', '₹12.5'],
      ['Mason', 'Daily Wages', 'Per Day Wage', '₹650'],
      ['Supervisor', 'Fixed Salary', 'Monthly Salary', '₹25,000'],
    ])('shows %s as %s, with its salary type and value', async (name, category, salaryType, value) => {
      renderScreen();
      await loaded();

      expect(rowFor(name)).toHaveTextContent(category);
      expect(rowFor(name)).toHaveTextContent(salaryType);
      expect(rowFor(name)).toHaveTextContent(value);
    });

    it('flags a role that earns no loading wages', async () => {
      renderScreen();
      await loaded();

      expect(rowFor('Supervisor')).toHaveTextContent('No Loading Wages');
      expect(rowFor('Mason')).not.toHaveTextContent('No Loading Wages');
    });

    it('shows inactive roles under the Inactive tab only', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      expect(within(table()).queryByText('Old Role')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Inactive' }));

      expect(within(table()).getByText('Old Role')).toBeInTheDocument();
      expect(within(table()).queryByText('Loader')).not.toBeInTheDocument();
    });

    it('offers Edit and Set Inactive for active roles, and only Set Active for inactive ones', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      expect(within(rowFor('Loader')).getByTitle('Edit')).toBeInTheDocument();
      expect(within(rowFor('Loader')).getByTitle('Set Inactive')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Inactive' }));

      expect(within(rowFor('Old Role')).getByTitle('Set Active')).toBeInTheDocument();
      expect(within(rowFor('Old Role')).queryByTitle('Edit')).not.toBeInTheDocument();
    });

    it('says when there are no active or inactive roles', async () => {
      const user = userEvent.setup();
      mocked.getActiveRoles.mockResolvedValue(page([]) as never);
      mocked.getInactiveRoles.mockResolvedValue(page([]) as never);
      renderScreen();
      expect(await screen.findByText('No active roles found.')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Inactive' }));

      expect(screen.getByText('No inactive roles found.')).toBeInTheDocument();
    });

    it('appends the next page when Load More is pressed, and then hides it', async () => {
      const user = userEvent.setup();
      mocked.getActiveRoles.mockResolvedValue(page(ACTIVE, 4, true) as never);
      renderScreen();
      await loaded();
      mocked.getActiveRoles.mockResolvedValue(page([role('r4', 'Driver', 'DAILY', 700)], 4, false) as never);

      await user.click(screen.getByRole('button', { name: 'Load More' }));

      await waitFor(() => expect(within(table()).getByText('Driver')).toBeInTheDocument());
      expect(mocked.getActiveRoles).toHaveBeenLastCalledWith(1);
      expect(within(table()).getByText('Loader')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
    });

    it('does not show Load More when everything fits on one page', async () => {
      renderScreen();
      await loaded();

      expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
    });
  });

  describe('activating and deactivating', () => {
    it('asks first, and does nothing on No', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(within(rowFor('Mason')).getByTitle('Set Inactive'));

      expect(screen.getByText('Set Role Inactive')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to set this role as inactive?')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'No' }));

      expect(screen.queryByText('Set Role Inactive')).not.toBeInTheDocument();
      expect(mocked.updateRoleStatus).not.toHaveBeenCalled();
    });

    it('sets the role inactive on Yes and reloads the lists', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(within(rowFor('Mason')).getByTitle('Set Inactive'));
      mocked.getActiveRoles.mockResolvedValue(page([ACTIVE[0], ACTIVE[2]], 2) as never);

      await user.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(mocked.updateRoleStatus).toHaveBeenCalledWith('r2', false));
      await waitFor(() => expect(within(table()).queryByText('Mason')).not.toBeInTheDocument());
      expect(screen.queryByText('Set Role Inactive')).not.toBeInTheDocument();
    });

    it('activates an inactive role on Yes', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(screen.getByRole('button', { name: 'Inactive' }));
      await user.click(within(rowFor('Old Role')).getByTitle('Set Active'));
      expect(screen.getByText('Activate Role')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to activate this role?')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(mocked.updateRoleStatus).toHaveBeenCalledWith('r9', true));
    });
  });

  describe('navigation', () => {
    it('opens the Create Role screen', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: /Create Role/ }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/role-setup/create');
    });

    it('opens the edit screen for the chosen role', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(within(rowFor('Supervisor')).getByTitle('Edit'));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/role-setup/r3/edit');
    });

    it('goes back to employee management', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: /Back to Employee Management/ }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees');
    });
  });

  // Gaps found while writing these tests, written as the behaviour the screen should have and
  // marked `fails`: each passes while the gap exists and goes red once it is fixed, at which
  // point the `.fails` should be removed.
  describe('known gaps', () => {
    it.fails('tells the administrator when the roles cannot be loaded, instead of saying there are none', async () => {
      mocked.getActiveRoles.mockRejectedValue(new Error('down'));
      mocked.getInactiveRoles.mockRejectedValue(new Error('down'));
      renderScreen();
      await waitFor(() => expect(mocked.getActiveRoles).toHaveBeenCalled());

      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it.fails('tells the administrator when changing a role\'s status fails', async () => {
      const user = userEvent.setup();
      mocked.updateRoleStatus.mockRejectedValue(new Error('down'));
      renderScreen();
      await loaded();
      await user.click(within(rowFor('Mason')).getByTitle('Set Inactive'));

      await user.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(mocked.updateRoleStatus).toHaveBeenCalled());
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });
  });
});
