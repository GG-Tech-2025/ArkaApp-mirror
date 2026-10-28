import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AttendanceViewScreen } from './AttendanceViewScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({
  getEmployeesForAttendance: vi.fn(),
  getAttendanceForMonth: vi.fn(),
  getAppStartDate: vi.fn(),
}));

const mocked = vi.mocked(middleware);

// Today is a fixed UTC moment (the screen works out today from the UTC date).
const NOW = new Date(Date.UTC(2026, 9, 15, 10, 0, 0));

const emp = (id: string, name: string) => ({
  id,
  name,
  phone: '9000000000',
  role_id: 'role',
  deduction_amount: null,
  roles: { id: 'role', name: 'Role', category: 'DAILY', salary_value: 500 },
});

const DAN = emp('e01', 'Daily Dan');
const FIONA = emp('e02', 'Fixed Fiona');
const GARY = emp('e09', 'Gone Gary');

const rec = (id: string, day: number, status: string) => ({
  employee_id: id,
  date: `2026-10-${String(day).padStart(2, '0')}`,
  status,
});

// Dan is present every day from the 1st to the 14th except the 2nd (absent) and the 3rd (leave);
// nobody was recorded on the 4th, which is the one missed date.
function monthRecords() {
  const out = [];
  for (let day = 1; day <= 14; day++) {
    if (day === 4) continue;
    out.push(rec('e01', day, day === 2 ? 'ABSENT' : day === 3 ? 'LEAVE' : 'PRESENT'));
  }
  out.push(rec('e02', 1, 'PRESENT'), rec('e02', 2, 'HALF_DAY'), rec('e02', 3, 'PRESENT'));
  out.push(rec('e09', 1, 'PRESENT'), rec('e09', 2, 'PRESENT'));
  return out;
}

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin/employees/attendance/view']}>
      <Routes>
        <Route path="/admin/employees/attendance/view" element={<AttendanceViewScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const table = () => screen.getByRole('table');
const rowFor = (name: string) => within(table()).getByRole('row', { name: new RegExp(name) });
const cells = (name: string) => within(rowFor(name)).getAllByRole('cell');

async function loaded() {
  await waitFor(() => expect(within(table()).getByText('Daily Dan')).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  mocked.getAppStartDate.mockResolvedValue('2026-10-01');
  mocked.getEmployeesForAttendance.mockImplementation(async (active = true) => (active ? [DAN, FIONA] : [DAN, FIONA, GARY]) as never);
  mocked.getAttendanceForMonth.mockResolvedValue(monthRecords() as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AttendanceViewScreen', () => {
  describe('layout', () => {
    it('shows the heading, the legend and a Back button', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      expect(screen.getByRole('heading', { name: 'Attendance Overview' })).toBeInTheDocument();
      expect(screen.getByText('Monthly attendance matrix for all employees')).toBeInTheDocument();
      for (const label of ['Present (P)', 'Absent (A)', 'Half Day (H)', 'Leave (L)', 'No Entry (—)', 'Inactive period']) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }

      await user.click(screen.getByRole('button', { name: /Back to Attendance/ }));
      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/attendance');
    });

    it('shows a loading message while the data loads', () => {
      mocked.getAttendanceForMonth.mockReturnValue(new Promise(() => {}));
      renderScreen();

      return screen.findByText('Loading attendance data...');
    });

    it('opens on the current month and year', async () => {
      renderScreen();
      await loaded();

      const [month, year] = screen.getAllByRole('combobox');
      expect(month).toHaveValue('10');
      expect(year).toHaveValue('2026');
    });

    it('offers only the months from the app start month in the start year, and years from the start year on', async () => {
      renderScreen();
      await loaded();

      const [month, year] = screen.getAllByRole('combobox');
      expect(within(month).getAllByRole('option').map((o) => o.textContent)).toEqual(['October', 'November', 'December']);
      const years = within(year).getAllByRole('option').map((o) => o.textContent);
      expect(years[0]).toBe('2026');
      expect(years.at(-1)).toBe('2070');
    });
  });

  describe('the table', () => {
    it('has a column for each day from the app start up to today, and the P, A, H, L totals', async () => {
      renderScreen();
      await loaded();

      const headers = within(table()).getAllByRole('columnheader').map((h) => h.textContent?.replace('⚠', '').trim());
      expect(headers[0]).toBe('Employee');
      expect(headers.slice(1, 16)).toEqual(Array.from({ length: 15 }, (_, i) => String(i + 1)));
      expect(headers.slice(16)).toEqual(['P', 'A', 'H', 'L']);
    });

    it('does not go back before the app start date', async () => {
      mocked.getAppStartDate.mockResolvedValue('2026-10-10');
      renderScreen();
      await loaded();

      const headers = within(table()).getAllByRole('columnheader').map((h) => h.textContent?.replace('⚠', '').trim());
      expect(headers.slice(1, 7)).toEqual(['10', '11', '12', '13', '14', '15']);
    });

    it('shows each employee\'s days as P, A, H, L or a dash', async () => {
      renderScreen();
      await loaded();

      const dan = cells('Daily Dan').map((c) => c.textContent);
      expect(dan[1]).toBe('P'); // 1st
      expect(dan[2]).toBe('A'); // 2nd
      expect(dan[3]).toBe('L'); // 3rd
      const fiona = cells('Fixed Fiona').map((c) => c.textContent);
      expect(fiona[2]).toBe('H');
      expect(fiona[4]).toBe('⚠'); // the missed 4th
      expect(fiona[15]).toBe('—'); // today, nothing recorded yet
    });

    it('totals each employee\'s statuses', async () => {
      renderScreen();
      await loaded();

      const dan = cells('Daily Dan').map((c) => c.textContent);
      expect(dan.slice(-4)).toEqual(['11', '1', '0', '1']); // 11 present (the 1st and 5th to 14th), 1 absent, 0 half, 1 leave
      const fiona = cells('Fixed Fiona').map((c) => c.textContent);
      expect(fiona.slice(-4)).toEqual(['2', '0', '1', '0']);
    });

    it('describes each cell in its tooltip', async () => {
      renderScreen();
      await loaded();

      expect(cells('Daily Dan')[2]).toHaveAttribute('title', 'Daily Dan - 2026-10-02: Absent');
    });
  });

  describe('missed dates', () => {
    it('marks a past date with no records at all, and says how many', async () => {
      renderScreen();
      await loaded();

      const headerFor4 = within(table()).getAllByRole('columnheader')[4];
      expect(headerFor4).toHaveTextContent('4');
      expect(headerFor4).toHaveTextContent('⚠');
      expect(headerFor4).toHaveAttribute('title', 'No attendance recorded for this date');
      expect(screen.getByText('1 date')).toBeInTheDocument();
      expect(screen.getByText(/has no attendance recorded/)).toBeInTheDocument();
    });

    it('uses the plural when several dates were missed', async () => {
      mocked.getAttendanceForMonth.mockResolvedValue([rec('e01', 1, 'PRESENT')] as never);
      renderScreen();
      await loaded();

      expect(screen.getByText('13 dates')).toBeInTheDocument();
      expect(screen.getByText(/have no attendance recorded/)).toBeInTheDocument();
    });

    it('does not count today as missed', async () => {
      renderScreen();
      await loaded();

      expect(within(table()).getAllByRole('columnheader')[15]).not.toHaveTextContent('⚠');
    });

    it('shows no notice when nothing was missed', async () => {
      mocked.getAppStartDate.mockResolvedValue('2026-10-13');
      mocked.getAttendanceForMonth.mockResolvedValue([rec('e01', 13, 'PRESENT'), rec('e01', 14, 'PRESENT')] as never);
      renderScreen();
      await loaded();

      expect(screen.queryByText(/no attendance recorded/)).not.toBeInTheDocument();
    });
  });

  describe('inactive employees', () => {
    it('lists an inactive employee who has records in the month, with an Inactive badge', async () => {
      renderScreen();
      await loaded();

      expect(rowFor('Gone Gary')).toHaveTextContent('Inactive');
      expect(rowFor('Gone Gary')).toHaveTextContent('Gone Gary');
    });

    it('greys out the days after their last record', async () => {
      renderScreen();
      await loaded();

      const gary = cells('Gone Gary');
      expect(gary[1].textContent).toBe('P');
      expect(gary[3]).toHaveAttribute('title', 'Employee was inactive');
    });

    it('does not list inactive employees with no records in the month', async () => {
      mocked.getAttendanceForMonth.mockResolvedValue([rec('e01', 1, 'PRESENT')] as never);
      renderScreen();
      await loaded();

      expect(within(table()).queryByText('Gone Gary')).not.toBeInTheDocument();
    });
  });

  describe('changing the period', () => {
    it('loads the chosen month', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      mocked.getAttendanceForMonth.mockClear();

      await user.selectOptions(screen.getAllByRole('combobox')[0], 'November');

      await waitFor(() => expect(mocked.getAttendanceForMonth).toHaveBeenCalledWith(2026, 11));
    });

    it('shows no days for a month that has not started', async () => {
      const user = userEvent.setup();
      mocked.getAttendanceForMonth.mockResolvedValue([] as never);
      renderScreen();
      await loaded();

      await user.selectOptions(screen.getAllByRole('combobox')[0], 'November');

      await waitFor(() => expect(mocked.getAttendanceForMonth).toHaveBeenLastCalledWith(2026, 11));
      await waitFor(() => expect(within(table()).getAllByRole('columnheader')).toHaveLength(5)); // name + P A H L
    });

    it('offers all twelve months for a later year', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.selectOptions(screen.getAllByRole('combobox')[1], '2027');

      await waitFor(() => expect(screen.getAllByRole('combobox')[0].querySelectorAll('option')).toHaveLength(12));
      expect(mocked.getAttendanceForMonth).toHaveBeenLastCalledWith(2027, expect.any(Number));
    });
  });

  describe('when there is nothing to show or something fails', () => {
    it('says so when there are no employees', async () => {
      mocked.getEmployeesForAttendance.mockResolvedValue([] as never);
      mocked.getAttendanceForMonth.mockResolvedValue([] as never);
      renderScreen();

      expect(await screen.findByText('No employee data found for this period.')).toBeInTheDocument();
    });

    it('says so when the attendance cannot be loaded', async () => {
      mocked.getAttendanceForMonth.mockRejectedValue(new Error('down'));
      renderScreen();

      expect(await screen.findByText('Failed to load attendance data. Please try again.')).toBeInTheDocument();
    });
  });
});
