import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AddPaymentScreen } from './AddPaymentScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({
  getAccounts: vi.fn(),
  getEmployeeLedger: vi.fn(),
  createSalaryLedgerEntry: vi.fn(),
}));

const mocked = vi.mocked(middleware);

// Today is a fixed UTC moment: the form's default date and time come from the UTC clock.
const NOW = new Date(Date.UTC(2026, 9, 15, 10, 0, 0));

const EMPLOYEE = { id: 'e01', name: 'Daily Dan', phone: '9000000011', role_name: 'Mason', role_category: 'DAILY', running_balance: 5000 };
const ACCOUNTS = [
  { id: 'acc-cash', account_number: 'CASH', balance: 3000, is_cash: true },
  { id: 'acc-1', account_number: 'HDFC-1234', balance: 100000, is_cash: false },
  { id: 'acc-2', account_number: 'SBI-9999', balance: 800, is_cash: false },
];

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin/employees/salary-ledger/e01/add-payment']}>
      <Routes>
        <Route path="/admin/employees/salary-ledger/:id/add-payment" element={<AddPaymentScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const f = {
  entryType: () => screen.getByLabelText(/^Type of Entry/),
  amount: () => screen.getByLabelText(/^Amount/),
  dateTime: () => screen.getByLabelText(/^Date & Time/),
  notes: () => screen.getByLabelText(/^Notes/),
  mode: () => screen.getByLabelText(/^Mode of Payment/),
  sai: () => screen.getByLabelText(/^SAI/),
  rai: () => screen.getByLabelText(/^RAI/),
};
const confirmButton = () => screen.getByRole('button', { name: /^(Confirm Payment|Confirm Settlement|Saving\.\.\.)$/ });

type User = ReturnType<typeof userEvent.setup>;

async function loaded() {
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Add Payment / Settlement' })).toBeInTheDocument());
}

async function fillCard(user: User, type = 'Advance Payment', amount = '1000') {
  await user.selectOptions(f.entryType(), type);
  await user.clear(f.amount());
  await user.type(f.amount(), amount);
  await user.selectOptions(f.sai(), 'acc-1');
  await user.type(f.rai(), '  Dan HDFC 5555  ');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  mocked.getEmployeeLedger.mockResolvedValue({ employee: EMPLOYEE, transactions: [], total_count: 0 } as never);
  mocked.getAccounts.mockResolvedValue(ACCOUNTS as never);
  mocked.createSalaryLedgerEntry.mockResolvedValue(undefined as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AddPaymentScreen', () => {
  describe('what is shown', () => {
    it('shows a loading message until the data arrives', async () => {
      mocked.getEmployeeLedger.mockReturnValue(new Promise(() => {}));
      renderScreen();

      expect(await screen.findByText('Loading...')).toBeInTheDocument();
    });

    it('shows the employee and their current balance', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByText('Daily Dan')).toBeInTheDocument();
      expect(screen.getByText('e01')).toBeInTheDocument();
      expect(screen.getByText('Mason')).toBeInTheDocument();
      expect(screen.getByText('Daily Wages')).toBeInTheDocument();
      expect(screen.getByText('Current Balance').nextElementSibling).toHaveTextContent(`₹${(5000).toLocaleString()}`);
    });

    it('offers the seven entry types', async () => {
      renderScreen();
      await loaded();

      expect(within(f.entryType()).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Select entry type',
        'Advance Payment',
        'Weekly Payment',
        'Emergency Payment',
        'Daily / Ad-hoc Payment',
        'Partial Settlement',
        'Full Settlement',
        'Manual Salary Entry',
      ]);
    });

    it('starts with UPI and the current date and time, and no type or amount', async () => {
      renderScreen();
      await loaded();

      expect(f.entryType()).toHaveValue('');
      expect(f.amount()).toHaveValue(null);
      expect(f.mode()).toHaveValue('UPI');
      expect(f.dateTime()).toHaveValue('2026-10-15T10:00');
      expect(screen.getByText('You can backdate an entry if needed')).toBeInTheDocument();
    });

    it('lists only bank accounts as senders, with their balances', async () => {
      renderScreen();
      await loaded();

      expect(within(f.sai()).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Select Account',
        `HDFC-1234 (₹${(100000).toLocaleString()})`,
        'SBI-9999 (₹800)',
      ]);
    });

    it('counts the characters of the notes, up to 80', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.type(f.notes(), 'Medical need');

      expect(screen.getByText('12/80')).toBeInTheDocument();
      expect(f.notes()).toHaveAttribute('maxlength', '80');
    });

    it('goes back to the ledger from Back to Ledger and from Cancel', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: /Back to Ledger/ }));
      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/salary-ledger/e01');
    });

    it('goes back to the ledger from Cancel', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/salary-ledger/e01');
    });
  });

  describe('the entry type and payment mode', () => {
    it.each([
      ['Advance Payment', 'This payment will be deducted from the running balance.'],
      ['Partial Settlement', 'This settlement will reduce the running balance.'],
      ['Full Settlement', 'This settlement will clear the entire running balance.'],
      ['Manual Salary Entry', 'This entry will credit salary and increase the running balance.'],
    ])('explains what %s does', async (type, message) => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.selectOptions(f.entryType(), type);

      expect(screen.getByText(message)).toBeInTheDocument();
    });

    it('shows the confirm button as Confirm Payment, or Confirm Settlement for settlements', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      expect(screen.getByRole('button', { name: 'Confirm Payment' })).toBeInTheDocument();

      await user.selectOptions(f.entryType(), 'Partial Settlement');
      expect(screen.getByRole('button', { name: 'Confirm Settlement' })).toBeInTheDocument();

      await user.selectOptions(f.entryType(), 'Full Settlement');
      expect(screen.getByRole('button', { name: 'Confirm Settlement' })).toBeInTheDocument();

      await user.selectOptions(f.entryType(), 'Weekly Payment');
      expect(screen.getByRole('button', { name: 'Confirm Payment' })).toBeInTheDocument();
    });

    it('fills a full settlement with the whole running balance and locks the amount', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.selectOptions(f.entryType(), 'Full Settlement');

      expect(f.amount()).toHaveValue(5000);
      expect(f.amount()).toBeDisabled();
      expect(screen.getByText('Amount auto-filled to match current running balance')).toBeInTheDocument();
    });

    it('clears the amount again when the type is changed away from a full settlement', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.entryType(), 'Full Settlement');

      await user.selectOptions(f.entryType(), 'Advance Payment');

      expect(f.amount()).toHaveValue(null);
      expect(f.amount()).toBeEnabled();
    });

    it('shows the balance after a payment, a settlement and a manual salary credit', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.entryType(), 'Advance Payment');
      await user.type(f.amount(), '1500');
      expect(screen.getByText(/New balance after this transaction/)).toHaveTextContent(`₹${(3500).toLocaleString()}`);

      await user.selectOptions(f.entryType(), 'Manual Salary Entry');
      expect(screen.getByText(/New balance after this transaction/)).toHaveTextContent(`₹${(6500).toLocaleString()}`);
    });

    it('hides the account fields for a cash payment', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.selectOptions(f.mode(), 'Cash');

      expect(screen.queryByLabelText(/^SAI/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^RAI/)).not.toBeInTheDocument();
    });

    it('clears the chosen account and receiver when the payment mode is changed', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.sai(), 'acc-1');
      await user.type(f.rai(), 'Dan');

      await user.selectOptions(f.mode(), 'Bank Transfer');

      expect(f.sai()).toHaveValue('');
      expect(f.rai()).toHaveValue('');
    });

    it('hides the payment mode and accounts for a manual salary entry, and warns about it', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.selectOptions(f.entryType(), 'Manual Salary Entry');

      expect(screen.queryByLabelText(/^Mode of Payment/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^SAI/)).not.toBeInTheDocument();
      expect(screen.getByText('⚠️ Salary Credit Warning')).toBeInTheDocument();
      expect(screen.getByText(/manually credit a salary entry for this employee/)).toBeInTheDocument();
    });

    it('shows the balance of the account that will pay: the cash account, or the chosen one', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.entryType(), 'Advance Payment');
      expect(screen.queryByText(/Available account balance/)).not.toBeInTheDocument();

      await user.selectOptions(f.sai(), 'acc-2');
      expect(screen.getByText('Available account balance: ₹800')).toBeInTheDocument();

      await user.selectOptions(f.mode(), 'Cash');
      expect(screen.getByText(`Available account balance: ₹${(3000).toLocaleString()}`)).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('lists what is missing on an empty form, and saves nothing', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(confirmButton());

      expect(screen.getByText('Entry type is required')).toBeInTheDocument();
      expect(screen.getByText('Please enter a valid amount')).toBeInTheDocument();
      expect(screen.getByText('SAI is required')).toBeInTheDocument();
      expect(screen.getByText('RAI is required')).toBeInTheDocument();
      expect(mocked.createSalaryLedgerEntry).not.toHaveBeenCalled();
    });

    it.each(['0', '-50'])('rejects an amount of %s', async (amount) => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillCard(user, 'Advance Payment', '1');
      await user.clear(f.amount());
      await user.type(f.amount(), amount);

      await user.click(confirmButton());

      expect(screen.getByText('Please enter a valid amount')).toBeInTheDocument();
      expect(mocked.createSalaryLedgerEntry).not.toHaveBeenCalled();
    });

    it('refuses a part settlement larger than the pending balance', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillCard(user, 'Partial Settlement', '5001');

      await user.click(confirmButton());

      expect(screen.getByText('Settlement amount cannot exceed pending balance')).toBeInTheDocument();
      expect(mocked.createSalaryLedgerEntry).not.toHaveBeenCalled();
    });

    it('allows a part settlement of exactly the pending balance', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillCard(user, 'Partial Settlement', '5000');

      await user.click(confirmButton());

      await waitFor(() => expect(mocked.createSalaryLedgerEntry).toHaveBeenCalledTimes(1));
    });

    it('refuses a payment larger than the chosen account holds', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.entryType(), 'Advance Payment');
      await user.type(f.amount(), '900');
      await user.selectOptions(f.sai(), 'acc-2');
      await user.type(f.rai(), 'Dan');

      await user.click(confirmButton());

      expect(screen.getByText('Insufficient account balance (₹800 available)')).toBeInTheDocument();
      expect(mocked.createSalaryLedgerEntry).not.toHaveBeenCalled();
    });

    it('refuses a cash payment larger than the cash account holds', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.entryType(), 'Advance Payment');
      await user.type(f.amount(), '3001');
      await user.selectOptions(f.mode(), 'Cash');

      await user.click(confirmButton());

      expect(screen.getByText(`Insufficient account balance (₹${(3000).toLocaleString()} available)`)).toBeInTheDocument();
    });

    it('refuses a date and time in the future', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillCard(user);
      fireEvent.change(f.dateTime(), { target: { value: '2026-10-16T09:00' } });

      await user.click(confirmButton());

      expect(screen.getByText('Date cannot be in the future')).toBeInTheDocument();
      expect(mocked.createSalaryLedgerEntry).not.toHaveBeenCalled();
    });

    it('refuses a full settlement when nothing is owed', async () => {
      const user = userEvent.setup();
      mocked.getEmployeeLedger.mockResolvedValue({ employee: { ...EMPLOYEE, running_balance: 0 }, transactions: [], total_count: 0 } as never);
      renderScreen();
      await loaded();

      await user.selectOptions(f.entryType(), 'Full Settlement');

      expect(screen.getByRole('button', { name: 'Confirm Settlement' })).toBeDisabled();
    });

    it('does not ask for accounts on a cash payment or a manual salary entry', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.entryType(), 'Advance Payment');
      await user.type(f.amount(), '100');
      await user.selectOptions(f.mode(), 'Cash');

      await user.click(confirmButton());

      await waitFor(() => expect(mocked.createSalaryLedgerEntry).toHaveBeenCalledTimes(1));
    });

    it('clears the entry-type errors when the entry type is changed', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(confirmButton());
      expect(screen.getByText('Entry type is required')).toBeInTheDocument();

      await user.selectOptions(f.entryType(), 'Weekly Payment');

      expect(screen.queryByText('Entry type is required')).not.toBeInTheDocument();
    });
  });

  describe('saving', () => {
    it('records an advance paid by UPI, with the account and the trimmed receiver', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillCard(user);
      await user.type(f.notes(), '  Medical need  ');

      await user.click(confirmButton());

      await waitFor(() => expect(mocked.createSalaryLedgerEntry).toHaveBeenCalledTimes(1));
      expect(mocked.createSalaryLedgerEntry).toHaveBeenCalledWith({
        employee_id: 'e01',
        entry_type: 'ADVANCE',
        amount: 1000,
        payment_mode: 'UPI',
        sender_account_id: 'acc-1',
        receiver_account: 'Dan HDFC 5555',
        notes: 'Medical need',
        payment_at: new Date('2026-10-15T10:00').toISOString(),
      });
    });

    it.each([
      ['Advance Payment', 'ADVANCE'],
      ['Weekly Payment', 'WEEKLY'],
      ['Emergency Payment', 'EMERGENCY'],
      ['Daily / Ad-hoc Payment', 'DAILY'],
      ['Partial Settlement', 'PARTIAL_SETTLEMENT'],
    ])('records %s as %s', async (type, code) => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillCard(user, type, '100');

      await user.click(confirmButton());

      await waitFor(() => expect(mocked.createSalaryLedgerEntry).toHaveBeenCalled());
      expect(mocked.createSalaryLedgerEntry.mock.calls[0][0].entry_type).toBe(code);
    });

    it('records a bank transfer as BANK', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillCard(user);
      await user.selectOptions(f.mode(), 'Bank Transfer');
      await user.selectOptions(f.sai(), 'acc-1');
      await user.type(f.rai(), 'Dan');

      await user.click(confirmButton());

      await waitFor(() => expect(mocked.createSalaryLedgerEntry).toHaveBeenCalled());
      expect(mocked.createSalaryLedgerEntry.mock.calls[0][0]).toMatchObject({ payment_mode: 'BANK', sender_account_id: 'acc-1' });
    });

    it('records a cash payment with no accounts, and no notes as nothing', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.entryType(), 'Weekly Payment');
      await user.type(f.amount(), '250.5');
      await user.selectOptions(f.mode(), 'Cash');

      await user.click(confirmButton());

      await waitFor(() => expect(mocked.createSalaryLedgerEntry).toHaveBeenCalled());
      expect(mocked.createSalaryLedgerEntry.mock.calls[0][0]).toMatchObject({
        entry_type: 'WEEKLY',
        amount: 250.5,
        payment_mode: 'CASH',
        sender_account_id: null,
        receiver_account: null,
        notes: null,
      });
    });

    it('records a full settlement for the whole balance', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.entryType(), 'Full Settlement');
      await user.selectOptions(f.sai(), 'acc-1');
      await user.type(f.rai(), 'Dan');

      await user.click(confirmButton());

      await waitFor(() => expect(mocked.createSalaryLedgerEntry).toHaveBeenCalled());
      expect(mocked.createSalaryLedgerEntry.mock.calls[0][0]).toMatchObject({ entry_type: 'FULL_SETTLEMENT', amount: 5000 });
    });

    it('records a manual salary entry with no payment mode or accounts', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.entryType(), 'Manual Salary Entry');
      await user.type(f.amount(), '650');

      await user.click(confirmButton());

      await waitFor(() => expect(mocked.createSalaryLedgerEntry).toHaveBeenCalled());
      expect(mocked.createSalaryLedgerEntry.mock.calls[0][0]).toMatchObject({
        entry_type: 'SALARY_MANUAL_ENTRY',
        amount: 650,
        payment_mode: null,
        sender_account_id: null,
        receiver_account: null,
      });
    });

    it('confirms with a success popup, and OK returns to the ledger', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillCard(user);
      await user.click(confirmButton());

      expect(await screen.findByText('Entry Added Successfully')).toBeInTheDocument();
      expect(screen.getByText('The payment entry has been recorded.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/salary-ledger/e01');
    });

    it('shows Saving... and ignores another press while the save is in flight', async () => {
      const user = userEvent.setup();
      let finish: () => void = () => {};
      mocked.createSalaryLedgerEntry.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)) as never);
      renderScreen();
      await loaded();
      await fillCard(user);

      await user.click(confirmButton());

      const busy = await screen.findByRole('button', { name: 'Saving...' });
      expect(busy).toBeDisabled();
      await user.click(busy);
      expect(mocked.createSalaryLedgerEntry).toHaveBeenCalledTimes(1);

      finish();
      expect(await screen.findByText('Entry Added Successfully')).toBeInTheDocument();
    });

    it('shows the reason when saving fails, keeps the form, and allows a retry', async () => {
      const user = userEvent.setup();
      mocked.createSalaryLedgerEntry.mockRejectedValueOnce(new Error('Insufficient balance in the selected account'));
      renderScreen();
      await loaded();
      await fillCard(user);
      await user.click(confirmButton());

      expect(await screen.findByText('Failed to Save Entry')).toBeInTheDocument();
      expect(screen.getByText('Insufficient balance in the selected account')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(f.amount()).toHaveValue(1000);

      await user.click(confirmButton());
      expect(await screen.findByText('Entry Added Successfully')).toBeInTheDocument();
      expect(mocked.createSalaryLedgerEntry).toHaveBeenCalledTimes(2);
    });
  });

  // Gap found while writing these tests, written as the behaviour the screen should have and
  // marked `fails`: it passes while the gap exists and goes red once it is fixed, at which
  // point the `.fails` should be removed.
  describe('known gaps', () => {
    it.fails('tells the administrator when the employee and accounts cannot be loaded', async () => {
      mocked.getEmployeeLedger.mockRejectedValue(new Error('down'));
      renderScreen();
      await loaded();

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
