import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { EmployeeManagementScreen } from './EmployeeManagementScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({
  getActiveEmployees: vi.fn(),
  getInactiveEmployees: vi.fn(),
  updateEmployeeStatus: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const emp = (id: string, name: string, phone: string | null, role: string | null, category = 'DAILY') => ({
  id,
  name,
  phone,
  role_id: role ? `role-${role}` : null,
  active: true,
  roles: role ? { id: `role-${role}`, name: role, category } : null,
});

const ACTIVE = [
  emp('emp-1', 'Ravi Kumar', '9000000011', 'Loader', 'LOADMEN'),
  emp('emp-2', 'Anita Rao', '9000000012', 'Supervisor', 'FIXED'),
  emp('emp-3', 'Mohan', null, null),
];
const INACTIVE = [emp('emp-9', 'Old Hand', '9000000099', 'Mason', 'DAILY')];

const page = (data: unknown[], total = data.length, hasMore = false) => ({ data, total, hasMore });

function Destination() {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin/employees']}>
      <Routes>
        <Route path="/admin/employees" element={<EmployeeManagementScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setup() {
  return userEvent.setup();
}

// The screen waits a second after the last keystroke before searching.
const waitForSearchDelay = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 1100))));

const table = () => screen.getByRole('table');
const rowFor = (name: string) => within(table()).getByRole('row', { name: new RegExp(name) });

async function loaded() {
  await waitFor(() => expect(within(table()).getByText('Ravi Kumar')).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getActiveEmployees.mockResolvedValue(page(ACTIVE) as never);
  mocked.getInactiveEmployees.mockResolvedValue(page(INACTIVE) as never);
  mocked.updateEmployeeStatus.mockResolvedValue(undefined);
});

