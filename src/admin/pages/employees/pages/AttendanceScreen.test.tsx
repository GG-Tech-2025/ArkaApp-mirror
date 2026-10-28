import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AttendanceScreen } from './AttendanceScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({
  getEmployeesForAttendance: vi.fn(),
  getAttendanceForDate: vi.fn(),
  saveAttendanceWithSalary: vi.fn(),
}));

const mocked = vi.mocked(middleware);

// "Today" is a fixed UTC moment, because the screen works out today from the UTC date.
const NOW = new Date(Date.UTC(2026, 9, 15, 10, 0, 0));

const emp = (id: string, name: string, category: string, salary: number, deduction: number | null = null) => ({
  id,
  name,
  phone: `90000000${id.slice(-2)}`,
  role_id: `role-${category}`,
  deduction_amount: deduction,
  roles: { id: `role-${category}`, name: `${category} role`, category, salary_value: salary },
});

const DAILY = emp('e01', 'Daily Dan', 'DAILY', 650);
const FIXED = emp('e02', 'Fixed Fiona', 'FIXED', 25000, 800);
const FIXED_NO_DEDUCTION = emp('e03', 'Fixed Finn', 'FIXED', 20000, null);
const ACTIVE = [DAILY, FIXED, FIXED_NO_DEDUCTION];
const INACTIVE = [emp('e09', 'Gone Gary', 'DAILY', 500)];

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin/employees/attendance']}>
      <Routes>
        <Route path="/admin/employees/attendance" element={<AttendanceScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const cardFor = (name: string) => screen.getByText(name).closest('.rounded-lg.p-4') as HTMLElement;
const mark = async (user: ReturnType<typeof userEvent.setup>, name: string, status: string) =>
  user.click(within(cardFor(name)).getByRole('button', { name: status, exact: true }));
const saveButton = () => screen.getByRole('button', { name: /^(Save Attendance|Saving\.\.\.)$/ });
const setDate = (value: string) => fireEvent.change(screen.getByLabelText('Select Date'), { target: { value } });

async function loaded() {
  await waitFor(() => expect(screen.getByText('Daily Dan')).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  mocked.getEmployeesForAttendance.mockImplementation(async (active = true) => (active ? ACTIVE : INACTIVE) as never);
  mocked.getAttendanceForDate.mockResolvedValue([]);
  mocked.saveAttendanceWithSalary.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AttendanceScreen', () => {
  describe('layout', () => {
    it('shows the heading, today\'s date and the tabs', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByRole('heading', { name: 'Employee Attendance' })).toBeInTheDocument();
      expect(screen.getByText('Mark daily attendance for employees')).toBeInTheDocument();
      expect(screen.getByLabelText('Select Date')).toHaveValue('2026-10-15');
      expect(screen.getByLabelText('Select Date')).toHaveAttribute('max', '2026-10-15');
      expect(screen.getByRole('button', { name: 'Active Employees' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Inactive Employees' })).toBeInTheDocument();
    });

    it('shows a loading message until the employees arrive', () => {
      mocked.getEmployeesForAttendance.mockReturnValue(new Promise(() => {}));
      renderScreen();

      expect(screen.getByText('Loading attendance...')).toBeInTheDocument();
    });

    it('lists each active employee with phone, role and category', async () => {
      renderScreen();
      await loaded();

      expect(within(cardFor('Daily Dan')).getByText('DAILY role')).toBeInTheDocument();
      expect(within(cardFor('Daily Dan')).getByText('Daily Wages')).toBeInTheDocument();
      expect(within(cardFor('Fixed Fiona')).getByText('Fixed Salary')).toBeInTheDocument();
    });

    it('offers Present, Absent, Half Day and Leave for each employee, none chosen at first', async () => {
      renderScreen();
      await loaded();

      for (const name of ['Daily Dan', 'Fixed Fiona', 'Fixed Finn']) {
        const buttons = within(cardFor(name)).getAllByRole('button').map((b) => b.textContent);
        expect(buttons).toEqual(['Present', 'Absent', 'Half Day', 'Leave']);
        for (const b of within(cardFor(name)).getAllByRole('button')) expect(b).toBeEnabled();
      }
    });

    it('says when there are no active employees', async () => {
      mocked.getEmployeesForAttendance.mockResolvedValue([] as never);
      renderScreen();

      expect(await screen.findByText(/No active employees found\. Please add employees/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save Attendance' })).not.toBeInTheDocument();
    });

    it('goes back to Employee Management, and opens the attendance overview', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: /View Attendance/ }));
      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/attendance/view');
    });

    it('goes back to Employee Management from the back button', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: /Back to Employee Management/ }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees');
    });
  });

  describe('marking attendance', () => {
    it('marks an employee with the chosen status', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await mark(user, 'Daily Dan', 'Half Day');

      expect(within(cardFor('Daily Dan')).getByRole('button', { name: 'Half Day' }).className).toContain('bg-yellow-600');
      expect(within(cardFor('Daily Dan')).getByRole('button', { name: 'Present' }).className).not.toContain('bg-green-600');
    });

    it('lets the status be changed before saving', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await mark(user, 'Daily Dan', 'Absent');

      await mark(user, 'Daily Dan', 'Present');

      expect(within(cardFor('Daily Dan')).getByRole('button', { name: 'Present' }).className).toContain('bg-green-600');
      expect(within(cardFor('Daily Dan')).getByRole('button', { name: 'Absent' }).className).not.toContain('bg-red-600');
    });

    it('refuses to save until everyone is marked, and says so', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await mark(user, 'Daily Dan', 'Present');

      await user.click(saveButton());

      expect(screen.getByText('Attendance is required for all employees. Please mark attendance for everyone.')).toBeInTheDocument();
      expect(mocked.saveAttendanceWithSalary).not.toHaveBeenCalled();
    });

    it('clears the warning as soon as someone is marked', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(saveButton());
      expect(screen.getByText(/Attendance is required for all employees/)).toBeInTheDocument();

      await mark(user, 'Daily Dan', 'Present');

      expect(screen.queryByText(/Attendance is required for all employees/)).not.toBeInTheDocument();
    });
  });

  describe('marking everyone at once', () => {
    it('asks first when Mark All Present is pressed, and Cancel changes nothing', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Mark All Present' }));
      expect(screen.getByText('Confirm Bulk Action')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to mark all employees as/)).toHaveTextContent('Present');

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByText('Confirm Bulk Action')).not.toBeInTheDocument();
      expect(within(cardFor('Daily Dan')).getByRole('button', { name: 'Present' }).className).not.toContain('bg-green-600');
    });

    it('marks everyone Present on Confirm', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(screen.getByRole('button', { name: 'Mark All Present' }));

      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      for (const name of ['Daily Dan', 'Fixed Fiona', 'Fixed Finn']) {
        expect(within(cardFor(name)).getByRole('button', { name: 'Present' }).className).toContain('bg-green-600');
      }
    });

    it('marks everyone Leave on Confirm, replacing earlier choices', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await mark(user, 'Daily Dan', 'Present');
      await user.click(screen.getByRole('button', { name: 'Mark All Leave' }));
      expect(screen.getByText(/Are you sure you want to mark all employees as/)).toHaveTextContent('Leave');

      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      for (const name of ['Daily Dan', 'Fixed Fiona', 'Fixed Finn']) {
        expect(within(cardFor(name)).getByRole('button', { name: 'Leave' }).className).toContain('bg-orange-600');
      }
    });
  });

  describe('saving', () => {
    async function markAll(user: ReturnType<typeof userEvent.setup>, statuses: Record<string, string>) {
      for (const [name, status] of Object.entries(statuses)) await mark(user, name, status);
    }

    it('saves the attendance for the chosen date, with the matching salary entries', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await markAll(user, { 'Daily Dan': 'Present', 'Fixed Fiona': 'Present', 'Fixed Finn': 'Present' });

      await user.click(saveButton());

      await waitFor(() => expect(mocked.saveAttendanceWithSalary).toHaveBeenCalledTimes(1));
      const [date, records, entries] = mocked.saveAttendanceWithSalary.mock.calls[0];
      expect(date).toBe('2026-10-15');
      expect(records).toEqual([
        { employee_id: 'e01', status: 'PRESENT' },
        { employee_id: 'e02', status: 'PRESENT' },
        { employee_id: 'e03', status: 'PRESENT' },
      ]);
      // Only the daily-wage employee earns a day's wage; fixed-salary staff are paid monthly.
      expect(entries).toEqual([
        {
          employee_id: 'e01',
          entry_type: 'SALARY_AUTO_ENTRY',
          amount: 650,
          notes: 'Auto-entry for 2026-10-15 — Present',
          payment_at: new Date('2026-10-15T00:00:00').toISOString(),
        },
      ]);
    });

    it('pays half a day\'s wage for a half day, rounded', async () => {
      const user = userEvent.setup();
      mocked.getEmployeesForAttendance.mockImplementation(async (active = true) =>
        (active ? [emp('e01', 'Daily Dan', 'DAILY', 655)] : []) as never,
      );
      renderScreen();
      await loaded();
      await mark(user, 'Daily Dan', 'Half Day');

      await user.click(saveButton());

      await waitFor(() => expect(mocked.saveAttendanceWithSalary).toHaveBeenCalled());
      expect(mocked.saveAttendanceWithSalary.mock.calls[0][2]).toMatchObject([
        { entry_type: 'SALARY_AUTO_ENTRY', amount: 328, notes: 'Auto-entry for 2026-10-15 — Half Day' },
      ]);
    });

    it.each(['Absent', 'Leave'])('pays nothing to a daily-wage employee who is %s', async (status) => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await markAll(user, { 'Daily Dan': status, 'Fixed Fiona': 'Present', 'Fixed Finn': 'Present' });

      await user.click(saveButton());

      await waitFor(() => expect(mocked.saveAttendanceWithSalary).toHaveBeenCalled());
      expect(mocked.saveAttendanceWithSalary.mock.calls[0][2]).toEqual([]);
    });

    it('deducts a full day from a fixed-salary employee who is absent', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await markAll(user, { 'Daily Dan': 'Present', 'Fixed Fiona': 'Absent', 'Fixed Finn': 'Absent' });

      await user.click(saveButton());

      await waitFor(() => expect(mocked.saveAttendanceWithSalary).toHaveBeenCalled());
      const entries = mocked.saveAttendanceWithSalary.mock.calls[0][2];
      expect(entries).toContainEqual(
        expect.objectContaining({ employee_id: 'e02', entry_type: 'DEDUCTION', amount: 800, notes: 'Deduction for 2026-10-15 — Absent' }),
      );
      expect(entries.some((e) => e.employee_id === 'e03')).toBe(false); // no deduction amount set
    });

    it('deducts half for a fixed-salary employee on a half day', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await markAll(user, { 'Daily Dan': 'Present', 'Fixed Fiona': 'Half Day', 'Fixed Finn': 'Present' });

      await user.click(saveButton());

      await waitFor(() => expect(mocked.saveAttendanceWithSalary).toHaveBeenCalled());
      expect(mocked.saveAttendanceWithSalary.mock.calls[0][2]).toContainEqual(
        expect.objectContaining({ employee_id: 'e02', entry_type: 'DEDUCTION', amount: 400 }),
      );
    });

    it('does not deduct from a fixed-salary employee on leave or present', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await markAll(user, { 'Daily Dan': 'Present', 'Fixed Fiona': 'Leave', 'Fixed Finn': 'Present' });

      await user.click(saveButton());

      await waitFor(() => expect(mocked.saveAttendanceWithSalary).toHaveBeenCalled());
      expect(mocked.saveAttendanceWithSalary.mock.calls[0][2].some((e) => e.entry_type === 'DEDUCTION')).toBe(false);
    });

    it('confirms with a success popup, and the day then becomes read-only', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(screen.getByRole('button', { name: 'Mark All Present' }));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));
      await user.click(saveButton());

      expect(await screen.findByText('Attendance saved successfully!')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.getByText('Attendance for this date has already been recorded and cannot be modified.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save Attendance' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Mark All Present' })).not.toBeInTheDocument();
      for (const b of within(cardFor('Daily Dan')).getAllByRole('button')) expect(b).toBeDisabled();
    });

    it('shows Saving... and ignores another press while the save is in flight', async () => {
      const user = userEvent.setup();
      let finish: () => void = () => {};
      mocked.saveAttendanceWithSalary.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      renderScreen();
      await loaded();
      await user.click(screen.getByRole('button', { name: 'Mark All Present' }));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await user.click(saveButton());

      const busy = await screen.findByRole('button', { name: 'Saving...' });
      expect(busy).toBeDisabled();
      await user.click(busy);
      expect(mocked.saveAttendanceWithSalary).toHaveBeenCalledTimes(1);

      finish();
      expect(await screen.findByText('Attendance saved successfully!')).toBeInTheDocument();
    });

    it('says so when saving fails, and allows another try', async () => {
      const user = userEvent.setup();
      mocked.saveAttendanceWithSalary.mockRejectedValueOnce(new Error('down'));
      renderScreen();
      await loaded();
      await user.click(screen.getByRole('button', { name: 'Mark All Present' }));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));
      await user.click(saveButton());

      expect(await screen.findByText('Failed to save attendance. Please try again.')).toBeInTheDocument();
      expect(screen.queryByText('Attendance saved successfully!')).not.toBeInTheDocument();
      expect(saveButton()).toBeEnabled();

      await user.click(saveButton());
      expect(await screen.findByText('Attendance saved successfully!')).toBeInTheDocument();
      expect(mocked.saveAttendanceWithSalary).toHaveBeenCalledTimes(2);
    });
  });

  describe('a day that is already recorded', () => {
    beforeEach(() => {
      mocked.getAttendanceForDate.mockResolvedValue([
        { employee_id: 'e01', date: '2026-10-15', status: 'PRESENT' },
        { employee_id: 'e02', date: '2026-10-15', status: 'HALF_DAY' },
        { employee_id: 'e03', date: '2026-10-15', status: 'ABSENT' },
      ] as never);
    });

    it('shows what was recorded and says it cannot be changed', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByText('Attendance for this date has already been recorded and cannot be modified.')).toBeInTheDocument();
      expect(within(cardFor('Daily Dan')).getByRole('button', { name: 'Present' }).className).toContain('bg-green-600');
      expect(within(cardFor('Fixed Fiona')).getByRole('button', { name: 'Half Day' }).className).toContain('bg-yellow-600');
      expect(within(cardFor('Fixed Finn')).getByRole('button', { name: 'Absent' }).className).toContain('bg-red-600');
    });

    it('locks the buttons and offers no way to save or mark everyone', async () => {
      renderScreen();
      await loaded();

      for (const b of within(cardFor('Daily Dan')).getAllByRole('button')) expect(b).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Save Attendance' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Mark All Present' })).not.toBeInTheDocument();
    });
  });

  describe('other dates', () => {
    it('asks for that date\'s attendance when the date is changed', async () => {
      renderScreen();
      await loaded();

      setDate('2026-10-14');

      await waitFor(() => expect(mocked.getAttendanceForDate).toHaveBeenCalledWith('2026-10-14'));
    });

    it.each([
      ['yesterday', '2026-10-14'],
      ['three days ago', '2026-10-12'],
    ])('lets attendance be marked for %s, with a note that it is a past date', async (_label, date) => {
      renderScreen();
      await loaded();

      setDate(date);

      expect(await screen.findByText('You are marking attendance for a past date.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Mark All Present' })).toBeInTheDocument();
    });

    it('does not let attendance be changed for a date more than three days back', async () => {
      renderScreen();
      await loaded();

      setDate('2026-10-11');

      expect(await screen.findByText('You cannot modify attendance for dates more than 3 days in the past.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save Attendance' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Mark All Present' })).not.toBeInTheDocument();
    });

    it('saves against the chosen past date', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      setDate('2026-10-14');
      await screen.findByText('You are marking attendance for a past date.');
      await user.click(screen.getByRole('button', { name: 'Mark All Present' }));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await user.click(saveButton());

      await waitFor(() => expect(mocked.saveAttendanceWithSalary).toHaveBeenCalled());
      expect(mocked.saveAttendanceWithSalary.mock.calls[0][0]).toBe('2026-10-14');
      expect(mocked.saveAttendanceWithSalary.mock.calls[0][2][0]).toMatchObject({
        notes: 'Auto-entry for 2026-10-14 — Present',
      });
    });
  });

  describe('inactive employees', () => {
    it('lists them under the Inactive tab, read-only', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Inactive Employees' }));

      expect(await screen.findByText('Gone Gary')).toBeInTheDocument();
      expect(screen.queryByText('Daily Dan')).not.toBeInTheDocument();
      for (const b of within(cardFor('Gone Gary')).getAllByRole('button')) expect(b).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Save Attendance' })).not.toBeInTheDocument();
    });

    it('says when there are none', async () => {
      const user = userEvent.setup();
      mocked.getEmployeesForAttendance.mockImplementation(async (active = true) => (active ? ACTIVE : []) as never);
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Inactive Employees' }));

      expect(await screen.findByText('No inactive employees found.')).toBeInTheDocument();
    });
  });

  describe('when something fails', () => {
    it('says so when the employees cannot be loaded', async () => {
      mocked.getEmployeesForAttendance.mockRejectedValue(new Error('down'));
      renderScreen();

      expect(await screen.findByText('Failed to load employees. Please try again.')).toBeInTheDocument();
    });

    it('says so when the attendance cannot be loaded', async () => {
      mocked.getAttendanceForDate.mockRejectedValue(new Error('down'));
      renderScreen();

      expect(await screen.findByText('Failed to load attendance. Please try again.')).toBeInTheDocument();
    });
  });
});
