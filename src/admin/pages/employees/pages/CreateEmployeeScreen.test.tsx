import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CreateEmployeeScreen } from './CreateEmployeeScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({
  getRoles: vi.fn(),
  createEmployee: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const ROLES = [
  { id: 'role-loader', name: 'Loader', category: 'LOADMEN', no_loading_salary: false },
  { id: 'role-mason', name: 'Mason', category: 'DAILY', no_loading_salary: false },
  { id: 'role-super', name: 'Supervisor', category: 'FIXED', no_loading_salary: true },
];

function Destination() {
  const { pathname, state } = useLocation();
  return (
    <div>
      <span data-testid="path">{pathname}</span>
      <span data-testid="from">{(state as { from?: string } | null)?.from ?? ''}</span>
    </div>
  );
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin/employees/create']}>
      <Routes>
        <Route path="/admin/employees/create" element={<CreateEmployeeScreen />} />
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
const createButton = () => screen.getByRole('button', { name: /^(Create|Creating\.\.\.)$/ });

type User = ReturnType<typeof userEvent.setup>;

async function loaded() {
  await waitFor(() => expect(f.role()).toBeInTheDocument());
}

async function fillValid(user: User, roleName = 'Mason') {
  await user.type(f.name(), 'Ravi Kumar');
  await user.type(f.phone(), '9000000011');
  await user.selectOptions(f.blood(), 'O+');
  await user.type(f.aadhar(), '123456789012');
  await user.type(f.permanent(), '12 Main Road, Salem');
  await user.selectOptions(f.role(), roleName);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getRoles.mockResolvedValue(ROLES as never);
  mocked.createEmployee.mockResolvedValue({ employeeId: 'emp-new' });
});