describe('EmployeeManagementScreen', () => {
  describe('layout', () => {
    it('shows the heading and the three actions', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByRole('heading', { name: 'Employee Management' })).toBeInTheDocument();
      expect(screen.getByText('Manage employee records and information')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Role & Salary Setup/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Attendance/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Employee/ })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search by name or phone...')).toHaveValue('');
    });

    it('shows how many employees are active and inactive', async () => {
      mocked.getActiveEmployees.mockResolvedValue(page(ACTIVE, 42) as never);
      mocked.getInactiveEmployees.mockResolvedValue(page(INACTIVE, 7) as never);
      renderScreen();
      await loaded();

      expect(screen.getByText('Active Employees').nextElementSibling).toHaveTextContent('42');
      expect(screen.getByText('Inactive Employees').nextElementSibling).toHaveTextContent('7');
    });

    it('asks for the first page of both lists as soon as it opens', async () => {
      renderScreen();
      await loaded();

      expect(mocked.getActiveEmployees).toHaveBeenCalledWith('', 0);
      expect(mocked.getInactiveEmployees).toHaveBeenCalledWith('', 0);
    });

    it('shows a loading message until the first list arrives', () => {
      mocked.getActiveEmployees.mockReturnValue(new Promise(() => {}));
      mocked.getInactiveEmployees.mockReturnValue(new Promise(() => {}));
      renderScreen();

      expect(screen.getByText('Loading employees...')).toBeInTheDocument();
    });
  });

  describe('the list', () => {
    it('shows each active employee\'s name, id, phone, role and category', async () => {
      renderScreen();
      await loaded();

      expect(rowFor('Ravi Kumar')).toHaveTextContent('emp-1');
      expect(rowFor('Ravi Kumar')).toHaveTextContent('9000000011');
      expect(rowFor('Ravi Kumar')).toHaveTextContent('Loader');
      expect(rowFor('Ravi Kumar')).toHaveTextContent('Loadmen');
      expect(rowFor('Anita Rao')).toHaveTextContent('Fixed Salary');
    });

    it('labels a daily-wage role as Daily Wages', async () => {
      mocked.getActiveEmployees.mockResolvedValue(page([emp('e5', 'Daily Joe', '9000000055', 'Mason', 'DAILY')]) as never);
      renderScreen();
      await waitFor(() => expect(within(table()).getByText('Daily Joe')).toBeInTheDocument());

      expect(rowFor('Daily Joe')).toHaveTextContent('Daily Wages');
    });

    it('shows a dash for a missing phone or role', async () => {
      renderScreen();
      await loaded();

      const cells = within(rowFor('Mohan')).getAllByRole('cell');
      expect(cells[2]).toHaveTextContent('-');
      expect(cells[3]).toHaveTextContent('-');
    });

    it('lists the active employees first and the inactive ones under the Inactive tab', async () => {
      const user = setup();
      renderScreen();
      await loaded();
      expect(within(table()).queryByText('Old Hand')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Inactive' }));

      expect(within(table()).getByText('Old Hand')).toBeInTheDocument();
      expect(within(table()).queryByText('Ravi Kumar')).not.toBeInTheDocument();
    });

    it('says when there are no active employees', async () => {
      mocked.getActiveEmployees.mockResolvedValue(page([]) as never);
      renderScreen();

      expect(await screen.findByText('No active employees found.')).toBeInTheDocument();
    });

    it('says when there are no inactive employees', async () => {
      const user = setup();
      mocked.getInactiveEmployees.mockResolvedValue(page([]) as never);
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Inactive' }));

      expect(screen.getByText('No inactive employees found.')).toBeInTheDocument();
    });
  });

  describe('searching', () => {
    it('waits a second after the last keystroke, then searches the active list', async () => {
      const user = setup();
      renderScreen();
      await loaded();
      mocked.getActiveEmployees.mockClear();

      await user.type(screen.getByPlaceholderText('Search by name or phone...'), 'ravi');
      expect(mocked.getActiveEmployees).not.toHaveBeenCalled();

      await waitForSearchDelay();

      expect(mocked.getActiveEmployees).toHaveBeenCalledWith('ravi', 0);
    });

    it('searches only the list that is showing', async () => {
      const user = setup();
      renderScreen();
      await loaded();
      await user.click(screen.getByRole('button', { name: 'Inactive' }));
      mocked.getActiveEmployees.mockClear();
      mocked.getInactiveEmployees.mockClear();

      await user.type(screen.getByPlaceholderText('Search by name or phone...'), '99');
      await waitForSearchDelay();

      expect(mocked.getInactiveEmployees).toHaveBeenCalledWith('99', 0);
      expect(mocked.getActiveEmployees).not.toHaveBeenCalled();
    });

    it('shows what the search returned', async () => {
      const user = setup();
      renderScreen();
      await loaded();
      mocked.getActiveEmployees.mockResolvedValue(page([ACTIVE[1]]) as never);

      await user.type(screen.getByPlaceholderText('Search by name or phone...'), 'anita');
      await waitForSearchDelay();

      await waitFor(() => expect(within(table()).queryByText('Ravi Kumar')).not.toBeInTheDocument());
      expect(within(table()).getByText('Anita Rao')).toBeInTheDocument();
    });

    it('says nothing was found when the search matches no one', async () => {
      const user = setup();
      renderScreen();
      await loaded();
      mocked.getActiveEmployees.mockResolvedValue(page([]) as never);

      await user.type(screen.getByPlaceholderText('Search by name or phone...'), 'zzz');
      await waitForSearchDelay();

      expect(await screen.findByText('No active employees found.')).toBeInTheDocument();
    });
  });

  describe('loading more', () => {
    it('shows Load More only when there are more, and appends the next page', async () => {
      const user = setup();
      mocked.getActiveEmployees.mockResolvedValue(page(ACTIVE, 5, true) as never);
      renderScreen();
      await loaded();

      mocked.getActiveEmployees.mockResolvedValue(page([emp('emp-4', 'Fourth One', '9000000014', 'Loader')], 5, false) as never);
      await user.click(screen.getByRole('button', { name: 'Load More' }));

      await waitFor(() => expect(within(table()).getByText('Fourth One')).toBeInTheDocument());
      expect(mocked.getActiveEmployees).toHaveBeenLastCalledWith('', 1);
      expect(within(table()).getByText('Ravi Kumar')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
    });

    it('does not show Load More when everything fits on one page', async () => {
      renderScreen();
      await loaded();

      expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
    });
  });

  describe('activating and deactivating', () => {
    it('asks for confirmation before setting an active employee inactive', async () => {
      const user = setup();
      renderScreen();
      await loaded();

      await user.click(within(rowFor('Ravi Kumar')).getByTitle('Set Inactive'));

      expect(screen.getByText('Set Employee Inactive')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to set this employee as inactive?')).toBeInTheDocument();
      expect(mocked.updateEmployeeStatus).not.toHaveBeenCalled();
    });

    it('does nothing when the answer is No', async () => {
      const user = setup();
      renderScreen();
      await loaded();
      await user.click(within(rowFor('Ravi Kumar')).getByTitle('Set Inactive'));

      await user.click(screen.getByRole('button', { name: 'No' }));

      expect(screen.queryByText('Set Employee Inactive')).not.toBeInTheDocument();
      expect(mocked.updateEmployeeStatus).not.toHaveBeenCalled();
    });

    it('sets the employee inactive on Yes, and refreshes both lists', async () => {
      const user = setup();
      renderScreen();
      await loaded();
      mocked.getActiveEmployees.mockClear();
      mocked.getInactiveEmployees.mockClear();
      await user.click(within(rowFor('Ravi Kumar')).getByTitle('Set Inactive'));

      mocked.getActiveEmployees.mockResolvedValue(page(ACTIVE.slice(1), 2) as never);
      mocked.getInactiveEmployees.mockResolvedValue(page([...INACTIVE, ACTIVE[0]], 2) as never);
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(mocked.updateEmployeeStatus).toHaveBeenCalledWith('emp-1', false));
      await waitFor(() => expect(within(table()).queryByText('Ravi Kumar')).not.toBeInTheDocument());
      expect(mocked.getActiveEmployees).toHaveBeenCalledWith('', 0);
      expect(mocked.getInactiveEmployees).toHaveBeenCalledWith('', 0);
      expect(screen.queryByText('Set Employee Inactive')).not.toBeInTheDocument();
    });

    it('asks to activate an inactive employee, and activates on Yes', async () => {
      const user = setup();
      renderScreen();
      await loaded();
      await user.click(screen.getByRole('button', { name: 'Inactive' }));

      await user.click(within(rowFor('Old Hand')).getByTitle('Set Active'));
      expect(screen.getByText('Activate Employee')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to activate this employee?')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(mocked.updateEmployeeStatus).toHaveBeenCalledWith('emp-9', true));
    });
  });

  describe('navigation', () => {
    it.each([
      ['Role & Salary Setup', '/admin/employees/role-setup'],
      ['Attendance', '/admin/employees/attendance'],
      ['Create Employee', '/admin/employees/create'],
    ])('opens %s at %s', async (name, path) => {
      const user = setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: new RegExp(name) }));

      expect(screen.getByTestId('path').textContent).toBe(path);
    });

    it('opens the edit screen for the chosen employee', async () => {
      const user = setup();
      renderScreen();
      await loaded();

      await user.click(within(rowFor('Anita Rao')).getByTitle('Edit'));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/emp-2/edit');
    });

    it('goes back to the admin dashboard from Back to Home', async () => {
      const user = setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: /Back to Home/ }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/home');
    });
  });

  // Gaps found while writing these tests, written as the behaviour the screen should have and
  // marked `fails`: each passes while the gap exists and goes red once it is fixed, at which
  // point the `.fails` should be removed.
  describe('known gaps', () => {
    it.fails('tells the administrator when the employees cannot be loaded, instead of saying there are none', async () => {
      mocked.getActiveEmployees.mockRejectedValue(new Error('down'));
      mocked.getInactiveEmployees.mockRejectedValue(new Error('down'));
      renderScreen();
      await act(async () => void (await new Promise((resolve) => setTimeout(resolve, 100))));

      expect(screen.queryByText('No active employees found.')).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it.fails('tells the administrator when changing an employee\'s status fails', async () => {
      const user = setup();
      mocked.updateEmployeeStatus.mockRejectedValue(new Error('down'));
      renderScreen();
      await loaded();
      await user.click(within(rowFor('Ravi Kumar')).getByTitle('Set Inactive'));

      await user.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(mocked.updateEmployeeStatus).toHaveBeenCalled());
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it.fails('gives the phone-size edit and status buttons accessible names', async () => {
      renderScreen();
      await loaded();

      // The card layout used on phones has icon-only buttons with no label or title.
      const cards = document.querySelector('.lg\\:hidden') as HTMLElement;
      expect(within(cards).getAllByRole('button', { name: /edit/i }).length).toBeGreaterThan(0);
    });
  });
});
