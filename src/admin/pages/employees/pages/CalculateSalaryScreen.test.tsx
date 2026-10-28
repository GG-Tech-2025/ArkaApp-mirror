import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CalculateSalaryScreen } from './CalculateSalaryScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({
  getSalaryEmployees: vi.fn(),
  generateSalaryRPC: vi.fn(),
  checkSalaryAlreadyGenerated: vi.fn(),
}));

const mocked = vi.mocked(middleware);

// Mid-October, so the salary being calculated is September's.
const NOW = new Date(2026, 9, 15, 10, 0, 0);

const emp = (n: number, name: string, base: number, present = 24, absent = 1, leave = 2, half = 1) => ({
  employee_id: `abcdef12-0000-0000-0000-00000000000${n}`,
  name,
  phone: `90000000${n}${n}`,
  present_days: present,
  absent_days: absent,
  leave_days: leave,
  half_days: half,
  base_salary: base,
});

const EMPLOYEES = [emp(1, 'Fixed Fiona', 25000), emp(2, 'Fixed Finn', 20000, 20, 3, 1, 2)];

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin/employees/salary-ledger/calculate']}>
      <Routes>
        <Route path="/admin/employees/salary-ledger/calculate" element={<CalculateSalaryScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const table = () => screen.getByRole('table');
const rowFor = (name: string) => within(table()).getByRole('row', { name: new RegExp(name) });
const salaryInput = (name: string) => within(rowFor(name)).getByRole('spinbutton');
const generateButton = () => screen.getByRole('button', { name: /^(Generate Salary|Generating\.\.\.)$/ });

async function loaded() {
  await waitFor(() => expect(within(table()).getByText('Fixed Fiona')).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  mocked.checkSalaryAlreadyGenerated.mockResolvedValue(false);
  mocked.getSalaryEmployees.mockResolvedValue(EMPLOYEES as never);
  mocked.generateSalaryRPC.mockResolvedValue({} as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CalculateSalaryScreen', () => {
  describe('what is shown', () => {
    it('names the month being calculated, and notes that deductions are already made', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByRole('heading', { name: 'Calculate Salary' })).toBeInTheDocument();
      expect(screen.getByText(/Generate fixed salary for/)).toHaveTextContent('September 2026');
      expect(screen.getByText('Deduction for absent and half day has already been made.')).toBeInTheDocument();
    });

    it('checks last month first, then asks for this month\'s attendance counts', async () => {
      renderScreen();
      await loaded();

      expect(mocked.checkSalaryAlreadyGenerated).toHaveBeenCalledWith('2026-09-01');
      expect(mocked.getSalaryEmployees).toHaveBeenCalledWith('2026-10-01');
    });

    it('shows a loading message until the employees arrive', () => {
      mocked.getSalaryEmployees.mockReturnValue(new Promise(() => {}));
      renderScreen();

      return screen.findByText('Loading employees...');
    });

    it('lists each fixed-salary employee with their attendance counts and a salary field', async () => {
      renderScreen();
      await loaded();

      const fiona = within(rowFor('Fixed Fiona')).getAllByRole('cell').map((c) => c.textContent);
      expect(fiona.slice(0, 7)).toEqual(['abcdef12…', 'Fixed Fiona', '9000000011', '24', '1', '2', '1']);
      const finn = within(rowFor('Fixed Finn')).getAllByRole('cell').map((c) => c.textContent);
      expect(finn.slice(3, 7)).toEqual(['20', '3', '1', '2']);
    });

    it('starts each salary at the employee\'s base salary', async () => {
      renderScreen();
      await loaded();

      expect(salaryInput('Fixed Fiona')).toHaveValue(25000);
      expect(salaryInput('Fixed Finn')).toHaveValue(20000);
    });

    it('says when there are no active fixed-salary employees, and offers nothing to generate', async () => {
      mocked.getSalaryEmployees.mockResolvedValue([] as never);
      renderScreen();

      expect(await screen.findByText('No active fixed salary employees found.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Generate Salary' })).not.toBeInTheDocument();
    });

    it('goes back to the salary ledger', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: /Back to Salary Ledger/ }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/salary-ledger');
    });
  });

  describe('when the month has already been done', () => {
    beforeEach(() => {
      mocked.checkSalaryAlreadyGenerated.mockResolvedValue(true);
    });

    it('says so, and shows no employees or button', async () => {
      renderScreen();

      expect(await screen.findByText('Salary Already Generated')).toBeInTheDocument();
      expect(screen.getByText(/Please wait till next month to do the calculation/)).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Generate Salary' })).not.toBeInTheDocument();
    });

    it('does not even ask for the employees', async () => {
      renderScreen();
      await screen.findByText('Salary Already Generated');

      expect(mocked.getSalaryEmployees).not.toHaveBeenCalled();
    });
  });

  describe('adjusting the salary', () => {
    it('lets a salary be changed for one employee only', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.clear(salaryInput('Fixed Fiona'));
      await user.type(salaryInput('Fixed Fiona'), '24000');

      expect(salaryInput('Fixed Fiona')).toHaveValue(24000);
      expect(salaryInput('Fixed Finn')).toHaveValue(20000);
    });
  });

  describe('generating the salary', () => {
    it('generates last month\'s salary with the base figures and the counts for each employee', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(generateButton());

      await waitFor(() => expect(mocked.generateSalaryRPC).toHaveBeenCalledTimes(1));
      expect(mocked.generateSalaryRPC).toHaveBeenCalledWith('2026-09-01', [
        {
          employee_id: 'abcdef12-0000-0000-0000-000000000001',
          present_days: 24,
          absent_days: 1,
          leave_days: 2,
          half_days: 1,
          base_salary: 25000,
          final_salary: 25000,
        },
        {
          employee_id: 'abcdef12-0000-0000-0000-000000000002',
          present_days: 20,
          absent_days: 3,
          leave_days: 1,
          half_days: 2,
          base_salary: 20000,
          final_salary: 20000,
        },
      ]);
    });

    it('uses the adjusted figure as the final salary, keeping the base salary', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.clear(salaryInput('Fixed Fiona'));
      await user.type(salaryInput('Fixed Fiona'), '24000');

      await user.click(generateButton());

      await waitFor(() => expect(mocked.generateSalaryRPC).toHaveBeenCalled());
      expect(mocked.generateSalaryRPC.mock.calls[0][1][0]).toMatchObject({ base_salary: 25000, final_salary: 24000 });
    });

    it('treats a cleared salary as zero', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.clear(salaryInput('Fixed Finn'));

      await user.click(generateButton());

      await waitFor(() => expect(mocked.generateSalaryRPC).toHaveBeenCalled());
      expect(mocked.generateSalaryRPC.mock.calls[0][1][1]).toMatchObject({ final_salary: 0 });
    });

    it('confirms with a success popup naming the month, then shows the month as done', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(generateButton());

      expect(await screen.findByText('Salary for September 2026 has been generated successfully!')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.getByText('Salary Already Generated')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Generate Salary' })).not.toBeInTheDocument();
    });

    it('shows Generating... and ignores another press while it is in flight', async () => {
      const user = userEvent.setup();
      let finish: () => void = () => {};
      mocked.generateSalaryRPC.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)) as never);
      renderScreen();
      await loaded();

      await user.click(generateButton());

      const busy = await screen.findByRole('button', { name: 'Generating...' });
      expect(busy).toBeDisabled();
      await user.click(busy);
      expect(mocked.generateSalaryRPC).toHaveBeenCalledTimes(1);

      finish();
      expect(await screen.findByText(/has been generated successfully/)).toBeInTheDocument();
    });

    it('says so when generating fails, and allows another try', async () => {
      const user = userEvent.setup();
      mocked.generateSalaryRPC.mockRejectedValueOnce(new Error('rpc down'));
      renderScreen();
      await loaded();
      await user.click(generateButton());

      expect(await screen.findByText('Failed to generate salary. Please try again.')).toBeInTheDocument();
      expect(screen.queryByText(/has been generated successfully/)).not.toBeInTheDocument();
      expect(generateButton()).toBeEnabled();

      await user.click(generateButton());
      expect(await screen.findByText(/has been generated successfully/)).toBeInTheDocument();
    });

    it('recognises that someone else already generated it, and says so', async () => {
      const user = userEvent.setup();
      mocked.generateSalaryRPC.mockRejectedValue(new Error('Salary already generated for this month'));
      renderScreen();
      await loaded();

      await user.click(generateButton());

      expect(await screen.findByText('Salary has already been generated for this month.')).toBeInTheDocument();
      expect(screen.getByText('Salary Already Generated')).toBeInTheDocument();
    });
  });

  describe('when the employees cannot be loaded', () => {
    it('says so', async () => {
      mocked.getSalaryEmployees.mockRejectedValue(new Error('down'));
      renderScreen();

      expect(await screen.findByText('Failed to load employees. Please try again.')).toBeInTheDocument();
    });

    it('says so when the check for an existing run fails', async () => {
      mocked.checkSalaryAlreadyGenerated.mockRejectedValue(new Error('down'));
      renderScreen();

      expect(await screen.findByText('Failed to load employees. Please try again.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Generate Salary' })).not.toBeInTheDocument();
    });
  });
});
