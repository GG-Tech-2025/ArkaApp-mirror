import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { SalaryLedgerScreen } from './SalaryLedgerScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({ searchEmployees: vi.fn() }));

const mocked = vi.mocked(middleware);

const emp = (id: string, name: string, category: string, balance: number, role = 'Role') => ({
  id,
  name,
  phone: '9000000000',
  role_name: role,
  category,
  running_balance: balance,
  active: true,
});

const ACTIVE = [
  emp('e01', 'Daily Dan', 'DAILY', 12500, 'Mason'),
  emp('e02', 'Fixed Fiona', 'FIXED', 0, 'Supervisor'),
  emp('e03', 'Loader Lee', 'LOADMEN', -750, 'Loader'),
];
const INACTIVE = [emp('e09', 'Gone Gary', 'DAILY', 300, 'Mason')];

const page = (data: unknown[], total = data.length, hasMore = false) => ({ data, total, hasMore });

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin/employees/salary-ledger']}>
      <Routes>
        <Route path="/admin/employees/salary-ledger" element={<SalaryLedgerScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const cardFor = (name: string) => screen.getByText(name).closest('.rounded-lg') as HTMLElement;
const waitForSearchDelay = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 1100))));

async function loaded() {
  await waitFor(() => expect(screen.getByText('Daily Dan')).toBeInTheDocument());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.searchEmployees.mockImplementation(async (_term: string, _page: number, active?: boolean) =>
    page(active === false ? INACTIVE : ACTIVE) as never,
  );
});

describe('SalaryLedgerScreen', () => {
  describe('layout', () => {
    it('shows the heading, the search box and the Calculate Salary action', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByRole('heading', { name: 'Employee Salary Ledger' })).toBeInTheDocument();
      expect(screen.getByText('View and manage employee salary records')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search by name, or phone number...')).toHaveValue('');
      expect(screen.getByRole('button', { name: /Calculate Salary/ })).toBeInTheDocument();
    });

    it('asks for the first page of active employees when it opens', async () => {
      renderScreen();
      await loaded();

      expect(mocked.searchEmployees).toHaveBeenCalledWith('', 0, true);
    });

    it('shows a loading message until the employees arrive', () => {
      mocked.searchEmployees.mockReturnValue(new Promise(() => {}));
      renderScreen();

      expect(screen.getByText('Loading employees...')).toBeInTheDocument();
    });
  });

  describe('the list', () => {
    it('shows each employee\'s name, id, role and category', async () => {
      renderScreen();
      await loaded();

      expect(within(cardFor('Daily Dan')).getByText('e01')).toBeInTheDocument();
      expect(within(cardFor('Daily Dan')).getByText('Mason')).toBeInTheDocument();
      expect(within(cardFor('Daily Dan')).getByText('Daily Wages')).toBeInTheDocument();
      expect(within(cardFor('Fixed Fiona')).getByText('Fixed Salary')).toBeInTheDocument();
      expect(within(cardFor('Loader Lee')).getByText('Loadmen')).toBeInTheDocument();
    });

    it('shows each running balance in rupees', async () => {
      renderScreen();
      await loaded();

      expect(within(cardFor('Daily Dan')).getByText('₹12,500')).toBeInTheDocument();
      expect(within(cardFor('Fixed Fiona')).getByText('₹0')).toBeInTheDocument();
      expect(within(cardFor('Loader Lee')).getByText('₹-750')).toBeInTheDocument();
    });

    it('shows inactive employees under the Inactive tab', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Inactive' }));

      expect(await screen.findByText('Gone Gary')).toBeInTheDocument();
      expect(mocked.searchEmployees).toHaveBeenLastCalledWith('', 0, false);
      expect(screen.queryByText('Daily Dan')).not.toBeInTheDocument();
    });

    it('says when there are no active or inactive employees', async () => {
      const user = userEvent.setup();
      mocked.searchEmployees.mockResolvedValue(page([]) as never);
      renderScreen();
      expect(await screen.findByText('No active employees found')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Inactive' }));

      expect(await screen.findByText('No inactive employees found')).toBeInTheDocument();
    });

    it('adds the next page on Load More, then hides it', async () => {
      const user = userEvent.setup();
      mocked.searchEmployees.mockResolvedValue(page(ACTIVE, 4, true) as never);
      renderScreen();
      await loaded();
      mocked.searchEmployees.mockResolvedValue(page([emp('e04', 'Fourth One', 'DAILY', 10)], 4, false) as never);

      await user.click(screen.getByRole('button', { name: 'Load More' }));

      expect(await screen.findByText('Fourth One')).toBeInTheDocument();
      expect(mocked.searchEmployees).toHaveBeenLastCalledWith('', 1, true);
      expect(screen.getByText('Daily Dan')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
    });

    it('does not show Load More when everything fits on one page', async () => {
      renderScreen();
      await loaded();

      expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
    });
  });

  describe('searching', () => {
    it('searches a second after the last keystroke', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      mocked.searchEmployees.mockClear();

      await user.type(screen.getByPlaceholderText('Search by name, or phone number...'), 'dan');
      expect(mocked.searchEmployees).not.toHaveBeenCalled();
      await waitForSearchDelay();

      expect(mocked.searchEmployees).toHaveBeenCalledWith('dan', 0, true);
    });

    it('searches the inactive list when that tab is open', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(screen.getByRole('button', { name: 'Inactive' }));
      await screen.findByText('Gone Gary');
      mocked.searchEmployees.mockClear();

      await user.type(screen.getByPlaceholderText('Search by name, or phone number...'), 'gary');
      await waitForSearchDelay();

      expect(mocked.searchEmployees).toHaveBeenCalledWith('gary', 0, false);
    });

    it('clears the search when the tab is changed', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.type(screen.getByPlaceholderText('Search by name, or phone number...'), 'dan');

      await user.click(screen.getByRole('button', { name: 'Inactive' }));

      expect(screen.getByPlaceholderText('Search by name, or phone number...')).toHaveValue('');
    });
  });

  describe('navigation', () => {
    it('opens the chosen employee\'s ledger', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(within(cardFor('Fixed Fiona')).getByRole('button', { name: /Open Ledger/ }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/salary-ledger/e02');
    });

    it('opens the salary calculation', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: /Calculate Salary/ }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/salary-ledger/calculate');
    });

    it('goes back to the admin dashboard', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: /Back to Home/ }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/home');
    });
  });

  // Gap found while writing these tests, written as the behaviour the screen should have and
  // marked `fails`: it passes while the gap exists and goes red once it is fixed, at which
  // point the `.fails` should be removed.
  describe('known gaps', () => {
    it.fails('tells the administrator when the employees cannot be loaded, instead of saying there are none', async () => {
      mocked.searchEmployees.mockRejectedValue(new Error('down'));
      renderScreen();
      await waitFor(() => expect(mocked.searchEmployees).toHaveBeenCalled());

      expect(screen.queryByText('No active employees found')).not.toBeInTheDocument();
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });
  });
});
