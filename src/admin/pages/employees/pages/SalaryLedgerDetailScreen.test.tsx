import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SalaryLedgerDetailScreen } from './SalaryLedgerDetailScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({ getEmployeeLedger: vi.fn() }));

const mocked = vi.mocked(middleware);

const EMPLOYEE = {
  id: 'e01',
  name: 'Daily Dan',
  phone: '9000000011',
  role_name: 'Mason',
  role_category: 'DAILY',
  running_balance: 12500,
};

const tx = (id: string, type: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id,
  entry_type: type,
  amount,
  payment_mode: null,
  sender_account_id: null,
  receiver_account: null,
  notes: null,
  payment_at: '2026-10-10T12:00:00Z',
  ...extra,
});

const TRANSACTIONS = [
  tx('t1', 'SALARY_AUTO_ENTRY', 650, { notes: 'Auto-entry for 2026-10-10 — Present' }),
  tx('t2', 'ADVANCE', 500, { payment_mode: 'CASH', sender_account_id: 'acc-1', receiver_account: 'Dan', notes: 'Festival advance' }),
  tx('t3', 'DEDUCTION', 800),
];

const result = (transactions = TRANSACTIONS, total = transactions.length, employee = EMPLOYEE) => ({
  employee,
  transactions,
  total_count: total,
});

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen(id = 'e01') {
  return render(
    <MemoryRouter initialEntries={[`/admin/employees/salary-ledger/${id}`]}>
      <Routes>
        <Route path="/admin/employees/salary-ledger/:id" element={<SalaryLedgerDetailScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const table = () => screen.getByRole('table');
const rowFor = (text: string) => within(table()).getByText(text).closest('tr') as HTMLElement;

async function loaded() {
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Salary Ledger Details' })).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getEmployeeLedger.mockResolvedValue(result() as never);
});

describe('SalaryLedgerDetailScreen', () => {
  describe('loading', () => {
    it('shows a loading message until the ledger arrives', async () => {
      mocked.getEmployeeLedger.mockReturnValue(new Promise(() => {}));
      renderScreen();

      expect(await screen.findByText('Loading ledger...')).toBeInTheDocument();
    });

    it('asks for the newest entries of the employee in the address', async () => {
      renderScreen('e01');
      await loaded();

      expect(mocked.getEmployeeLedger).toHaveBeenCalledWith('e01', 0, false, undefined, undefined);
    });
  });

  describe('the employee and balance', () => {
    it('shows the employee\'s name, id, role and category', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByText('Daily Dan')).toBeInTheDocument();
      expect(screen.getByText('e01')).toBeInTheDocument();
      expect(screen.getByText('Mason')).toBeInTheDocument();
      expect(screen.getByText('Daily Wages')).toBeInTheDocument();
    });

    it('shows the running balance in rupees', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByText('Current Running Balance').nextElementSibling).toHaveTextContent('₹12,500');
    });

    it('shows a negative balance with the minus sign in front', async () => {
      mocked.getEmployeeLedger.mockResolvedValue(result(TRANSACTIONS, 3, { ...EMPLOYEE, running_balance: -1250 }) as never);
      renderScreen();
      await loaded();

      expect(screen.getByText('Current Running Balance').nextElementSibling).toHaveTextContent('-₹1,250');
    });

    it('shows dashes for details that are missing', async () => {
      mocked.getEmployeeLedger.mockResolvedValue(result(TRANSACTIONS, 3, { ...EMPLOYEE, role_name: null, role_category: null }) as never);
      renderScreen();
      await loaded();

      expect(screen.getByText('Role').nextElementSibling).toHaveTextContent('—');
      expect(screen.getByText('Category').nextElementSibling).toHaveTextContent('—');
    });
  });

  describe('the transactions', () => {
    it('lists them with date, type, amount and notes', async () => {
      renderScreen();
      await loaded();

      expect(rowFor('Salary Auto Entry')).toHaveTextContent('10 Oct 2026');
      expect(rowFor('Salary Auto Entry')).toHaveTextContent('+₹650');
      expect(rowFor('Salary Auto Entry')).toHaveTextContent('Auto-entry for 2026-10-10 — Present');
      expect(rowFor('Advance')).toHaveTextContent('-₹500');
      expect(rowFor('Deduction')).toHaveTextContent('-₹800');
    });

    it('shows payment mode and the sender and receiver accounts, or dashes', async () => {
      renderScreen();
      await loaded();

      const advance = within(rowFor('Advance')).getAllByRole('cell').map((c) => c.textContent);
      expect(advance[4]).toBe('CASH');
      expect(advance[5]).toBe('acc-1');
      expect(advance[6]).toBe('Dan');
      const deduction = within(rowFor('Deduction')).getAllByRole('cell').map((c) => c.textContent);
      expect(deduction.slice(3, 7)).toEqual(['—', '—', '—', '—']);
    });

    it('shows how many of the total are on screen', async () => {
      mocked.getEmployeeLedger.mockResolvedValue(result(TRANSACTIONS, 45) as never);
      renderScreen();
      await loaded();

      expect(screen.getByText('3 of 45')).toBeInTheDocument();
    });

    it('says when there are no transactions', async () => {
      mocked.getEmployeeLedger.mockResolvedValue(result([], 0) as never);
      renderScreen();
      await loaded();

      expect(screen.getByText('No salary transactions recorded for this employee.')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('adds the next page on Load More, then hides it when everything is shown', async () => {
      const user = userEvent.setup();
      mocked.getEmployeeLedger.mockResolvedValue(result(TRANSACTIONS, 4) as never);
      renderScreen();
      await loaded();
      mocked.getEmployeeLedger.mockResolvedValue(result([tx('t4', 'ADVANCE', 100, { notes: 'Fourth one' })], 4) as never);

      await user.click(screen.getByRole('button', { name: 'Load More' }));

      await waitFor(() => expect(within(table()).getByText('Fourth one')).toBeInTheDocument());
      expect(mocked.getEmployeeLedger).toHaveBeenLastCalledWith('e01', 1, false, undefined, undefined);
      expect(screen.getByText('4 of 4')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
    });

    it('does not show Load More when everything fits', async () => {
      renderScreen();
      await loaded();

      expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
    });
  });

  describe('the audit details', () => {
    it('opens a window with the transaction\'s details, and closes it', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(within(rowFor('Advance')).getByTitle('View Audit Details'));

      expect(screen.getByRole('heading', { name: 'Audit Details' })).toBeInTheDocument();
      expect(screen.getByText('Transaction ID').nextElementSibling).toHaveTextContent('t2');
      expect(screen.getByText('Mode of Payment', { selector: 'p' }).nextElementSibling).toHaveTextContent('CASH');
      expect(screen.getByText('Sender Account Info').nextElementSibling).toHaveTextContent('acc-1');
      expect(screen.getByText('Receiver Account Info').nextElementSibling).toHaveTextContent('Dan');
      expect(screen.getAllByText('Festival advance').length).toBeGreaterThan(0);

      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('heading', { name: 'Audit Details' })).not.toBeInTheDocument();
    });

    it('leaves out the notes when there are none', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(within(rowFor('Deduction')).getByTitle('View Audit Details'));

      expect(screen.queryByText('Notes', { selector: 'p' })).not.toBeInTheDocument();
    });
  });

  describe('sorting and filtering', () => {
    it('applies a sort order', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.selectOptions(screen.getByLabelText('Sort Order'), 'oldest');
      await user.click(screen.getByRole('button', { name: /Apply Filter/ }));

      await waitFor(() => expect(mocked.getEmployeeLedger).toHaveBeenLastCalledWith('e01', 0, true, undefined, undefined));
    });

    it('does nothing until Apply Filter is pressed', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      mocked.getEmployeeLedger.mockClear();

      await user.selectOptions(screen.getByLabelText('Sort Order'), 'oldest');

      expect(mocked.getEmployeeLedger).not.toHaveBeenCalled();
    });

    it('applies a date range, including the whole of the To date', async () => {
      renderScreen();
      await loaded();

      fireEvent.change(screen.getByLabelText('From Date'), { target: { value: '2026-10-01' } });
      fireEvent.change(screen.getByLabelText('To Date'), { target: { value: '2026-10-10' } });
      fireEvent.click(screen.getByRole('button', { name: /Apply Filter/ }));

      await waitFor(() =>
        expect(mocked.getEmployeeLedger).toHaveBeenLastCalledWith('e01', 0, false, '2026-10-01', '2026-10-11'),
      );
    });

    it('keeps the applied filter when loading more', async () => {
      const user = userEvent.setup();
      mocked.getEmployeeLedger.mockResolvedValue(result(TRANSACTIONS, 6) as never);
      renderScreen();
      await loaded();
      await user.selectOptions(screen.getByLabelText('Sort Order'), 'oldest');
      fireEvent.change(screen.getByLabelText('From Date'), { target: { value: '2026-10-01' } });
      await user.click(screen.getByRole('button', { name: /Apply Filter/ }));
      await waitFor(() => expect(mocked.getEmployeeLedger).toHaveBeenLastCalledWith('e01', 0, true, '2026-10-01', undefined));

      await user.click(await screen.findByRole('button', { name: 'Load More' }));

      await waitFor(() => expect(mocked.getEmployeeLedger).toHaveBeenLastCalledWith('e01', 1, true, '2026-10-01', undefined));
    });

    it('Clear Filter puts everything back and reloads', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(screen.getByLabelText('Sort Order'), 'oldest');
      fireEvent.change(screen.getByLabelText('From Date'), { target: { value: '2026-10-01' } });

      await user.click(screen.getByRole('button', { name: 'Clear Filter' }));

      expect(screen.getByLabelText('Sort Order')).toHaveValue('newest');
      expect(screen.getByLabelText('From Date')).toHaveValue('');
      await waitFor(() => expect(mocked.getEmployeeLedger).toHaveBeenLastCalledWith('e01', 0, false, undefined, undefined));
    });
  });

  describe('the filter fields', () => {
    it('can each be found by their label', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByLabelText('Sort Order')).toBeInTheDocument();
      expect(screen.getByLabelText('From Date')).toBeInTheDocument();
      expect(screen.getByLabelText('To Date')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('opens the Add Payment screen for this employee', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: /Add Payment/ }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/salary-ledger/e01/add-payment');
    });

    it('goes back to the salary ledger', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: /Back to Salary Ledger/ }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/salary-ledger');
    });
  });

  // Gaps found while writing these tests, written as the behaviour the screen should have and
  // marked `fails`: each passes while the gap exists and goes red once it is fixed, at which
  // point the `.fails` should be removed.
  describe('known gaps', () => {
    it.fails('tells the administrator when the ledger cannot be loaded, instead of showing an empty one', async () => {
      mocked.getEmployeeLedger.mockRejectedValue(new Error('down'));
      renderScreen();
      await loaded();

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
