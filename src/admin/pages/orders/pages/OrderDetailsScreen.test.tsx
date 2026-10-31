import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { OrderDetailsScreen } from './OrderDetailsScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({
  getOrderWithLoadmen: vi.fn(),
  getAllEmployees: vi.fn(),
  updateOrderWithLoadmen: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const ORDER = {
  id: 'ord-1001',
  customer_id: 'cust-1',
  order_date: '2026-10-01',
  delivery_date: '2026-10-20',
  brick_quantity: 5000,
  price_per_brick: 8,
  paper_price: 0,
  final_price: 40000,
  location: '12 MG Road, Coimbatore',
  payment_status: 'NOT_PAID',
  amount_paid: 0,
  gst_number: null,
  dc_number: null,
  delivered: false,
  loading_type: 'LOADING_ONLY',
  customers: { name: 'Rajesh Kumar', phone: '9876543210' },
  loadmen: [],
};

function Destination() {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin/orders/ord-1001']}>
      <Routes>
        <Route path="/admin/orders/:orderId" element={<OrderDetailsScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function loaded() {
  await waitFor(() => expect(screen.getByLabelText(/^Location/)).toHaveValue(ORDER.location));
}

const loadType = () => screen.getByLabelText('Load Type');

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getOrderWithLoadmen.mockResolvedValue(ORDER as never);
  mocked.getAllEmployees.mockResolvedValue([] as never);
  mocked.updateOrderWithLoadmen.mockResolvedValue(undefined);
});

