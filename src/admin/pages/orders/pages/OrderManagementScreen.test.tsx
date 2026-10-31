import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { OrderManagementScreen } from './OrderManagementScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({
  getTodayDeliveryOrdersWithPagination: vi.fn(),
  getUndeliveredOrders: vi.fn(),
  getDeliveredOrders: vi.fn(),
  getUnpaidOrders: vi.fn(),
  deleteOrder: vi.fn(),
  updateOrderWithLoadmen: vi.fn(),
}));

const mocked = vi.mocked(middleware);

// The screen compares delivery dates with today's UTC date.
const TODAY = '2026-10-15';

const order = (id: string, deliveryDate: string, customer: string, location = '12 MG Road, Coimbatore') => ({
  id,
  customer_id: `cust-${id}`,
  order_date: '2026-10-01',
  delivery_date: deliveryDate,
  brick_quantity: 5000,
  final_price: 40000,
  location,
  payment_status: 'NOT_PAID',
  dc_number: null,
  delivered: false,
  customers: { name: customer, phone: '9876543210' },
});

const LATER = order('ord-1001', '2026-10-20', 'Rajesh Kumar');
const TODAYS = order('ord-1002', TODAY, 'Priya Sharma', '45 Brigade Road, Erode');

const page = (data: unknown[]) => ({ data, total: data.length, hasMore: false });

function Destination() {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin/orders']}>
      <Routes>
        <Route path="/admin/orders" element={<OrderManagementScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openUndelivered() {
  const user = userEvent.setup();
  renderScreen();
  await user.click(screen.getByRole('button', { name: 'Undelivered' }));
  await waitFor(() => expect(within(screen.getByRole('table')).getByText('Rajesh Kumar')).toBeInTheDocument());
  return user;
}

const toggleFor = (orderId: string) => screen.getByRole('checkbox', { name: `Delivery today for order ${orderId}` });

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
  mocked.getTodayDeliveryOrdersWithPagination.mockResolvedValue(page([]) as never);
  mocked.getUndeliveredOrders.mockResolvedValue(page([LATER, TODAYS]) as never);
  mocked.getDeliveredOrders.mockResolvedValue(page([]) as never);
  mocked.getUnpaidOrders.mockResolvedValue(page([]) as never);
  mocked.updateOrderWithLoadmen.mockResolvedValue(undefined);
  mocked.deleteOrder.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('OrderManagementScreen', () => {
  describe('Delivery Today toggle on the Undelivered tab', () => {
    it('shows the toggle on for an order due today and off for one due later', async () => {
      await openUndelivered();

      expect(toggleFor('ord-1001')).not.toBeChecked();
      expect(toggleFor('ord-1002')).toBeChecked();
    });

    it('asks for confirmation instead of changing the date straight away', async () => {
      const user = await openUndelivered();

      await user.click(toggleFor('ord-1001'));

      const dialog = screen.getByRole('dialog', { name: 'Deliver Today' });
      expect(within(dialog).getByText('Are you sure you want to move the delivery of this order to today?')).toBeInTheDocument();
      expect(within(dialog).getByText('Order ID').nextSibling).toHaveTextContent('ord-1001');
      expect(within(dialog).getByRole('button', { name: 'Yes' })).toBeEnabled();
      expect(within(dialog).getByRole('button', { name: 'No' })).toBeEnabled();
      expect(mocked.updateOrderWithLoadmen).not.toHaveBeenCalled();
    });

    it('shows who the order is for, where it goes and how many bricks, so it can be checked', async () => {
      const user = await openUndelivered();

      await user.click(toggleFor('ord-1001'));

      const dialog = screen.getByRole('dialog', { name: 'Deliver Today' });
      expect(within(dialog).getByText('Customer').nextSibling).toHaveTextContent('Rajesh Kumar');
      expect(within(dialog).getByText('Phone').nextSibling).toHaveTextContent('9876543210');
      expect(within(dialog).getByText('Address').nextSibling).toHaveTextContent('12 MG Road, Coimbatore');
      expect(within(dialog).getByText('Brick quantity').nextSibling).toHaveTextContent('5,000');
    });

    it('shows a dash for a customer or address the order does not have', async () => {
      mocked.getUndeliveredOrders.mockResolvedValue(
        page([{ ...LATER, customers: undefined, location: '' }]) as never,
      );
      const user = userEvent.setup();
      renderScreen();
      await user.click(screen.getByRole('button', { name: 'Undelivered' }));
      await waitFor(() => expect(toggleFor('ord-1001')).toBeInTheDocument());

      await user.click(toggleFor('ord-1001'));

      const dialog = screen.getByRole('dialog', { name: 'Deliver Today' });
      expect(within(dialog).getByText('Customer').nextSibling).toHaveTextContent('-');
      expect(within(dialog).getByText('Phone').nextSibling).toHaveTextContent('-');
      expect(within(dialog).getByText('Address').nextSibling).toHaveTextContent('-');
    });

    it('moves the delivery to today and refreshes the list when confirmed', async () => {
      const user = await openUndelivered();
      mocked.getUndeliveredOrders.mockResolvedValue(page([{ ...LATER, delivery_date: TODAY }, TODAYS]) as never);

      await user.click(toggleFor('ord-1001'));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(mocked.updateOrderWithLoadmen).toHaveBeenCalledTimes(1);
      expect(mocked.updateOrderWithLoadmen).toHaveBeenCalledWith('ord-1001', { delivery_date: TODAY }, [], true);
      await waitFor(() => expect(toggleFor('ord-1001')).toBeChecked());
    });

    it('leaves the order alone when the confirmation is declined', async () => {
      const user = await openUndelivered();

      await user.click(toggleFor('ord-1001'));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'No' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mocked.updateOrderWithLoadmen).not.toHaveBeenCalled();
      expect(toggleFor('ord-1001')).not.toBeChecked();
    });

    it('does not ask for confirmation on an order already due today, and opens it instead', async () => {
      const user = await openUndelivered();

      await user.click(toggleFor('ord-1002'));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mocked.updateOrderWithLoadmen).not.toHaveBeenCalled();
      expect(screen.getByTestId('path')).toHaveTextContent('/admin/orders/ord-1002');
    });

    it('does not open the order when the toggle is clicked', async () => {
      const user = await openUndelivered();

      await user.click(toggleFor('ord-1001'));

      expect(screen.getByRole('heading', { name: 'Order Management' })).toBeInTheDocument();
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    });

    it('shows the error and closes the confirmation when the update fails', async () => {
      const user = await openUndelivered();
      mocked.updateOrderWithLoadmen.mockRejectedValue(new Error('Update rejected by the server'));

      await user.click(toggleFor('ord-1001'));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(screen.getByRole('heading', { name: 'Error' })).toBeInTheDocument());
      expect(screen.getAllByText('Update rejected by the server').length).toBeGreaterThan(0);
      expect(screen.queryByRole('dialog', { name: 'Deliver Today' })).not.toBeInTheDocument();
    });
  });

  describe('other tabs', () => {
    it('has no Delivery Today toggle on the Today tab', async () => {
      mocked.getTodayDeliveryOrdersWithPagination.mockResolvedValue(page([TODAYS]) as never);
      renderScreen();

      await waitFor(() => expect(within(screen.getByRole('table')).getByText('Priya Sharma')).toBeInTheDocument());
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });
});
