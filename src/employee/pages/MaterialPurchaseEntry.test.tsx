import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { MaterialPurchaseEntry } from './MaterialPurchaseEntry';
import * as middleware from '../../services/middleware.service';

vi.mock('../../services/middleware.service', () => ({
  getMaterials: vi.fn(),
  getVendors: vi.fn(),
  createProcurement: vi.fn(),
  validateSession: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const MATERIALS = [
  { id: 'mat-cement', name: 'Cement', unit: 'bags' },
  { id: 'mat-fly-ash', name: 'Fly Ash Powder', unit: 'tons' },
  { id: 'mat-wet-ash', name: 'Wet Ash', unit: 'tons' },
];
const VENDORS = [
  { id: 'ven-abc', name: 'ABC Suppliers' },
  { id: 'ven-xyz', name: 'XYZ Materials' },
];

const USER_ID = 'user-1';
// A mid-month morning, so "today", yesterday and tomorrow all sit in the same visible month.
const NOW = new Date(2026, 9, 15, 10, 0, 0);

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/employee/material-entry']}>
      <Routes>
        <Route path="/employee/material-entry" element={<MaterialPurchaseEntry />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const materialField = () => screen.getByLabelText(/^Material/);
const vendorField = () => screen.getByLabelText(/^Vendor/);
const quantityField = () => screen.getByLabelText(/^Quantity/);
const submitButton = () => screen.getByRole('button', { name: /Submit/ });
const dateButton = () => screen.getByRole('button', { name: /2026|Select a date/ });

type User = ReturnType<typeof userEvent.setup>;

async function loaded() {
  await waitFor(() => expect(materialField()).toBeEnabled());
  await waitFor(() => expect(vendorField()).toBeEnabled());
}

async function fillValid(user: User, quantity = '25') {
  await user.selectOptions(materialField(), 'Cement');
  await user.selectOptions(vendorField(), 'ABC Suppliers');
  await user.type(quantityField(), quantity);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  mocked.getMaterials.mockResolvedValue(MATERIALS);
  mocked.getVendors.mockResolvedValue(VENDORS as never);
  mocked.validateSession.mockResolvedValue({ id: USER_ID } as never);
  mocked.createProcurement.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MaterialPurchaseEntry', () => {
  describe('layout and data loading', () => {
    it('shows the heading, the four fields and a Submit button', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByRole('heading', { name: 'Material Purchase Entry' })).toBeInTheDocument();
      expect(screen.getByText('Enter the details of material purchase')).toBeInTheDocument();
      expect(materialField()).toBeInTheDocument();
      expect(vendorField()).toBeInTheDocument();
      expect(quantityField()).toBeInTheDocument();
      expect(dateButton()).toBeInTheDocument();
      expect(submitButton()).toBeEnabled();
    });

    it('lists the materials and vendors from the server, with a prompt option first', async () => {
      renderScreen();
      await loaded();

      const materials = within(materialField()).getAllByRole('option').map((o) => o.textContent);
      const vendors = within(vendorField()).getAllByRole('option').map((o) => o.textContent);
      expect(materials).toEqual(['Select Material', 'Cement', 'Fly Ash Powder', 'Wet Ash']);
      expect(vendors).toEqual(['Select Vendor', 'ABC Suppliers', 'XYZ Materials']);
    });

    it('disables the material and vendor lists while they load', async () => {
      mocked.getMaterials.mockReturnValue(new Promise(() => {}));
      mocked.getVendors.mockReturnValue(new Promise(() => {}));
      renderScreen();

      expect(materialField()).toBeDisabled();
      expect(vendorField()).toBeDisabled();
    });

    it('enables each list as soon as it has loaded', async () => {
      mocked.getVendors.mockReturnValue(new Promise(() => {}));
      renderScreen();

      await waitFor(() => expect(materialField()).toBeEnabled());
      expect(vendorField()).toBeDisabled();
    });

    it('starts with nothing chosen and today as the date', async () => {
      renderScreen();
      await loaded();

      expect(materialField()).toHaveValue('');
      expect(vendorField()).toHaveValue('');
      expect(quantityField()).toHaveValue(null);
      expect(dateButton()).toHaveTextContent('October 15th, 2026');
    });

    it('goes back to the home screen from Back to Home', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();

      await user.click(screen.getByRole('button', { name: /Back to Home/ }));

      expect(screen.getByTestId('path')).toHaveTextContent('/employee/home');
    });

    it('still renders usable, empty lists when loading fails', async () => {
      mocked.getMaterials.mockRejectedValue(new Error('down'));
      mocked.getVendors.mockRejectedValue(new Error('down'));
      renderScreen();
      await loaded();

      expect(within(materialField()).getAllByRole('option')).toHaveLength(1);
      expect(within(vendorField()).getAllByRole('option')).toHaveLength(1);
    });
  });

  describe('quantity field', () => {
    it('is a number field that accepts decimals and rejects negatives in the browser', async () => {
      renderScreen();
      await loaded();

      expect(quantityField()).toHaveAttribute('type', 'number');
      expect(quantityField()).toHaveAttribute('min', '0');
      expect(quantityField()).toHaveAttribute('step', '0.01');
    });

    it('asks for a plain quantity until a material is chosen', async () => {
      renderScreen();
      await loaded();

      expect(quantityField()).toHaveAttribute('placeholder', 'Enter quantity');
      expect(screen.getByText(/^Quantity/)).not.toHaveTextContent('(');
    });

    it.each([
      ['Cement', 'bags'],
      ['Fly Ash Powder', 'tons'],
      ['Wet Ash', 'tons'],
    ])('shows the unit for %s as %s', async (name, unit) => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();

      await user.selectOptions(materialField(), name);

      expect(screen.getByText(/^Quantity/)).toHaveTextContent(`(${unit})`);
      expect(quantityField()).toHaveAttribute('placeholder', `Enter quantity in ${unit}`);
    });

    it('drops the unit again when the material is cleared', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();
      await user.selectOptions(materialField(), 'Cement');

      await user.selectOptions(materialField(), '');

      expect(screen.getByText(/^Quantity/)).not.toHaveTextContent('(');
    });

    it('lets go of focus when the mouse wheel is turned over it, so scrolling cannot change it', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();
      await user.click(quantityField());
      expect(quantityField()).toHaveFocus();

      quantityField().dispatchEvent(new WheelEvent('wheel', { bubbles: true }));

      expect(quantityField()).not.toHaveFocus();
    });
  });

  describe('validation', () => {
    it('reports every missing field when Submit is pressed on an empty form', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();

      await user.click(submitButton());

      expect(screen.getByText('Material is required')).toBeInTheDocument();
      expect(screen.getByText('Vendor is required')).toBeInTheDocument();
      expect(screen.getByText('Quantity is required')).toBeInTheDocument();
      expect(screen.queryByText('Date is required')).not.toBeInTheDocument();
      expect(mocked.createProcurement).not.toHaveBeenCalled();
    });

    it('reports only the field that is missing', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();
      await user.selectOptions(materialField(), 'Cement');
      await user.selectOptions(vendorField(), 'ABC Suppliers');

      await user.click(submitButton());

      expect(screen.getByText('Quantity is required')).toBeInTheDocument();
      expect(screen.queryByText('Material is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Vendor is required')).not.toBeInTheDocument();
    });

    it.each([
      ['zero', '0'],
      ['a negative number', '-5'],
    ])('rejects %s as a quantity', async (_label, quantity) => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();
      await fillValid(user, quantity);

      await user.click(submitButton());

      expect(screen.getByText('Quantity is required')).toBeInTheDocument();
      expect(mocked.createProcurement).not.toHaveBeenCalled();
    });

    it('does not contact the server or show a popup when validation fails', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();

      await user.click(submitButton());

      expect(mocked.validateSession).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument();
    });

    it.each([
      ['material', async (u: User) => u.selectOptions(materialField(), 'Cement'), 'Material is required'],
      ['vendor', async (u: User) => u.selectOptions(vendorField(), 'ABC Suppliers'), 'Vendor is required'],
      ['quantity', async (u: User) => u.type(quantityField(), '3'), 'Quantity is required'],
    ])('clears the %s error as soon as that field is changed', async (_field, change, message) => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();
      await user.click(submitButton());
      expect(screen.getByText(message)).toBeInTheDocument();

      await change(user);

      expect(screen.queryByText(message)).not.toBeInTheDocument();
    });

    it('leaves the other errors in place when one field is fixed', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();
      await user.click(submitButton());

      await user.selectOptions(materialField(), 'Cement');

      expect(screen.getByText('Vendor is required')).toBeInTheDocument();
      expect(screen.getByText('Quantity is required')).toBeInTheDocument();
    });
  });

  describe('choosing the date', () => {
    async function openCalendar(user: User) {
      await user.click(dateButton());
      return screen.findByRole('grid');
    }

    it('opens a calendar showing the current month', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();

      const grid = await openCalendar(user);

      expect(grid).toBeInTheDocument();
      expect(screen.getByText('October 2026')).toBeInTheDocument();
    });

    it('lets today be picked but not any later day', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();
      await openCalendar(user);

      expect(screen.getByRole('gridcell', { name: '15' })).toBeEnabled();
      expect(screen.getByRole('gridcell', { name: '14' })).toBeEnabled();
      expect(screen.getByRole('gridcell', { name: '16' })).toBeDisabled();
      expect(screen.getByRole('gridcell', { name: '31' })).toBeDisabled();
    });

    it('shows an earlier day once it is chosen', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();
      await openCalendar(user);

      await user.click(screen.getByRole('gridcell', { name: '10' }));

      expect(dateButton()).toHaveTextContent('October 10th, 2026');
    });
  });

  describe('submitting', () => {
    it('saves the purchase with the chosen values and the signed-in user', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();
      await fillValid(user, '12.5');

      await user.click(submitButton());

      await waitFor(() => expect(mocked.createProcurement).toHaveBeenCalledTimes(1));
      expect(mocked.createProcurement).toHaveBeenCalledWith(
        { material_id: 'mat-cement', vendor_id: 'ven-abc', quantity: 12.5, date: '2026-10-15' },
        USER_ID,
      );
    });

    it('sends the date that was picked, as yyyy-MM-dd', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();
      await fillValid(user);
      await user.click(dateButton());
      await user.click(await screen.findByRole('gridcell', { name: '3' }));

      await user.click(submitButton());

      await waitFor(() => expect(mocked.createProcurement).toHaveBeenCalled());
      expect(mocked.createProcurement.mock.calls[0][0].date).toBe('2026-10-03');
    });

    it('sends the quantity as a number, not text', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();
      await fillValid(user, '40');

      await user.click(submitButton());

      await waitFor(() => expect(mocked.createProcurement).toHaveBeenCalled());
      expect(mocked.createProcurement.mock.calls[0][0].quantity).toBe(40);
    });

    it('confirms a saved purchase with a success popup', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();
      await fillValid(user);

      await user.click(submitButton());

      expect(await screen.findByText('Purchase Successful')).toBeInTheDocument();
      expect(screen.getByText('Material purchase entry has been recorded successfully.')).toBeInTheDocument();
    });

    it('returns to the home screen after the success popup is closed', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderScreen();
      await loaded();
      await fillValid(user);
      await user.click(submitButton());
      await screen.findByText('Purchase Successful');

      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.getByTestId('path')).toHaveTextContent('/employee/home');
    });

    it('shows Submitting... and blocks a second press while the save is in flight', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      let finish: () => void = () => {};
      mocked.createProcurement.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      renderScreen();
      await loaded();
      await fillValid(user);

      await user.click(submitButton());

      const busy = await screen.findByRole('button', { name: 'Submitting...' });
      expect(busy).toBeDisabled();
      await user.click(busy);
      expect(mocked.createProcurement).toHaveBeenCalledTimes(1);

      finish();
      expect(await screen.findByText('Purchase Successful')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
    });
  });

  describe('when saving fails', () => {
    it('explains the failure in a popup', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mocked.createProcurement.mockRejectedValue(new Error('insert failed'));
      renderScreen();
      await loaded();
      await fillValid(user);

      await user.click(submitButton());

      expect(await screen.findByText('Submission Failed')).toBeInTheDocument();
      expect(screen.getByText('Failed to save material purchase')).toBeInTheDocument();
      expect(screen.queryByText('Purchase Successful')).not.toBeInTheDocument();
    });

    it('treats a signed-out user as a failed save and writes nothing', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mocked.validateSession.mockResolvedValue(null);
      renderScreen();
      await loaded();
      await fillValid(user);

      await user.click(submitButton());

      expect(await screen.findByText('Submission Failed')).toBeInTheDocument();
      expect(mocked.createProcurement).not.toHaveBeenCalled();
    });

    it('keeps the form filled in and stays on the screen so the employee can retry', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mocked.createProcurement.mockRejectedValueOnce(new Error('insert failed'));
      renderScreen();
      await loaded();
      await fillValid(user, '8');
      await user.click(submitButton());
      await screen.findByText('Submission Failed');

      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.queryByText('Submission Failed')).not.toBeInTheDocument();
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
      expect(materialField()).toHaveValue('mat-cement');
      expect(vendorField()).toHaveValue('ven-abc');
      expect(quantityField()).toHaveValue(8);
      expect(submitButton()).toBeEnabled();
    });

    it('succeeds on a second attempt after a failure', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mocked.createProcurement.mockRejectedValueOnce(new Error('insert failed'));
      renderScreen();
      await loaded();
      await fillValid(user);
      await user.click(submitButton());
      await user.click(await screen.findByRole('button', { name: 'OK' }));

      await user.click(submitButton());

      expect(await screen.findByText('Purchase Successful')).toBeInTheDocument();
      expect(screen.queryByText('Submission Failed')).not.toBeInTheDocument();
      expect(mocked.createProcurement).toHaveBeenCalledTimes(2);
    });
  });
});
