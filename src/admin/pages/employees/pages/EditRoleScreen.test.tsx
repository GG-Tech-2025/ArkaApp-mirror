import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { EditRoleScreen } from './EditRoleScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({
  getRoleById: vi.fn(),
  updateRole: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const DAILY_ROLE = {
  id: 'r2',
  name: 'Mason',
  category: 'DAILY',
  salary_value: 650,
  minimum_requirement: null,
  no_loading_salary: false,
  active: true,
};
const FIXED_ROLE = { ...DAILY_ROLE, id: 'r3', name: 'Supervisor', category: 'FIXED', salary_value: 25000, no_loading_salary: true };
const LOADMEN_ROLE = { ...DAILY_ROLE, id: 'r1', name: 'Loader', category: 'LOADMEN', salary_value: 12.5, minimum_requirement: 40 };

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen(id = 'r2') {
  return render(
    <MemoryRouter initialEntries={[`/admin/employees/role-setup/${id}/edit`]}>
      <Routes>
        <Route path="/admin/employees/role-setup/:id/edit" element={<EditRoleScreen />} />
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
const updateButton = () => screen.getByRole('button', { name: /^(Update Role|Updating\.\.\.)$/ });

async function loaded(name = 'Mason') {
  await waitFor(() => expect(f.name()).toHaveValue(name));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getRoleById.mockResolvedValue(DAILY_ROLE as never);
  mocked.updateRole.mockResolvedValue(undefined as never);
});

describe('EditRoleScreen', () => {
  describe('loading the role', () => {
    it('shows a loading message until the role arrives', async () => {
      mocked.getRoleById.mockReturnValue(new Promise(() => {}));
      renderScreen();

      expect(await screen.findByText('Loading role details...')).toBeInTheDocument();
    });

    it('asks for the role named in the address', async () => {
      renderScreen('r2');
      await loaded();

      expect(mocked.getRoleById).toHaveBeenCalledWith('r2');
    });

    it('shows the heading with the role id', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByRole('heading', { name: 'Edit Role' })).toBeInTheDocument();
      expect(screen.getByText('Update role details — r2')).toBeInTheDocument();
    });

    it('fills a daily-wage role', async () => {
      renderScreen();
      await loaded();

      expect(f.category()).toHaveValue('Daily Wages');
      expect(f.perDay()).toHaveValue(650);
      expect(f.noLoading()).not.toBeChecked();
    });

    it('fills a fixed-salary role that earns no loading wages', async () => {
      mocked.getRoleById.mockResolvedValue(FIXED_ROLE as never);
      renderScreen('r3');
      await loaded('Supervisor');

      expect(f.category()).toHaveValue('Fixed Salary');
      expect(f.monthly()).toHaveValue(25000);
      expect(f.noLoading()).toBeChecked();
    });

    it('fills a loadmen role with its minimum requirement', async () => {
      mocked.getRoleById.mockResolvedValue(LOADMEN_ROLE as never);
      renderScreen('r1');
      await loaded('Loader');

      expect(f.category()).toHaveValue('Loadmen');
      expect(f.rate()).toHaveValue(12.5);
      expect(f.minLoad()).toHaveValue(40);
    });

    it('tells the administrator when the role cannot be loaded', async () => {
      mocked.getRoleById.mockRejectedValue(new Error('down'));
      renderScreen();

      expect(await screen.findByText('Update Failed')).toBeInTheDocument();
      expect(screen.getByText('Failed to load role details. Please refresh and try again.')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it.each(['Back to Role & Salary Setup', 'Cancel'])('goes back to the role list from %s', async (name) => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: new RegExp(name) }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/role-setup');
    });
  });

  describe('changing the category', () => {
    it('asks for confirmation first, warning that salary fields will be cleared', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.selectOptions(f.category(), 'Fixed Salary');

      expect(screen.getByText('Confirm Category Change')).toBeInTheDocument();
      expect(screen.getByText(/Changing the category will clear the current salary fields/)).toBeInTheDocument();
      expect(f.category()).toHaveValue('Daily Wages');
    });

    it('keeps the category and the figures when the answer is No', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.category(), 'Fixed Salary');

      await user.click(screen.getByRole('button', { name: 'No, Cancel' }));

      expect(screen.queryByText('Confirm Category Change')).not.toBeInTheDocument();
      expect(f.category()).toHaveValue('Daily Wages');
      expect(f.perDay()).toHaveValue(650);
    });

    it('switches category and clears the figures when the answer is Yes', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.category(), 'Fixed Salary');

      await user.click(screen.getByRole('button', { name: 'Yes, Continue' }));

      expect(f.category()).toHaveValue('Fixed Salary');
      expect(f.monthly()).toHaveValue(null);
      expect(screen.queryByLabelText(/^Per Day Wage/)).not.toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('reports a cleared name and salary, and does not contact the server', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.clear(f.name());
      await user.clear(f.perDay());

      await user.click(updateButton());

      expect(screen.getByText('Role name is required')).toBeInTheDocument();
      expect(screen.getByText('Per day wage is required')).toBeInTheDocument();
      expect(mocked.updateRole).not.toHaveBeenCalled();
    });

    it('only accepts letters and spaces in the name', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.clear(f.name());
      await user.type(f.name(), 'Mas0n!');

      expect(f.name()).toHaveValue('Masn');
    });

    it('rejects a per-day wage of more than five digits', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.clear(f.perDay());
      await user.type(f.perDay(), '123456');

      await user.click(updateButton());

      expect(screen.getByText('Maximum 5 digits allowed')).toBeInTheDocument();
    });

    it('rejects a loadmen rate of zero', async () => {
      const user = userEvent.setup();
      mocked.getRoleById.mockResolvedValue(LOADMEN_ROLE as never);
      renderScreen('r1');
      await loaded('Loader');
      await user.clear(f.rate());
      await user.type(f.rate(), '0');

      await user.click(updateButton());

      expect(screen.getByText('Please enter a valid rate')).toBeInTheDocument();
      expect(mocked.updateRole).not.toHaveBeenCalled();
    });
  });

  describe('saving the changes', () => {
    it('saves a changed wage against the right role', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.clear(f.perDay());
      await user.type(f.perDay(), '700');

      await user.click(updateButton());

      await waitFor(() => expect(mocked.updateRole).toHaveBeenCalledTimes(1));
      expect(mocked.updateRole).toHaveBeenCalledWith('r2', {
        name: 'Mason',
        category: 'DAILY',
        salary_value: 700,
        minimum_requirement: null,
        no_loading_salary: false,
      });
    });

    it('saves the no-loading-wages option', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(f.noLoading());

      await user.click(updateButton());

      await waitFor(() => expect(mocked.updateRole).toHaveBeenCalled());
      expect(mocked.updateRole.mock.calls[0][1]).toMatchObject({ no_loading_salary: true });
    });

    it('saves a loadmen role\'s minimum requirement, and clears it when emptied', async () => {
      const user = userEvent.setup();
      mocked.getRoleById.mockResolvedValue(LOADMEN_ROLE as never);
      renderScreen('r1');
      await loaded('Loader');
      await user.clear(f.minLoad());

      await user.click(updateButton());

      await waitFor(() => expect(mocked.updateRole).toHaveBeenCalled());
      expect(mocked.updateRole.mock.calls[0][1]).toMatchObject({ category: 'LOADMEN', salary_value: 12.5, minimum_requirement: null });
    });

    it('saves a category change once it has been confirmed and a new figure given', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.category(), 'Fixed Salary');
      await user.click(screen.getByRole('button', { name: 'Yes, Continue' }));
      await user.type(f.monthly(), '30000');

      await user.click(updateButton());

      await waitFor(() => expect(mocked.updateRole).toHaveBeenCalled());
      expect(mocked.updateRole.mock.calls[0][1]).toMatchObject({ category: 'FIXED', salary_value: 30000 });
    });

    it('confirms with a success popup, and OK returns to the role list', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(updateButton());

      expect(await screen.findByText('Role Updated Successfully')).toBeInTheDocument();
      expect(screen.getByText('The role has been updated successfully.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/role-setup');
    });

    it('shows Updating... and ignores another press while the save is in flight', async () => {
      const user = userEvent.setup();
      let finish: () => void = () => {};
      mocked.updateRole.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)) as never);
      renderScreen();
      await loaded();

      await user.click(updateButton());

      const busy = await screen.findByRole('button', { name: 'Updating...' });
      expect(busy).toBeDisabled();
      await user.click(busy);
      expect(mocked.updateRole).toHaveBeenCalledTimes(1);

      finish();
      expect(await screen.findByText('Role Updated Successfully')).toBeInTheDocument();
    });
  });

  describe('when saving fails', () => {
    it('shows the reason, keeps the form, and allows a retry', async () => {
      const user = userEvent.setup();
      mocked.updateRole.mockRejectedValueOnce(new Error('A role with that name already exists'));
      renderScreen();
      await loaded();
      await user.click(updateButton());

      expect(await screen.findByText('Update Failed')).toBeInTheDocument();
      expect(screen.getByText('A role with that name already exists')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(f.name()).toHaveValue('Mason');

      await user.click(updateButton());
      expect(await screen.findByText('Role Updated Successfully')).toBeInTheDocument();
      expect(mocked.updateRole).toHaveBeenCalledTimes(2);
    });
  });
});
