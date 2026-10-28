import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CreateRoleScreen } from './CreateRoleScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({ createRole: vi.fn() }));

const mocked = vi.mocked(middleware);

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen(from?: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/admin/employees/role-setup/create', state: from ? { from } : undefined }]}>
      <Routes>
        <Route path="/admin/employees/role-setup/create" element={<CreateRoleScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const f = {
  name: () => screen.getByLabelText(/^Role Name/),
  category: () => screen.getByLabelText(/^Employee Category/),
  perDay: () => screen.getByLabelText(/^Per Day Wage/),
  monthly: () => screen.getByLabelText(/^Monthly Salary/),
  rate: () => screen.getByLabelText(/^Rate Per Load/),
  minLoad: () => screen.getByLabelText(/^Minimum Load Requirement/),
  noLoading: () => screen.getByLabelText('No Loading / Unloading Wages'),
};
const createButton = () => screen.getByRole('button', { name: /^(Create Role|Creating\.\.\.)$/ });

type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.clearAllMocks();
  mocked.createRole.mockResolvedValue(undefined as never);
});

describe('CreateRoleScreen', () => {
  describe('layout', () => {
    it('shows the heading, the name and category fields, and no salary field yet', () => {
      renderScreen();

      expect(screen.getByRole('heading', { name: 'Create New Role' })).toBeInTheDocument();
      expect(screen.getByText('Define a new employee role with salary structure')).toBeInTheDocument();
      expect(f.name()).toHaveAttribute('placeholder', 'e.g., Machine Operator, Supervisor, Driver');
      expect(screen.getAllByRole('option', { name: /Select category|Daily Wages|Fixed Salary|Loadmen/ }).map((o) => o.textContent)).toEqual([
        'Select category',
        'Daily Wages',
        'Fixed Salary',
        'Loadmen (Order-Based Salary)',
      ]);
      expect(screen.queryByLabelText(/Per Day Wage|Monthly Salary|Rate Per Load/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText('No Loading / Unloading Wages')).not.toBeInTheDocument();
    });

    it('goes back to the role list from Back and from Cancel', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole('button', { name: /Back to Role & Salary Setup/ }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/role-setup');
    });

    it('returns to where it was opened from, such as the create-employee screen', async () => {
      const user = userEvent.setup();
      renderScreen('/admin/employees/create');

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/create');
    });
  });

  describe('fields for each category', () => {
    it('Daily Wages asks for a per-day wage and offers the no-loading-wages option', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.selectOptions(f.category(), 'Daily Wages');

      expect(f.perDay()).toBeInTheDocument();
      expect(f.noLoading()).toBeInTheDocument();
      expect(screen.queryByLabelText(/^Monthly Salary/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Rate Per Load/)).not.toBeInTheDocument();
    });

    it('Fixed Salary asks for a monthly salary and offers the no-loading-wages option', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.selectOptions(f.category(), 'Fixed Salary');

      expect(f.monthly()).toBeInTheDocument();
      expect(f.noLoading()).toBeInTheDocument();
      expect(screen.getByText(/Deductions for absent\/half days can be configured per employee basis/)).toBeInTheDocument();
    });

    it('Loadmen asks for a rate per load and an optional minimum, with no loading-wages option', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.selectOptions(f.category(), 'Loadmen');

      expect(f.rate()).toBeInTheDocument();
      expect(f.minLoad()).toBeInTheDocument();
      expect(screen.queryByLabelText('No Loading / Unloading Wages')).not.toBeInTheDocument();
    });

    it('clears the salary figures when the category is changed', async () => {
      const user = userEvent.setup();
      renderScreen();
      await user.selectOptions(f.category(), 'Daily Wages');
      await user.type(f.perDay(), '650');

      await user.selectOptions(f.category(), 'Fixed Salary');
      await user.selectOptions(f.category(), 'Daily Wages');

      expect(f.perDay()).toHaveValue(null);
    });

    it('clears the salary errors when the category is changed', async () => {
      const user = userEvent.setup();
      renderScreen();
      await user.selectOptions(f.category(), 'Daily Wages');
      await user.type(f.name(), 'Mason');
      await user.click(createButton());
      expect(screen.getByText('Per day wage is required')).toBeInTheDocument();

      await user.selectOptions(f.category(), 'Fixed Salary');

      expect(screen.queryByText('Per day wage is required')).not.toBeInTheDocument();
    });
  });

  describe('typing restrictions', () => {
    it('only accepts letters and spaces in the role name', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.type(f.name(), 'Machine 2 Op@erator');

      expect(f.name()).toHaveValue('Machine  Operator');
    });

    it('never accepts a decimal per-day wage', async () => {
      const user = userEvent.setup();
      renderScreen();
      await user.selectOptions(f.category(), 'Daily Wages');

      await user.type(f.perDay(), '65.5');

      expect(f.perDay()).not.toHaveValue(65.5);
    });
  });

  describe('validation', () => {
    it('asks for a name and a category, and does not contact the server', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(createButton());

      expect(screen.getByText('Role name is required')).toBeInTheDocument();
      expect(screen.getByText('Category is required')).toBeInTheDocument();
      expect(mocked.createRole).not.toHaveBeenCalled();
    });

    it('treats a name of only spaces as missing', async () => {
      const user = userEvent.setup();
      renderScreen();
      await user.type(f.name(), '    ');
      await user.selectOptions(f.category(), 'Daily Wages');
      await user.type(f.perDay(), '500');

      await user.click(createButton());

      expect(screen.getByText('Role name is required')).toBeInTheDocument();
      expect(mocked.createRole).not.toHaveBeenCalled();
    });

    it.each([
      ['Daily Wages', 'Per day wage is required'],
      ['Fixed Salary', 'Monthly salary is required'],
      ['Loadmen', 'Rate per load is required'],
    ])('asks for the salary figure for %s', async (category, message) => {
      const user = userEvent.setup();
      renderScreen();
      await user.type(f.name(), 'Mason');
      await user.selectOptions(f.category(), category);

      await user.click(createButton());

      expect(screen.getByText(message)).toBeInTheDocument();
      expect(mocked.createRole).not.toHaveBeenCalled();
    });

    it('rejects a per-day wage of zero', async () => {
      const user = userEvent.setup();
      renderScreen();
      await user.type(f.name(), 'Mason');
      await user.selectOptions(f.category(), 'Daily Wages');
      await user.type(f.perDay(), '0');

      await user.click(createButton());

      expect(screen.getByText('Please enter a valid wage amount')).toBeInTheDocument();
    });

    it('rejects a per-day wage of more than five digits', async () => {
      const user = userEvent.setup();
      renderScreen();
      await user.type(f.name(), 'Mason');
      await user.selectOptions(f.category(), 'Daily Wages');
      await user.type(f.perDay(), '123456');

      await user.click(createButton());

      expect(screen.getByText('Maximum 5 digits allowed')).toBeInTheDocument();
    });

    it('rejects a monthly salary of more than six digits', async () => {
      const user = userEvent.setup();
      renderScreen();
      await user.type(f.name(), 'Supervisor');
      await user.selectOptions(f.category(), 'Fixed Salary');
      await user.type(f.monthly(), '1234567');

      await user.click(createButton());

      expect(screen.getByText('Maximum 6 digits allowed')).toBeInTheDocument();
    });

    it.each([
      ['Fixed Salary', () => f.monthly(), 'Please enter a valid salary amount'],
      ['Loadmen', () => f.rate(), 'Please enter a valid rate'],
    ])('rejects a %s figure of zero or less', async (category, field, message) => {
      const user = userEvent.setup();
      renderScreen();
      await user.type(f.name(), 'Someone');
      await user.selectOptions(f.category(), category);
      await user.type(field(), '-5');

      await user.click(createButton());

      expect(screen.getByText(message)).toBeInTheDocument();
      expect(mocked.createRole).not.toHaveBeenCalled();
    });
  });

  async function fill(user: User, category: string, name: string, field: () => HTMLElement, value: string) {
    await user.type(f.name(), name);
    await user.selectOptions(f.category(), category);
    await user.type(field(), value);
  }

  describe('creating the role', () => {
    it('saves a daily-wage role', async () => {
      const user = userEvent.setup();
      renderScreen();
      await fill(user, 'Daily Wages', '  Mason ', () => f.perDay(), '650');

      await user.click(createButton());

      await waitFor(() => expect(mocked.createRole).toHaveBeenCalledTimes(1));
      expect(mocked.createRole).toHaveBeenCalledWith({
        name: 'Mason',
        category: 'DAILY',
        salary_value: 650,
        minimum_requirement: null,
        no_loading_salary: false,
        active: true,
      });
    });

    it('saves a fixed-salary role that earns no loading wages', async () => {
      const user = userEvent.setup();
      renderScreen();
      await fill(user, 'Fixed Salary', 'Supervisor', () => f.monthly(), '25000.50');
      await user.click(f.noLoading());

      await user.click(createButton());

      await waitFor(() => expect(mocked.createRole).toHaveBeenCalled());
      expect(mocked.createRole.mock.calls[0][0]).toMatchObject({
        category: 'FIXED',
        salary_value: 25000.5,
        no_loading_salary: true,
      });
    });

    it('saves a loadmen role with its minimum requirement', async () => {
      const user = userEvent.setup();
      renderScreen();
      await fill(user, 'Loadmen', 'Loader', () => f.rate(), '12.5');
      await user.type(f.minLoad(), '40');

      await user.click(createButton());

      await waitFor(() => expect(mocked.createRole).toHaveBeenCalled());
      expect(mocked.createRole.mock.calls[0][0]).toMatchObject({
        category: 'LOADMEN',
        salary_value: 12.5,
        minimum_requirement: 40,
      });
    });

    it('saves a loadmen role with no minimum requirement as nothing', async () => {
      const user = userEvent.setup();
      renderScreen();
      await fill(user, 'Loadmen', 'Loader', () => f.rate(), '12.5');

      await user.click(createButton());

      await waitFor(() => expect(mocked.createRole).toHaveBeenCalled());
      expect(mocked.createRole.mock.calls[0][0].minimum_requirement).toBeNull();
    });

    it('confirms with a success popup, and OK returns to the role list', async () => {
      const user = userEvent.setup();
      renderScreen();
      await fill(user, 'Daily Wages', 'Mason', () => f.perDay(), '650');
      await user.click(createButton());

      expect(await screen.findByText('Role Created Successfully')).toBeInTheDocument();
      expect(screen.getByText('The role has been created successfully.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/role-setup');
    });

    it('goes back to the create-employee screen after saving, when that is where it was opened from', async () => {
      const user = userEvent.setup();
      renderScreen('/admin/employees/create');
      await fill(user, 'Daily Wages', 'Mason', () => f.perDay(), '650');
      await user.click(createButton());
      await user.click(await screen.findByRole('button', { name: 'OK' }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/create');
    });

    it('shows Creating... and ignores another press while the save is in flight', async () => {
      const user = userEvent.setup();
      let finish: () => void = () => {};
      mocked.createRole.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)) as never);
      renderScreen();
      await fill(user, 'Daily Wages', 'Mason', () => f.perDay(), '650');

      await user.click(createButton());

      const busy = await screen.findByRole('button', { name: 'Creating...' });
      expect(busy).toBeDisabled();
      await user.click(busy);
      expect(mocked.createRole).toHaveBeenCalledTimes(1);

      finish();
      expect(await screen.findByText('Role Created Successfully')).toBeInTheDocument();
    });
  });

  describe('when saving fails', () => {
    it('shows the reason, keeps the form, and allows a retry', async () => {
      const user = userEvent.setup();
      mocked.createRole.mockRejectedValueOnce(new Error('A role with that name already exists'));
      renderScreen();
      await fill(user, 'Daily Wages', 'Mason', () => f.perDay(), '650');
      await user.click(createButton());

      expect(await screen.findByText('Creation Failed')).toBeInTheDocument();
      expect(screen.getByText('A role with that name already exists')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(f.name()).toHaveValue('Mason');
      expect(f.perDay()).toHaveValue(650);

      await user.click(createButton());
      expect(await screen.findByText('Role Created Successfully')).toBeInTheDocument();
      expect(mocked.createRole).toHaveBeenCalledTimes(2);
    });
  });
});
