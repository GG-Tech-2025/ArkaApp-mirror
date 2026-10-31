import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    it('is read-only, with no Confirm button', async () => {
      mocked.getOrderWithLoadmen.mockResolvedValue({ ...ORDER, delivered: true } as never);
      renderScreen();
      await loaded();

      expect(screen.getByText(/View order information - ord-1001/)).toBeInTheDocument();
      expect(loadType()).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    });
  });

  describe('when the order cannot be loaded', () => {
    it('shows an error message', async () => {
      mocked.getOrderWithLoadmen.mockRejectedValue(new Error('boom'));
      renderScreen();

      await waitFor(() => expect(screen.getByText('Failed to load order details')).toBeInTheDocument());
    });
  });
});