describe('OrderDetailsScreen', () => {
  describe('editing an order', () => {
    it('shows the order and its current load type', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByRole('heading', { name: 'Order Details' })).toBeInTheDocument();
      expect(screen.getByText(/Edit order information - ord-1001/)).toBeInTheDocument();
      expect(loadType()).toHaveValue('LOADING_ONLY');
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
    });

    it('saves the order, keeping its load type, then confirms and goes back', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => expect(screen.getByText('Order Edited Successfully')).toBeInTheDocument());
      expect(mocked.updateOrderWithLoadmen).toHaveBeenCalledWith(
        'ord-1001',
        expect.objectContaining({ brick_quantity: 5000, location: '12 MG Road, Coimbatore', loading_type: 'LOADING_ONLY' }),
        [],
      );

      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(screen.getByTestId('path')).toHaveTextContent('/admin/orders');
    });

    it('saves the load type that was picked', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.selectOptions(loadType(), 'CUSTOMER_SELF');
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => expect(mocked.updateOrderWithLoadmen).toHaveBeenCalled());
      expect(mocked.updateOrderWithLoadmen.mock.calls[0][1]).toMatchObject({ loading_type: 'CUSTOMER_SELF' });
    });

    describe('loadmen when the load type changes', () => {
      const RAJU = { id: 'emp-1', name: 'Raju Kumar' };
      const SURESH = { id: 'emp-2', name: 'Suresh Yadav' };

      beforeEach(() => {
        mocked.getOrderWithLoadmen.mockResolvedValue({
          ...ORDER,
          loading_type: 'LOADING_UNLOADING',
          loadmen: [RAJU, SURESH],
        } as never);
        mocked.getAllEmployees.mockResolvedValue([RAJU, SURESH] as never);
      });

      it('removes all the mapped loadmen when switched to customer self loading', async () => {
        const user = userEvent.setup();
        renderScreen();
        await loaded();
        await waitFor(() => expect(screen.getByRole('checkbox', { name: /Raju Kumar/ })).toBeChecked());
        expect(screen.getByRole('checkbox', { name: /Suresh Yadav/ })).toBeChecked();

        await user.selectOptions(loadType(), 'CUSTOMER_SELF');
        await user.click(screen.getByRole('button', { name: 'Confirm' }));

        await waitFor(() => expect(mocked.updateOrderWithLoadmen).toHaveBeenCalled());
        expect(mocked.updateOrderWithLoadmen).toHaveBeenCalledWith(
          'ord-1001',
          expect.objectContaining({ loading_type: 'CUSTOMER_SELF' }),
          [],
        );
      });

      it('does not bring the old loadmen back when switched away and back again', async () => {
        const user = userEvent.setup();
        renderScreen();
        await loaded();
        await waitFor(() => expect(screen.getByRole('checkbox', { name: /Raju Kumar/ })).toBeChecked());

        await user.selectOptions(loadType(), 'CUSTOMER_SELF');
        await user.selectOptions(loadType(), 'LOADING_ONLY');

        expect(screen.getByRole('checkbox', { name: /Raju Kumar/ })).not.toBeChecked();
        expect(screen.getByRole('checkbox', { name: /Suresh Yadav/ })).not.toBeChecked();
        expect(screen.queryByText(/^Selected:/)).not.toBeInTheDocument();
      });

      it('keeps the loadmen when switched between the other load types', async () => {
        const user = userEvent.setup();
        renderScreen();
        await loaded();
        await waitFor(() => expect(screen.getByRole('checkbox', { name: /Raju Kumar/ })).toBeChecked());

        await user.selectOptions(loadType(), 'LOADING_ONLY');
        await user.click(screen.getByRole('button', { name: 'Confirm' }));

        await waitFor(() => expect(mocked.updateOrderWithLoadmen).toHaveBeenCalled());
        expect(mocked.updateOrderWithLoadmen.mock.calls[0][2]).toEqual(['emp-1', 'emp-2']);
      });
    });

    it('saves a valid load type for an older order that has none', async () => {
      mocked.getOrderWithLoadmen.mockResolvedValue({ ...ORDER, loading_type: null } as never);
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      // The select shows its first option, and that is what gets saved.
      expect(loadType()).toHaveValue('LOADING_UNLOADING');
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => expect(mocked.updateOrderWithLoadmen).toHaveBeenCalled());
      expect(mocked.updateOrderWithLoadmen.mock.calls[0][1]).toMatchObject({ loading_type: 'LOADING_UNLOADING' });
    });

    it('shows the server error when the update fails, and stays on the screen', async () => {
      mocked.updateOrderWithLoadmen.mockRejectedValue(new Error('Only administrators can update orders'));
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => expect(screen.getByText('Update Failed')).toBeInTheDocument());
      expect(screen.getAllByText('Only administrators can update orders').length).toBeGreaterThan(0);
      expect(screen.queryByText('Order Edited Successfully')).not.toBeInTheDocument();
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    });

    it('does not save when the location is cleared, and says why', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.clear(screen.getByLabelText(/^Location/));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(screen.getByText('Delivery location is required')).toBeInTheDocument();
      expect(mocked.updateOrderWithLoadmen).not.toHaveBeenCalled();
    });
  });

  describe('a delivered order', () => {
    const DELIVERED = {
      ...ORDER,
      delivered: true,
      payment_status: 'PARTIALLY_PAID',
      amount_paid: 15000,
      gst_number: '33ABCDE1234F1Z5',
      dc_number: 'DC-77',
      loadmen: [{ id: 'emp-1' }],
    };

    beforeEach(() => {
      mocked.getOrderWithLoadmen.mockResolvedValue(DELIVERED as never);
      mocked.getAllEmployees.mockResolvedValue([{ id: 'emp-1', name: 'Raju Kumar' }, { id: 'emp-2', name: 'Suresh Yadav' }] as never);
    });

    it('is read-only, with no Confirm button', async () => {
      mocked.getOrderWithLoadmen.mockResolvedValue({ ...ORDER, delivered: true } as never);
      renderScreen();
      await loaded();

      expect(screen.getByText(/View order information - ord-1001/)).toBeInTheDocument();
      expect(loadType()).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    });

    it('says it was delivered and cannot be edited', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByText('This order has been delivered and cannot be edited.')).toBeInTheDocument();
      expect(screen.getByText('Delivered')).toBeInTheDocument();
    });

    it('disables every field', async () => {
      renderScreen();
      await loaded();

      for (const label of [/^Brick Quantity/, /^Price Per Brick/, /^Location/, /^Final Price/, /^GST Number/, /^Delivery Challan Number/]) {
        expect(screen.getByLabelText(label)).toBeDisabled();
      }
      expect(loadType()).toBeDisabled();
      expect(screen.getByRole('button', { name: /October 20th, 2026/ })).toBeDisabled();
    });

    it('shows what the order was delivered with', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByLabelText(/^GST Number/)).toHaveValue('33ABCDE1234F1Z5');
      expect(screen.getByLabelText(/^Delivery Challan Number/)).toHaveValue('DC-77');
      expect(screen.getByLabelText('Payment Status')).toHaveValue('PARTIALLY_PAID');
      expect(screen.getByLabelText('Amount Paid')).toHaveValue(15000);
    });

    it('shows the amount paid only for a part-paid order', async () => {
      mocked.getOrderWithLoadmen.mockResolvedValue({ ...DELIVERED, payment_status: 'FULLY_PAID', amount_paid: 40000 } as never);
      renderScreen();
      await loaded();

      expect(screen.getByLabelText('Payment Status')).toHaveValue('FULLY_PAID');
      expect(screen.queryByLabelText('Amount Paid')).not.toBeInTheDocument();
    });

    it('shows who loaded it, and does not let them be changed', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await waitFor(() => expect(screen.getByRole('checkbox', { name: /Raju Kumar/ })).toBeChecked());

      expect(screen.getByRole('checkbox', { name: /Raju Kumar/ })).toBeDisabled();
      await user.click(screen.getByRole('checkbox', { name: /Suresh Yadav/ }));

      expect(screen.getByRole('checkbox', { name: /Suresh Yadav/ })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: /Raju Kumar/ })).toBeChecked();
    });
  });

  describe('when the order cannot be loaded', () => {
    it('shows an error message', async () => {
      mocked.getOrderWithLoadmen.mockRejectedValue(new Error('boom'));
      renderScreen();

      await waitFor(() => expect(screen.getByText('Failed to load order details')).toBeInTheDocument());
    });
  });

  describe('showing the order', () => {
    it('shows who the order is for and when it was placed', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByText('Customer: Rajesh Kumar')).toBeInTheDocument();
      expect(screen.getByText('Phone: 9876543210')).toBeInTheDocument();
      expect(screen.getByText(`Order Date: ${new Date('2026-10-01').toLocaleDateString()}`)).toBeInTheDocument();
      expect(screen.queryByText('Delivered')).not.toBeInTheDocument();
    });

    it('fills the form from the order', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByLabelText(/^Brick Quantity/)).toHaveValue(5000);
      expect(screen.getByLabelText(/^Price Per Brick/)).toHaveValue(8);
      expect(screen.getByLabelText(/^Final Price/)).toHaveValue(40000);
      expect(screen.getByLabelText(/^GST Number/)).toHaveValue('');
      expect(screen.getByLabelText(/^Delivery Challan Number/)).toHaveValue('');
      expect(screen.getByRole('button', { name: 'October 20th, 2026' })).toBeInTheDocument();
    });

    it('shows the paper price and the price per brick the final price works out to', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByLabelText('Paper Price')).toHaveValue('₹40,000');
      expect(screen.getByLabelText('Paper Price')).toBeDisabled();
      expect(screen.getByText('Price per brick: ₹8.00')).toBeInTheDocument();
    });

    it('does not show the payment fields while the order can still be edited', async () => {
      renderScreen();
      await loaded();

      expect(screen.queryByLabelText('Payment Status')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Amount Paid')).not.toBeInTheDocument();
    });

    it('says Loading order details... until the order arrives', async () => {
      let finish: (value: unknown) => void = () => {};
      mocked.getOrderWithLoadmen.mockReturnValue(new Promise((resolve) => (finish = resolve)) as never);
      renderScreen();

      expect(screen.getByText('Loading order details...')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Order Details' })).not.toBeInTheDocument();

      finish(ORDER);
      await loaded();
      expect(screen.queryByText('Loading order details...')).not.toBeInTheDocument();
    });

    it('goes back to the orders list', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: /Back/ }));

      expect(screen.getByTestId('path')).toHaveTextContent('/admin/orders');
    });
  });

  describe('changing the order', () => {
    it('works out the paper price again when the quantity or the price per brick changes', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.clear(screen.getByLabelText(/^Brick Quantity/));
      await user.type(screen.getByLabelText(/^Brick Quantity/), '6000');
      expect(screen.getByLabelText('Paper Price')).toHaveValue('₹48,000');

      await user.clear(screen.getByLabelText(/^Price Per Brick/));
      await user.type(screen.getByLabelText(/^Price Per Brick/), '9.5');
      expect(screen.getByLabelText('Paper Price')).toHaveValue('₹57,000');
    });

    it('upper-cases the GST number and stops at 15 characters', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.type(screen.getByLabelText(/^GST Number/), '33abcde1234f1z5extra');

      expect(screen.getByLabelText(/^GST Number/)).toHaveValue('33ABCDE1234F1Z5');
    });

    it('saves every change that was made', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.clear(screen.getByLabelText(/^Brick Quantity/));
      await user.type(screen.getByLabelText(/^Brick Quantity/), '6000');
      await user.clear(screen.getByLabelText(/^Price Per Brick/));
      await user.type(screen.getByLabelText(/^Price Per Brick/), '9');
      await user.clear(screen.getByLabelText(/^Location/));
      await user.type(screen.getByLabelText(/^Location/), '45 Brigade Road, Erode');
      await user.clear(screen.getByLabelText(/^Final Price/));
      await user.type(screen.getByLabelText(/^Final Price/), '54000');
      await user.type(screen.getByLabelText(/^GST Number/), '33abcde1234f1z5');
      await user.type(screen.getByLabelText(/^Delivery Challan Number/), 'DC-101');
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => expect(mocked.updateOrderWithLoadmen).toHaveBeenCalledTimes(1));
      expect(mocked.updateOrderWithLoadmen).toHaveBeenCalledWith(
        'ord-1001',
        {
          brick_quantity: 6000,
          delivery_date: '2026-10-20',
          price_per_brick: 9,
          location: '45 Brigade Road, Erode',
          final_price: 54000,
          payment_status: 'NOT_PAID',
          amount_paid: 0,
          gst_number: '33ABCDE1234F1Z5',
          dc_number: 'DC-101',
          loading_type: 'LOADING_ONLY',
        },
        [],
      );
    });

    it('saves a cleared GST number as none', async () => {
      mocked.getOrderWithLoadmen.mockResolvedValue({ ...ORDER, gst_number: '33ABCDE1234F1Z5' } as never);
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await waitFor(() => expect(screen.getByLabelText(/^GST Number/)).toHaveValue('33ABCDE1234F1Z5'));

      await user.clear(screen.getByLabelText(/^GST Number/));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => expect(mocked.updateOrderWithLoadmen).toHaveBeenCalled());
      expect(mocked.updateOrderWithLoadmen.mock.calls[0][1]).toMatchObject({ gst_number: null });
    });

    it('keeps the amount already paid on a part-paid order', async () => {
      mocked.getOrderWithLoadmen.mockResolvedValue({ ...ORDER, payment_status: 'PARTIALLY_PAID', amount_paid: 15000 } as never);
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => expect(mocked.updateOrderWithLoadmen).toHaveBeenCalled());
      expect(mocked.updateOrderWithLoadmen.mock.calls[0][1]).toMatchObject({ payment_status: 'PARTIALLY_PAID', amount_paid: 15000 });
    });

    it('keeps a fully paid order fully paid when the final price changes', async () => {
      mocked.getOrderWithLoadmen.mockResolvedValue({ ...ORDER, payment_status: 'FULLY_PAID', amount_paid: 40000 } as never);
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.clear(screen.getByLabelText(/^Final Price/));
      await user.type(screen.getByLabelText(/^Final Price/), '45000');
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => expect(mocked.updateOrderWithLoadmen).toHaveBeenCalled());
      expect(mocked.updateOrderWithLoadmen.mock.calls[0][1]).toMatchObject({ payment_status: 'FULLY_PAID', amount_paid: 45000 });
    });
  });

  describe('the delivery date', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('saves the date that was picked', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'October 20th, 2026' }));
      await user.click(await screen.findByRole('gridcell', { name: '24' }));
      expect(screen.getByRole('button', { name: 'October 24th, 2026' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => expect(mocked.updateOrderWithLoadmen).toHaveBeenCalled());
      expect(mocked.updateOrderWithLoadmen.mock.calls[0][1]).toMatchObject({ delivery_date: '2026-10-24' });
    });

    it('does not let a day before today be picked', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'October 20th, 2026' }));

      expect(await screen.findByRole('gridcell', { name: '14' })).toBeDisabled();
      expect(screen.getByRole('gridcell', { name: '15' })).toBeEnabled();
    });
  });

  describe('validation', () => {
    it.each([
      ['Brick Quantity', /^Brick Quantity/, 'Brick quantity must be greater than 0'],
      ['Price Per Brick', /^Price Per Brick/, 'Price per brick must be greater than 0'],
      ['Final Price', /^Final Price/, 'Final price must be greater than 0'],
      ['Location', /^Location/, 'Delivery location is required'],
    ])('does not save when the %s is cleared, and says why', async (_name, label, message) => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.clear(screen.getByLabelText(label));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(screen.getByText(message)).toBeInTheDocument();
      expect(mocked.updateOrderWithLoadmen).not.toHaveBeenCalled();
    });

    it('lists every problem at once', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      for (const label of [/^Brick Quantity/, /^Price Per Brick/, /^Final Price/, /^Location/]) {
        await user.clear(screen.getByLabelText(label));
      }
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(screen.getByText('Brick quantity must be greater than 0')).toBeInTheDocument();
      expect(screen.getByText('Price per brick must be greater than 0')).toBeInTheDocument();
      expect(screen.getByText('Final price must be greater than 0')).toBeInTheDocument();
      expect(screen.getByText('Delivery location is required')).toBeInTheDocument();
    });

    it('rejects a GST number that is not 15 characters', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.type(screen.getByLabelText(/^GST Number/), '33ABCDE12');
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(screen.getByText('GST Number must be exactly 15 characters')).toBeInTheDocument();
      expect(mocked.updateOrderWithLoadmen).not.toHaveBeenCalled();
    });

    it('does not show a popup for a validation error', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.clear(screen.getByLabelText(/^Location/));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(screen.queryByRole('heading', { name: 'Update Failed' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Error' })).not.toBeInTheDocument();
    });

    it('saves once the problem is fixed', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.clear(screen.getByLabelText(/^Location/));
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await user.type(screen.getByLabelText(/^Location/), '45 Brigade Road, Erode');
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => expect(mocked.updateOrderWithLoadmen).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('Delivery location is required')).not.toBeInTheDocument();
    });
  });

  describe('saving', () => {
    it('disables Confirm and says Updating... while the order is being saved', async () => {
      let finish: () => void = () => {};
      mocked.updateOrderWithLoadmen.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)) as never);
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(await screen.findByRole('button', { name: 'Updating...' })).toBeDisabled();
      finish();
      expect(await screen.findByText('Order Edited Successfully')).toBeInTheDocument();
    });

    it('keeps the form, and the changes, when the failure popup is closed', async () => {
      mocked.updateOrderWithLoadmen.mockRejectedValue(new Error('Only administrators can update orders'));
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.clear(screen.getByLabelText(/^Location/));
      await user.type(screen.getByLabelText(/^Location/), '45 Brigade Road, Erode');
      await user.click(screen.getByRole('button', { name: 'Confirm' }));
      await screen.findByText('Update Failed');

      await user.click(screen.getAllByRole('button', { name: 'OK' })[0]);
      await user.click(screen.getAllByRole('button', { name: 'OK' })[0]);

      expect(screen.queryByText('Update Failed')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^Location/)).toHaveValue('45 Brigade Road, Erode');
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeEnabled();
    });

    it('can be saved again after a failure', async () => {
      mocked.updateOrderWithLoadmen.mockRejectedValueOnce(new Error('Temporary problem'));
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(screen.getByRole('button', { name: 'Confirm' }));
      await screen.findByText('Update Failed');
      await user.click(screen.getAllByRole('button', { name: 'OK' })[0]);
      await user.click(screen.getAllByRole('button', { name: 'OK' })[0]);

      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(await screen.findByText('Order Edited Successfully')).toBeInTheDocument();
      expect(mocked.updateOrderWithLoadmen).toHaveBeenCalledTimes(2);
    });

    it('falls back to a general message when the failure has none', async () => {
      mocked.updateOrderWithLoadmen.mockRejectedValue('nope');
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await screen.findByText('Update Failed');
      expect(screen.getAllByText('Failed to update order').length).toBeGreaterThan(0);
    });
  });

  describe('loadmen', () => {
    const RAJU = { id: 'emp-1', name: 'Raju Kumar' };
    const SURESH = { id: 'emp-2', name: 'Suresh Yadav' };

    beforeEach(() => {
      mocked.getOrderWithLoadmen.mockResolvedValue({ ...ORDER, loadmen: [{ id: 'emp-2' }] } as never);
      mocked.getAllEmployees.mockResolvedValue([RAJU, SURESH] as never);
    });

    it('lists the staff and ticks the ones already on the order', async () => {
      renderScreen();
      await loaded();

      await waitFor(() => expect(screen.getByRole('checkbox', { name: /Suresh Yadav/ })).toBeChecked());
      expect(screen.getByRole('checkbox', { name: /Raju Kumar/ })).not.toBeChecked();
      expect(screen.getByText('Selected: Suresh Yadav')).toBeInTheDocument();
      expect(mocked.getAllEmployees).toHaveBeenCalledWith(true);
    });

    it('saves the loadmen that are ticked at the end', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await waitFor(() => expect(screen.getByRole('checkbox', { name: /Suresh Yadav/ })).toBeChecked());

      await user.click(screen.getByRole('checkbox', { name: /Raju Kumar/ }));
      await user.click(screen.getByRole('checkbox', { name: /Suresh Yadav/ }));
      expect(screen.getByText('Selected: Raju Kumar')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => expect(mocked.updateOrderWithLoadmen).toHaveBeenCalled());
      expect(mocked.updateOrderWithLoadmen.mock.calls[0][2]).toEqual(['emp-1']);
    });

    it('saves none when every loadman is unticked', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await waitFor(() => expect(screen.getByRole('checkbox', { name: /Suresh Yadav/ })).toBeChecked());

      await user.click(screen.getByRole('checkbox', { name: /Suresh Yadav/ }));
      expect(screen.queryByText(/^Selected:/)).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => expect(mocked.updateOrderWithLoadmen).toHaveBeenCalled());
      expect(mocked.updateOrderWithLoadmen.mock.calls[0][2]).toEqual([]);
    });

    it('tells the administrator when the staff cannot be loaded', async () => {
      mocked.getAllEmployees.mockRejectedValue(new Error('staff failed'));
      renderScreen();

      expect(await screen.findByRole('heading', { name: 'Error' })).toBeInTheDocument();
      expect(screen.getByText('Failed to load loadmen details')).toBeInTheDocument();
    });
  });

  describe('known gaps', () => {
    // handleConfirm sets both the error (an "Error" popup) and the failure popup ("Update Failed"),
    // so one failed save puts two popups on screen, one on top of the other.
    it.fails('shows a single popup when saving fails', async () => {
      mocked.updateOrderWithLoadmen.mockRejectedValue(new Error('Only administrators can update orders'));
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.click(screen.getByRole('button', { name: 'Confirm' }));

      await screen.findByRole('heading', { name: 'Update Failed' });
      expect(screen.getAllByRole('button', { name: 'OK' })).toHaveLength(1);
    });

    // `finalPrice && brickQuantity && <p>` renders the number 0 when the final price is cleared.
    it.fails('shows nothing under the final price when it is cleared', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      await user.clear(screen.getByLabelText(/^Final Price/));

      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });
  });
});
