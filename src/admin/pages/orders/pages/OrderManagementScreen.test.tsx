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

  describe('Delivery Today toggle: while saving and on odd failures', () => {
    it('disables both buttons and says Updating... while the date is being saved', async () => {
      const user = await openUndelivered();
      let finish: () => void = () => {};
      mocked.updateOrderWithLoadmen.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)) as never);

      await user.click(toggleFor('ord-1001'));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes' }));

      const dialog = screen.getByRole('dialog', { name: 'Deliver Today' });
      expect(within(dialog).getByRole('button', { name: 'Updating...' })).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: 'No' })).toBeDisabled();
      finish();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('falls back to a general message when the failure has none', async () => {
      const user = await openUndelivered();
      mocked.updateOrderWithLoadmen.mockRejectedValue('nope');

      await user.click(toggleFor('ord-1001'));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(screen.getByRole('heading', { name: 'Error' })).toBeInTheDocument());
      expect(screen.getAllByText('Failed to update order').length).toBeGreaterThan(0);
    });
  });

  describe('deleting an undelivered order', () => {
    const deleteButtons = () => within(screen.getByRole('table')).getAllByRole('button', { name: 'Delete order' });

    it('has a delete button for every order on the Undelivered tab', async () => {
      await openUndelivered();

      expect(deleteButtons()).toHaveLength(2);
    });

    it('asks for confirmation, naming the order, before deleting', async () => {
      const user = await openUndelivered();

      await user.click(deleteButtons()[0]);

      expect(screen.getByRole('heading', { name: 'Delete Order' })).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete order/)).toHaveTextContent('ord-1001');
      expect(screen.getByText(/This action cannot be undone\./)).toBeInTheDocument();
      expect(mocked.deleteOrder).not.toHaveBeenCalled();
    });

    it('does not open the order when the delete button is clicked', async () => {
      const user = await openUndelivered();

      await user.click(deleteButtons()[0]);

      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    });

    it('leaves the order alone when the confirmation is declined', async () => {
      const user = await openUndelivered();

      await user.click(deleteButtons()[0]);
      await user.click(screen.getByRole('button', { name: 'No' }));

      expect(screen.queryByRole('heading', { name: 'Delete Order' })).not.toBeInTheDocument();
      expect(mocked.deleteOrder).not.toHaveBeenCalled();
      expect(within(screen.getByRole('table')).getByText('Rajesh Kumar')).toBeInTheDocument();
    });

    it('deletes the order and reloads the list from the first page when confirmed', async () => {
      const user = await openUndelivered();
      mocked.getUndeliveredOrders.mockResolvedValue(page([TODAYS]) as never);

      await user.click(deleteButtons()[0]);
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Delete Order' })).not.toBeInTheDocument());
      expect(mocked.deleteOrder).toHaveBeenCalledTimes(1);
      expect(mocked.deleteOrder).toHaveBeenCalledWith('ord-1001');
      await waitFor(() => expect(within(screen.getByRole('table')).queryByText('Rajesh Kumar')).not.toBeInTheDocument());
      expect(within(screen.getByRole('table')).getByText('Priya Sharma')).toBeInTheDocument();
      expect(mocked.getUndeliveredOrders).toHaveBeenLastCalledWith(0);
    });

    it('deletes the right order when it is not the first', async () => {
      const user = await openUndelivered();

      await user.click(deleteButtons()[1]);
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(mocked.deleteOrder).toHaveBeenCalledWith('ord-1002'));
    });

    it('disables Yes and says Deleting... while the order is being deleted', async () => {
      const user = await openUndelivered();
      let finish: () => void = () => {};
      mocked.deleteOrder.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)) as never);

      await user.click(deleteButtons()[0]);
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
      finish();
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Delete Order' })).not.toBeInTheDocument());
    });

    it('shows the error and closes the confirmation when the delete fails', async () => {
      const user = await openUndelivered();
      mocked.deleteOrder.mockRejectedValue(new Error('Only administrators can delete orders'));

      await user.click(deleteButtons()[0]);
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(screen.getByRole('heading', { name: 'Error' })).toBeInTheDocument());
      expect(screen.getAllByText('Only administrators can delete orders').length).toBeGreaterThan(0);
      expect(screen.queryByRole('heading', { name: 'Delete Order' })).not.toBeInTheDocument();
    });

    it('falls back to a general message when the failure has none', async () => {
      const user = await openUndelivered();
      mocked.deleteOrder.mockRejectedValue('nope');

      await user.click(deleteButtons()[0]);
      await user.click(screen.getByRole('button', { name: 'Yes' }));

      await waitFor(() => expect(screen.getAllByText('Failed to delete order').length).toBeGreaterThan(0));
    });

    it.each(['Today', 'Delivered', 'Unpaid'])('has no delete button on the %s tab', async (tab) => {
      mocked.getTodayDeliveryOrdersWithPagination.mockResolvedValue(page([LATER]) as never);
      mocked.getDeliveredOrders.mockResolvedValue(page([LATER]) as never);
      mocked.getUnpaidOrders.mockResolvedValue(page([LATER]) as never);
      const user = userEvent.setup();
      renderScreen();
      await user.click(screen.getByRole('button', { name: tab }));
      await waitFor(() => expect(within(screen.getByRole('table')).getByText('Rajesh Kumar')).toBeInTheDocument());

      expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
    });
  });

  describe('the tabs', () => {
    it('opens on the Today tab and loads the first page of today\'s deliveries', async () => {
      renderScreen();

      await waitFor(() => expect(mocked.getTodayDeliveryOrdersWithPagination).toHaveBeenCalledWith(0));
      expect(mocked.getUndeliveredOrders).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'Order Management' })).toBeInTheDocument();
      expect(screen.getByText('Manage all customer orders')).toBeInTheDocument();
      for (const tab of ['Today', 'Undelivered', 'Delivered', 'Unpaid']) {
        expect(screen.getByRole('button', { name: tab })).toBeInTheDocument();
      }
    });

    it.each([
      ['Undelivered', () => mocked.getUndeliveredOrders],
      ['Delivered', () => mocked.getDeliveredOrders],
      ['Unpaid', () => mocked.getUnpaidOrders],
    ])('loads the first page of the right list when the %s tab is opened', async (tab, service) => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole('button', { name: tab }));

      await waitFor(() => expect(service()).toHaveBeenCalledWith(0));
    });

    it('replaces the list when another tab is opened', async () => {
      mocked.getTodayDeliveryOrdersWithPagination.mockResolvedValue(page([TODAYS]) as never);
      mocked.getDeliveredOrders.mockResolvedValue(page([{ ...LATER, delivered: true }]) as never);
      const user = userEvent.setup();
      renderScreen();
      await waitFor(() => expect(within(screen.getByRole('table')).getByText('Priya Sharma')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: 'Delivered' }));

      await waitFor(() => expect(within(screen.getByRole('table')).getByText('Rajesh Kumar')).toBeInTheDocument());
      expect(within(screen.getByRole('table')).queryByText('Priya Sharma')).not.toBeInTheDocument();
    });

    it('has no Delivery Today toggle on the Today tab', async () => {
      mocked.getTodayDeliveryOrdersWithPagination.mockResolvedValue(page([TODAYS]) as never);
      renderScreen();

      await waitFor(() => expect(within(screen.getByRole('table')).getByText('Priya Sharma')).toBeInTheDocument());
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });

  describe('the list', () => {
    const headers = () => within(screen.getByRole('table')).getAllByRole('columnheader').map((h) => h.textContent);
    const BASE = ['Order ID', 'Date', 'Delivery Date', 'Customer', 'Phone', 'Quantity', 'Final Price', 'Payment'];

    it('says Loading orders... until the first page arrives', async () => {
      let finish: (value: unknown) => void = () => {};
      mocked.getTodayDeliveryOrdersWithPagination.mockReturnValue(new Promise((resolve) => (finish = resolve)) as never);
      renderScreen();

      expect(screen.getByText('Loading orders...')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();

      finish(page([TODAYS]));
      await waitFor(() => expect(screen.queryByText('Loading orders...')).not.toBeInTheDocument());
    });

    it('says there are no orders when the list is empty', async () => {
      renderScreen();

      expect(await screen.findByText('No orders at the moment')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('shows each order\'s id, customer, phone, quantity, price and payment', async () => {
      mocked.getTodayDeliveryOrdersWithPagination.mockResolvedValue(page([TODAYS]) as never);
      renderScreen();

      const table = await screen.findByRole('table');
      const row = within(table).getByRole('row', { name: /ord-1002/ });
      expect(within(row).getByText('Priya Sharma')).toBeInTheDocument();
      expect(within(row).getByText('9876543210')).toBeInTheDocument();
      expect(within(row).getByText('5,000')).toBeInTheDocument();
      expect(within(row).getByText('₹40,000')).toBeInTheDocument();
      expect(within(row).getByText('Not Paid')).toBeInTheDocument();
    });

    it.each([
      ['NOT_PAID', 'Not Paid'],
      ['PARTIALLY_PAID', 'Partially Paid'],
      ['FULLY_PAID', 'Fully Paid'],
    ])('labels a %s order as %s', async (status, label) => {
      mocked.getTodayDeliveryOrdersWithPagination.mockResolvedValue(page([{ ...TODAYS, payment_status: status }]) as never);
      renderScreen();

      const table = await screen.findByRole('table');
      expect(within(table).getByText(label)).toBeInTheDocument();
    });

    it('shows a dash for a customer or phone the order does not have', async () => {
      mocked.getTodayDeliveryOrdersWithPagination.mockResolvedValue(page([{ ...TODAYS, customers: undefined }]) as never);
      renderScreen();

      const row = within(await screen.findByRole('table')).getByRole('row', { name: /ord-1002/ });
      expect(within(row).getAllByText('-')).toHaveLength(2);
    });

    it('marks an undelivered order past its delivery date as overdue, and others not', async () => {
      const overdue = order('ord-0900', '2026-10-10', 'Late Customer');
      mocked.getTodayDeliveryOrdersWithPagination.mockResolvedValue(page([overdue, TODAYS, LATER]) as never);
      renderScreen();

      const table = await screen.findByRole('table');
      expect(within(table).getByRole('row', { name: /ord-0900/ })).toHaveClass('text-red-600');
      expect(within(table).getByRole('row', { name: /ord-1002/ })).not.toHaveClass('text-red-600');
      expect(within(table).getByRole('row', { name: /ord-1001/ })).not.toHaveClass('text-red-600');
    });

    it('does not mark a delivered order as overdue', async () => {
      const delivered = { ...order('ord-0900', '2026-10-10', 'Done Customer'), delivered: true };
      mocked.getDeliveredOrders.mockResolvedValue(page([delivered]) as never);
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole('button', { name: 'Delivered' }));

      const row = within(await screen.findByRole('table')).getByRole('row', { name: /ord-0900/ });
      expect(row).not.toHaveClass('text-red-600');
    });

    it('shows the basic columns on the Today and Unpaid tabs', async () => {
      mocked.getTodayDeliveryOrdersWithPagination.mockResolvedValue(page([TODAYS]) as never);
      mocked.getUnpaidOrders.mockResolvedValue(page([LATER]) as never);
      const user = userEvent.setup();
      renderScreen();
      await screen.findByRole('table');
      expect(headers()).toEqual(BASE);

      await user.click(screen.getByRole('button', { name: 'Unpaid' }));
      await waitFor(() => expect(within(screen.getByRole('table')).getByText('Rajesh Kumar')).toBeInTheDocument());
      expect(headers()).toEqual(BASE);
    });

    it('adds the Delivery Today and Actions columns on the Undelivered tab', async () => {
      await openUndelivered();

      expect(headers()).toEqual([...BASE, 'Delivery Today', 'Actions']);
    });

    it('adds the DC No column on the Delivered tab, with a dash when there is none', async () => {
      mocked.getDeliveredOrders.mockResolvedValue(
        page([
          { ...TODAYS, delivered: true, dc_number: 'DC-77' },
          { ...LATER, delivered: true, dc_number: null },
        ]) as never,
      );
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole('button', { name: 'Delivered' }));

      const table = await screen.findByRole('table');
      expect(headers()).toEqual([...BASE, 'DC No']);
      expect(within(within(table).getByRole('row', { name: /ord-1002/ })).getByText('DC-77')).toBeInTheDocument();
      expect(within(within(table).getByRole('row', { name: /ord-1001/ })).getAllByRole('cell').at(-1)).toHaveTextContent('-');
    });
  });

  describe('loading more orders', () => {
    const more = (hasMore: boolean, data: unknown[]) => ({ data, total: 99, hasMore });

    it('has no Load More button when everything fits on one page', async () => {
      mocked.getTodayDeliveryOrdersWithPagination.mockResolvedValue(page([TODAYS]) as never);
      renderScreen();

      await screen.findByRole('table');
      expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
    });

    it('adds the next page below the orders already shown', async () => {
      mocked.getTodayDeliveryOrdersWithPagination
        .mockResolvedValueOnce(more(true, [TODAYS]) as never)
        .mockResolvedValueOnce(more(false, [order('ord-1003', TODAY, 'Meena Iyer')]) as never);
      const user = userEvent.setup();
      renderScreen();

      await user.click(await screen.findByRole('button', { name: 'Load More' }));

      await waitFor(() => expect(within(screen.getByRole('table')).getByText('Meena Iyer')).toBeInTheDocument());
      expect(mocked.getTodayDeliveryOrdersWithPagination).toHaveBeenLastCalledWith(1);
      expect(within(screen.getByRole('table')).getByText('Priya Sharma')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
    });

    it('keeps offering Load More while there are more pages, asking for each page in turn', async () => {
      mocked.getTodayDeliveryOrdersWithPagination
        .mockResolvedValueOnce(more(true, [TODAYS]) as never)
        .mockResolvedValueOnce(more(true, [order('ord-1003', TODAY, 'Meena Iyer')]) as never)
        .mockResolvedValueOnce(more(false, [order('ord-1004', TODAY, 'Karthik Raja')]) as never);
      const user = userEvent.setup();
      renderScreen();

      await user.click(await screen.findByRole('button', { name: 'Load More' }));
      await waitFor(() => expect(within(screen.getByRole('table')).getByText('Meena Iyer')).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'Load More' }));

      await waitFor(() => expect(within(screen.getByRole('table')).getByText('Karthik Raja')).toBeInTheDocument());
      expect(mocked.getTodayDeliveryOrdersWithPagination).toHaveBeenNthCalledWith(3, 2);
    });

    it('starts again from the first page when the tab is changed and changed back', async () => {
      mocked.getTodayDeliveryOrdersWithPagination.mockResolvedValue(more(true, [TODAYS]) as never);
      const user = userEvent.setup();
      renderScreen();
      await user.click(await screen.findByRole('button', { name: 'Load More' }));
      await waitFor(() => expect(mocked.getTodayDeliveryOrdersWithPagination).toHaveBeenLastCalledWith(1));

      await user.click(screen.getByRole('button', { name: 'Delivered' }));
      await user.click(screen.getByRole('button', { name: 'Today' }));

      await waitFor(() => expect(mocked.getTodayDeliveryOrdersWithPagination).toHaveBeenLastCalledWith(0));
    });
  });

  describe('known gaps', () => {
    // currentPage is only updated once a page has arrived, so while page 2 is loading the screen
    // still believes it is on page 0 and swaps the whole list for "Loading orders...".
    it.fails('keeps the orders on screen, and the button disabled and saying Loading..., while the next page is coming', async () => {
      let finish: (value: unknown) => void = () => {};
      mocked.getTodayDeliveryOrdersWithPagination
        .mockResolvedValueOnce(more(true, [TODAYS]) as never)
        .mockReturnValueOnce(new Promise((resolve) => (finish = resolve)) as never);
      const user = userEvent.setup();
      renderScreen();

      await user.click(await screen.findByRole('button', { name: 'Load More' }));

      expect(await screen.findByRole('button', { name: 'Loading...' })).toBeDisabled();
      expect(within(screen.getByRole('table')).getByText('Priya Sharma')).toBeInTheDocument();
      finish(more(false, []));
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Loading...' })).not.toBeInTheDocument());
    });
  });

  describe('when the orders cannot be loaded', () => {
    it('shows the error in a popup and on the page', async () => {
      mocked.getTodayDeliveryOrdersWithPagination.mockRejectedValue(new Error('orders failed'));
      renderScreen();

      expect(await screen.findByRole('heading', { name: 'Error' })).toBeInTheDocument();
      expect(screen.getAllByText('orders failed')).toHaveLength(2);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('falls back to a general message when the failure has none', async () => {
      mocked.getTodayDeliveryOrdersWithPagination.mockRejectedValue('nope');
      renderScreen();

      await waitFor(() => expect(screen.getAllByText('Failed to fetch orders').length).toBeGreaterThan(0));
    });

    it('closes the popup with OK', async () => {
      mocked.getTodayDeliveryOrdersWithPagination.mockRejectedValue(new Error('orders failed'));
      const user = userEvent.setup();
      renderScreen();

      await user.click(await screen.findByRole('button', { name: 'OK' }));

      expect(screen.queryByRole('heading', { name: 'Error' })).not.toBeInTheDocument();
    });

    it('lets another tab load normally afterwards', async () => {
      mocked.getTodayDeliveryOrdersWithPagination.mockRejectedValue(new Error('orders failed'));
      const user = userEvent.setup();
      renderScreen();
      await user.click(await screen.findByRole('button', { name: 'OK' }));

      await user.click(screen.getByRole('button', { name: 'Undelivered' }));

      await waitFor(() => expect(within(screen.getByRole('table')).getByText('Rajesh Kumar')).toBeInTheDocument());
      expect(screen.queryByRole('heading', { name: 'Error' })).not.toBeInTheDocument();
    });
  });

  describe('moving around', () => {
    it('opens an order when its row is clicked', async () => {
      mocked.getTodayDeliveryOrdersWithPagination.mockResolvedValue(page([TODAYS]) as never);
      const user = userEvent.setup();
      renderScreen();

      await user.click(within(await screen.findByRole('table')).getByText('Priya Sharma'));

      expect(screen.getByTestId('path')).toHaveTextContent('/admin/orders/ord-1002');
    });

    it('opens the Create Order screen', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole('button', { name: /Create Order/ }));

      expect(screen.getByTestId('path')).toHaveTextContent('/admin/orders/create');
    });

    it('goes back to the admin home', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole('button', { name: /Back to Home/ }));

      expect(screen.getByTestId('path')).toHaveTextContent('/admin/home');
    });
  });
});
