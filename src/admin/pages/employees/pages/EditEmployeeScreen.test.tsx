import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { EditEmployeeScreen } from './EditEmployeeScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({
  getRoles: vi.fn(),
  getEmployeeById: vi.fn(),
  updateEmployee: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const ROLES = [
  { id: 'role-loader', name: 'Loader', category: 'LOADMEN', no_loading_salary: false },
  { id: 'role-mason', name: 'Mason', category: 'DAILY', no_loading_salary: false },
  { id: 'role-super', name: 'Supervisor', category: 'FIXED', no_loading_salary: true },
];

const EMPLOYEE = {
  id: 'emp-1',
  name: 'Ravi Kumar',
  phone: '9000000011',
  alternate_phone: '8000000022',
  blood_group: 'O+',
  aadhar: '123456789012',
  permanent_address: '12 Main Road, Salem',
  local_address: '5 Lake View, Erode',
  role_id: 'role-mason',
  emergency_contact_name: 'Anita Rao',
  emergency_contact_phone: '7000000033',
  deduction_amount: null,
  active: true,
};

function Destination() {
  const { pathname, state } = useLocation();
  return (
    <div>
      <span data-testid="path">{pathname}</span>
      <span data-testid="from">{(state as { from?: string } | null)?.from ?? ''}</span>
    </div>
  );
}