describe('CreateEmployeeScreen', () => {
  describe('layout', () => {
    it('shows the heading and every field', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByRole('heading', { name: 'Add New Employee' })).toBeInTheDocument();
      expect(screen.getByText('Create a new employee record')).toBeInTheDocument();
      for (const field of Object.values(f)) {
        if (field !== f.deduction) expect(field()).toBeInTheDocument();
      }
      expect(createButton()).toBeEnabled();
    });

    it('marks the required fields and labels the optional ones', async () => {
      renderScreen();
      await loaded();

      for (const label of [/^Employee Name/, /^Phone Number/, /^Blood Group/, /^Aadhar Number/, /^Permanent Address/, /^Employee Role/]) {
        expect(screen.getByText(label).querySelector('.text-red-600')).toHaveTextContent('*');
      }
      for (const label of [/^Alternate Phone/, /^Local Address/, /^Emergency Contact Name/, /^Emergency Contact Number/]) {
        expect(screen.getByText(label)).toHaveTextContent('(Optional)');
      }
    });

    it('lists the active roles and the eight blood groups', async () => {
      renderScreen();
      await loaded();

      expect(within(f.role()).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Select role',
        'Loader',
        'Mason',
        'Supervisor',
      ]);
      expect(within(f.blood()).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Select blood group',
        'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
      ]);
    });

    it('shows a loading message while the roles load', () => {
      mocked.getRoles.mockReturnValue(new Promise(() => {}));
      renderScreen();

      expect(screen.getByText('Loading roles...')).toBeInTheDocument();
    });

    it('starts empty, with the category read-only', async () => {
      renderScreen();
      await loaded();

      expect(f.name()).toHaveValue('');
      expect(f.category()).toHaveValue('');
      expect(f.category()).toBeDisabled();
    });

    it('goes back to the employee list from Back to Employees and from Cancel', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: /Back to Employees/ }));
      expect(screen.getByTestId('path').textContent).toBe('/admin/employees');
    });

    it('goes back to the employee list from Cancel', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees');
    });

    it('offers to create a new role, and remembers where to come back to', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Create New Role' }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees/role-setup/create');
      expect(screen.getByTestId('from').textContent).toBe('/admin/employees/create');
    });
  });

  describe('typing restrictions', () => {
    it('only accepts letters and spaces in the name and the emergency contact name', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.type(f.name(), 'Ravi 42 K@umar');
      await user.type(f.emName(), 'Anita 7 R!ao');

      expect(f.name()).toHaveValue('Ravi  Kumar');
      expect(f.emName()).toHaveValue('Anita  Rao');
    });

    it('only accepts digits in the phone numbers, up to ten', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.type(f.phone(), '90a00-000011999');
      await user.type(f.altPhone(), '8x1234567890123');
      await user.type(f.emPhone(), '7 7777777777777');

      expect(f.phone()).toHaveValue('9000000011');
      expect(f.altPhone()).toHaveValue('8123456789');
      expect(f.emPhone()).toHaveValue('7777777777');
    });

    it('only accepts digits in the Aadhar number, up to twelve', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.type(f.aadhar(), '1234-5678 9012 3456');

      expect(f.aadhar()).toHaveValue('123456789012');
    });
  });

  describe('role and category', () => {
    it.each([
      ['Loader', 'Loadmen'],
      ['Mason', 'Daily Wages'],
      ['Supervisor', 'Fixed Salary'],
    ])('fills the category for %s as %s', async (role, category) => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.selectOptions(f.role(), role);

      expect(f.category()).toHaveValue(category);
    });

    it('asks for a deduction amount only for fixed-salary roles', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      expect(screen.queryByLabelText(/^Deduction Amount/)).not.toBeInTheDocument();

      await user.selectOptions(f.role(), 'Supervisor');
      expect(f.deduction()).toBeInTheDocument();

      await user.selectOptions(f.role(), 'Mason');
      expect(screen.queryByLabelText(/^Deduction Amount/)).not.toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('lists every missing required detail and does not contact the server', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(createButton());

      expect(screen.getByText('Employee name is required')).toBeInTheDocument();
      expect(screen.getByText('Phone number is required')).toBeInTheDocument();
      expect(screen.getByText('Blood group is required')).toBeInTheDocument();
      expect(screen.getByText('Aadhar number is required')).toBeInTheDocument();
      expect(screen.getByText('Permanent address is required')).toBeInTheDocument();
      expect(screen.getByText('Employee role is required')).toBeInTheDocument();
      expect(mocked.createEmployee).not.toHaveBeenCalled();
    });

    it('treats a name or address of only spaces as missing', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillValid(user);
      await user.clear(f.name());
      await user.type(f.name(), '   ');
      await user.clear(f.permanent());
      await user.type(f.permanent(), '   ');

      await user.click(createButton());

      expect(screen.getByText('Employee name is required')).toBeInTheDocument();
      expect(screen.getByText('Permanent address is required')).toBeInTheDocument();
      expect(mocked.createEmployee).not.toHaveBeenCalled();
    });

    it.each([
      ['phone number', () => f.phone(), '90000', 'Phone number must be 10 digits'],
      ['alternate phone', () => f.altPhone(), '12345', 'Alternate phone must be 10 digits'],
      ['Aadhar number', () => f.aadhar(), '12345678', 'Aadhar number must be 12 digits'],
      ['emergency contact number', () => f.emPhone(), '98765', 'Emergency contact number must be 10 digits'],
    ])('rejects a %s that is too short', async (_label, field, value, message) => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillValid(user);
      await user.clear(field());
      await user.type(field(), value);

      await user.click(createButton());

      expect(screen.getByText(message)).toBeInTheDocument();
      expect(mocked.createEmployee).not.toHaveBeenCalled();
    });

    it('requires a deduction amount above zero for a fixed-salary role', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillValid(user, 'Supervisor');

      await user.click(createButton());
      expect(screen.getByText('Deduction amount is required for fixed salary employees')).toBeInTheDocument();

      await user.type(f.deduction(), '0');
      await user.click(createButton());
      expect(screen.getByText('Deduction amount is required for fixed salary employees')).toBeInTheDocument();
      expect(mocked.createEmployee).not.toHaveBeenCalled();
    });

    it('does not ask for a deduction amount for other roles', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillValid(user, 'Loader');

      await user.click(createButton());

      await waitFor(() => expect(mocked.createEmployee).toHaveBeenCalledTimes(1));
    });
  });

  describe('creating the employee', () => {
    it('saves the entered details', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillValid(user);

      await user.click(createButton());

      await waitFor(() => expect(mocked.createEmployee).toHaveBeenCalledTimes(1));
      expect(mocked.createEmployee).toHaveBeenCalledWith({
        name: 'Ravi Kumar',
        phone: '9000000011',
        alternate_phone: null,
        blood_group: 'O+',
        aadhar_number: '123456789012',
        permanent_address: '12 Main Road, Salem',
        local_address: null,
        role_id: 'role-mason',
        emergency_contact_name: null,
        emergency_contact_phone: null,
        deduction_amount: null,
      });
    });

    it('saves the optional details when they are given', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillValid(user);
      await user.type(f.altPhone(), '8000000022');
      await user.type(f.local(), '5 Lake View, Erode');
      await user.type(f.emName(), 'Anita Rao');
      await user.type(f.emPhone(), '7000000033');

      await user.click(createButton());

      await waitFor(() => expect(mocked.createEmployee).toHaveBeenCalled());
      expect(mocked.createEmployee.mock.calls[0][0]).toMatchObject({
        alternate_phone: '8000000022',
        local_address: '5 Lake View, Erode',
        emergency_contact_name: 'Anita Rao',
        emergency_contact_phone: '7000000033',
      });
    });

    it('saves a deduction amount for a fixed-salary role', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillValid(user, 'Supervisor');
      await user.type(f.deduction(), '350.5');

      await user.click(createButton());

      await waitFor(() => expect(mocked.createEmployee).toHaveBeenCalled());
      expect(mocked.createEmployee.mock.calls[0][0]).toMatchObject({ role_id: 'role-super', deduction_amount: 350.5 });
    });

    it('confirms with a success popup, and OK returns to the employee list', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillValid(user);
      await user.click(createButton());

      expect(await screen.findByText('Employee Created Successfully')).toBeInTheDocument();
      expect(screen.getByText('The employee has been created successfully.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.getByTestId('path').textContent).toBe('/admin/employees');
    });

    it('shows Creating... and ignores another press while the save is in flight', async () => {
      const user = userEvent.setup();
      let finish: (value: { employeeId: string }) => void = () => {};
      mocked.createEmployee.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      renderScreen();
      await loaded();
      await fillValid(user);

      await user.click(createButton());

      const busy = await screen.findByRole('button', { name: 'Creating...' });
      expect(busy).toBeDisabled();
      await user.click(busy);
      expect(mocked.createEmployee).toHaveBeenCalledTimes(1);

      finish({ employeeId: 'emp-new' });
      expect(await screen.findByText('Employee Created Successfully')).toBeInTheDocument();
    });
  });

  describe('when something fails', () => {
    it('tells the administrator when the roles cannot be loaded', async () => {
      mocked.getRoles.mockRejectedValue(new Error('down'));
      renderScreen();

      expect(await screen.findByText('Creation Failed')).toBeInTheDocument();
      expect(screen.getByText('Failed to load roles. Please refresh and try again.')).toBeInTheDocument();
    });

    it('shows the reason in a popup when saving fails, and keeps the form filled in', async () => {
      const user = userEvent.setup();
      mocked.createEmployee.mockRejectedValueOnce(new Error('That phone number is already used'));
      renderScreen();
      await loaded();
      await fillValid(user);
      await user.click(createButton());

      expect(await screen.findByText('Creation Failed')).toBeInTheDocument();
      expect(screen.getByText('That phone number is already used')).toBeInTheDocument();
      expect(screen.queryByText('Employee Created Successfully')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(screen.queryByText('Creation Failed')).not.toBeInTheDocument();
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
      expect(f.name()).toHaveValue('Ravi Kumar');
      expect(f.phone()).toHaveValue('9000000011');
      expect(createButton()).toBeEnabled();
    });

    it('succeeds on a second attempt', async () => {
      const user = userEvent.setup();
      mocked.createEmployee.mockRejectedValueOnce(new Error('boom'));
      renderScreen();
      await loaded();
      await fillValid(user);
      await user.click(createButton());
      await user.click(await screen.findByRole('button', { name: 'OK' }));

      await user.click(createButton());

      expect(await screen.findByText('Employee Created Successfully')).toBeInTheDocument();
      expect(mocked.createEmployee).toHaveBeenCalledTimes(2);
    });
  });

  // Gap found while writing these tests, written as the behaviour the screen should have and
  // marked `fails`: it passes while the gap exists and goes red once it is fixed, at which
  // point the `.fails` should be removed.
  describe('known gaps', () => {
    it.fails('clears an error as soon as the field is corrected', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(createButton());
      expect(screen.getByText('Employee name is required')).toBeInTheDocument();

      await user.type(f.name(), 'R');

      expect(screen.queryByText('Employee name is required')).not.toBeInTheDocument();
    });
  });
});