function renderScreen(id = 'emp-1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/employees/${id}/edit`]}>
      <Routes>
        <Route path="/admin/employees/:id/edit" element={<EditEmployeeScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const f = {
  name: () => screen.getByLabelText(/^Employee Name/),
  phone: () => screen.getByLabelText(/^Phone Number/),
  altPhone: () => screen.getByLabelText(/^Alternate Phone/),
  blood: () => screen.getByLabelText(/^Blood Group/),
  aadhar: () => screen.getByLabelText(/^Aadhar Number/),
  permanent: () => screen.getByLabelText(/^Permanent Address/),
  local: () => screen.getByLabelText(/^Local Address/),
  role: () => screen.getByLabelText(/^Employee Role/),
  category: () => screen.getByLabelText('Category'),
  deduction: () => screen.getByLabelText(/^Deduction Amount/),
  emName: () => screen.getByLabelText(/^Emergency Contact Name/),
  emPhone: () => screen.getByLabelText(/^Emergency Contact Number/),
};
const saveButton = () => screen.getByRole('button', { name: /^(Save Changes|Saving\.\.\.)$/ });

async function loaded() {
  await waitFor(() => expect(f.name()).toHaveValue('Ravi Kumar'));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getRoles.mockResolvedValue(ROLES as never);
  mocked.getEmployeeById.mockResolvedValue(EMPLOYEE as never);
  mocked.updateEmployee.mockResolvedValue(undefined);
});

describe('EditEmployeeScreen', () => {
  describe('loading the employee', () => {
    it('shows a loading message until the employee arrives', async () => {
      mocked.getEmployeeById.mockReturnValue(new Promise(() => {}));
      renderScreen();

      return screen.findByText('Loading employee details...').then(() => {
        expect(screen.queryByRole('heading', { name: 'Edit Employee' })).not.toBeInTheDocument();
      });
    });

    it('asks for the employee named in the address', async () => {
      renderScreen('emp-1');
      await loaded();

      expect(mocked.getEmployeeById).toHaveBeenCalledWith('emp-1');
    });

    it('shows the heading with the employee id', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByRole('heading', { name: 'Edit Employee' })).toBeInTheDocument();
      expect(screen.getByText('Update employee details — emp-1')).toBeInTheDocument();
    });

    it('fills every field from the employee\'s record', async () => {
      renderScreen();
      await loaded();

      expect(f.phone()).toHaveValue('9000000011');
      expect(f.altPhone()).toHaveValue('8000000022');
      expect(f.blood()).toHaveValue('O+');
      expect(f.aadhar()).toHaveValue('123456789012');
      expect(f.permanent()).toHaveValue('12 Main Road, Salem');
      expect(f.local()).toHaveValue('5 Lake View, Erode');
      expect(f.role()).toHaveValue('role-mason');
      expect(f.emName()).toHaveValue('Anita Rao');
      expect(f.emPhone()).toHaveValue('7000000033');
    });

    it('fills the category from the employee\'s role', async () => {
      renderScreen();
      await loaded();

      expect(f.category()).toHaveValue('Daily Wages');
      expect(f.category()).toBeDisabled();
    });

    it('shows the deduction amount for a fixed-salary employee', async () => {
      mocked.getEmployeeById.mockResolvedValue({ ...EMPLOYEE, role_id: 'role-super', deduction_amount: 250 } as never);
      renderScreen();
      await loaded();

      await waitFor(() => expect(f.deduction()).toHaveValue(250));
      expect(f.category()).toHaveValue('Fixed Salary');
    });

    it('leaves blank the optional details an employee does not have', async () => {
      mocked.getEmployeeById.mockResolvedValue({
        ...EMPLOYEE,
        alternate_phone: null,
        local_address: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
      } as never);
      renderScreen();
      await loaded();

      expect(f.altPhone()).toHaveValue('');
      expect(f.local()).toHaveValue('');
      expect(f.emName()).toHaveValue('');
      expect(f.emPhone()).toHaveValue('');
    });

    it('tells the administrator when the employee cannot be loaded', async () => {
      mocked.getEmployeeById.mockRejectedValue(new Error('down'));
      renderScreen();

      expect(await screen.findByText('Update Failed')).toBeInTheDocument();
      expect(screen.getByText('Failed to load employee details. Please refresh and try again.')).toBeInTheDocument();
    });

    it('tells the administrator when the roles cannot be loaded', async () => {
      mocked.getRoles.mockRejectedValue(new Error('down'));
      renderScreen();

      expect(await screen.findByText('Update Failed')).toBeInTheDocument();
      expect(screen.getByText('Failed to load roles. Please refresh and try again.')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it.each(['Back to Employees', 'Cancel'])('goes back to the employee list from %s', async (name) => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: new RegExp(name) }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees');
    });

    it('offers to create a new role, and remembers it is to come back to this employee', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Create New Role' }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/role-setup/create');
      expect(screen.getByTestId('from').textContent).toBe('/admin/employees/emp-1/edit');
    });
  });

  describe('typing restrictions', () => {
    it('only accepts letters in names, and digits in phone numbers and the Aadhar number', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.clear(f.name());
      await user.type(f.name(), 'R4vi');
      await user.clear(f.phone());
      await user.type(f.phone(), '9a0000000011999');
      // the letter is ignored, and only the first ten digits fit
      await user.clear(f.aadhar());
      await user.type(f.aadhar(), '9876-5432 10987654');

      expect(f.name()).toHaveValue('Rvi');
      expect(f.phone()).toHaveValue('9000000001');
      expect(f.aadhar()).toHaveValue('987654321098');
    });
  });

  describe('validation', () => {
    it('reports required details that have been cleared, and does not contact the server', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.clear(f.name());
      await user.clear(f.phone());
      await user.clear(f.aadhar());
      await user.clear(f.permanent());
      await user.selectOptions(f.blood(), '');
      await user.selectOptions(f.role(), '');

      await user.click(saveButton());

      for (const message of [
        'Employee name is required',
        'Phone number is required',
        'Blood group is required',
        'Aadhar number is required',
        'Permanent address is required',
        'Employee role is required',
      ]) {
        expect(screen.getByText(message)).toBeInTheDocument();
      }
      expect(mocked.updateEmployee).not.toHaveBeenCalled();
    });

    it.each([
      ['phone number', () => f.phone(), '12345', 'Phone number must be 10 digits'],
      ['alternate phone', () => f.altPhone(), '12345', 'Alternate phone must be 10 digits'],
      ['Aadhar number', () => f.aadhar(), '1234', 'Aadhar number must be 12 digits'],
      ['emergency contact number', () => f.emPhone(), '12345', 'Emergency contact number must be 10 digits'],
    ])('rejects a %s that is too short', async (_label, field, value, message) => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.clear(field());
      await user.type(field(), value);

      await user.click(saveButton());

      expect(screen.getByText(message)).toBeInTheDocument();
      expect(mocked.updateEmployee).not.toHaveBeenCalled();
    });

    it('requires a deduction amount above zero when the role is fixed salary', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.role(), 'Supervisor');

      await user.click(saveButton());

      expect(screen.getByText('Deduction amount is required for fixed salary employees')).toBeInTheDocument();
      expect(mocked.updateEmployee).not.toHaveBeenCalled();
    });
  });

  describe('saving the changes', () => {
    it('saves a changed name against the right employee, keeping everything else', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.clear(f.name());
      await user.type(f.name(), 'Ravi Shankar');

      await user.click(saveButton());

      await waitFor(() => expect(mocked.updateEmployee).toHaveBeenCalledTimes(1));
      expect(mocked.updateEmployee).toHaveBeenCalledWith('emp-1', {
        name: 'Ravi Shankar',
        phone: '9000000011',
        alternate_phone: '8000000022',
        blood_group: 'O+',
        aadhar_number: '123456789012',
        permanent_address: '12 Main Road, Salem',
        local_address: '5 Lake View, Erode',
        role_id: 'role-mason',
        emergency_contact_name: 'Anita Rao',
        emergency_contact_phone: '7000000033',
        deduction_amount: null,
      });
    });

    it('saves the employee with a changed role and a deduction amount', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(f.role(), 'Supervisor');
      await user.type(f.deduction(), '300');

      await user.click(saveButton());

      await waitFor(() => expect(mocked.updateEmployee).toHaveBeenCalled());
      expect(mocked.updateEmployee.mock.calls[0][1]).toMatchObject({ role_id: 'role-super', deduction_amount: 300 });
    });

    it('saves cleared optional details as nothing', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.clear(f.altPhone());
      await user.clear(f.local());
      await user.clear(f.emName());
      await user.clear(f.emPhone());

      await user.click(saveButton());

      await waitFor(() => expect(mocked.updateEmployee).toHaveBeenCalled());
      expect(mocked.updateEmployee.mock.calls[0][1]).toMatchObject({
        alternate_phone: null,
        local_address: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
      });
    });

    it('confirms with a success popup, and OK returns to the employee list', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(saveButton());

      expect(await screen.findByText('Employee Updated Successfully')).toBeInTheDocument();
      expect(screen.getByText('The employee details have been updated successfully.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees');
    });

    it('shows Saving... and ignores another press while the save is in flight', async () => {
      const user = userEvent.setup();
      let finish: () => void = () => {};
      mocked.updateEmployee.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      renderScreen();
      await loaded();

      await user.click(saveButton());

      const busy = await screen.findByRole('button', { name: 'Saving...' });
      expect(busy).toBeDisabled();
      await user.click(busy);
      expect(mocked.updateEmployee).toHaveBeenCalledTimes(1);

      finish();
      expect(await screen.findByText('Employee Updated Successfully')).toBeInTheDocument();
    });
  });

  describe('when saving fails', () => {
    it('shows the reason, keeps the form, and allows a retry', async () => {
      const user = userEvent.setup();
      mocked.updateEmployee.mockRejectedValueOnce(new Error('That phone number is already used'));
      renderScreen();
      await loaded();
      await user.clear(f.name());
      await user.type(f.name(), 'Changed Name');
      await user.click(saveButton());

      expect(await screen.findByText('Update Failed')).toBeInTheDocument();
      expect(screen.getByText('That phone number is already used')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(screen.queryByText('Update Failed')).not.toBeInTheDocument();
      expect(f.name()).toHaveValue('Changed Name');
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();

      await user.click(saveButton());
      expect(await screen.findByText('Employee Updated Successfully')).toBeInTheDocument();
      expect(mocked.updateEmployee).toHaveBeenCalledTimes(2);
    });
  });
});
