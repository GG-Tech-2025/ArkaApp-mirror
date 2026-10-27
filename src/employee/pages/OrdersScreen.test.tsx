import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { OrdersScreen } from './OrdersScreen';
import * as middleware from '../../services/middleware.service';

// Wraps useNavigate so tests can count how many times the screen navigates.
const navigateSpy = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => {
      const navigate = actual.useNavigate();
      return (to: string) => {
        navigateSpy(to);
        navigate(to);
      };
    },
  };
});

vi.mock('../../services/middleware.service', () => ({
  getTodayDeliveryOrders: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const ORDERS = [
  {
    id: 'ord-1001',
    brick_quantity: 5000,
    final_price: 40000,
    location: '12 MG Road, Coimbatore',
    customers: { name: 'Rajesh Kumar', phone: '9876543210' },
  },
  {
    id: 'ord-1002',
    brick_quantity: 3000,
    final_price: 24000,
    location: '45 Brigade Road, Erode',
    customers: { name: 'Priya Sharma', phone: '9876543211' },
  },
];

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/employee/orders']}>
      <Routes>
        <Route path="/employee/orders" element={<OrdersScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const card = (name: string) => screen.getByRole('button', { name: new RegExp(name) });

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getTodayDeliveryOrders.mockResolvedValue(ORDERS as never);
});

describe('OrdersScreen (Undelivered Orders)', () => {
  describe('loading', () => {
    it('shows a loading message until the orders arrive', async () => {
      mocked.getTodayDeliveryOrders.mockReturnValue(new Promise(() => {}));
      renderScreen();

      expect(screen.getByText('Loading orders...')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Undelivered Orders' })).not.toBeInTheDocument();
    });

    it('asks for the orders once', async () => {
      renderScreen();
      await screen.findByRole('heading', { name: 'Undelivered Orders' });

      expect(mocked.getTodayDeliveryOrders).toHaveBeenCalledTimes(1);
    });

    it('replaces the loading message with the list', async () => {
      renderScreen();

      expect(await screen.findByRole('heading', { name: 'Undelivered Orders' })).toBeInTheDocument();
      expect(screen.queryByText('Loading orders...')).not.toBeInTheDocument();
    });
  });

  describe('the list', () => {
    it('shows the heading and its instruction', async () => {
      renderScreen();

      expect(await screen.findByRole('heading', { name: 'Undelivered Orders' })).toBeInTheDocument();
      expect(screen.getByText('Select an order to enter delivery details')).toBeInTheDocument();
    });

    it('shows one card per order, in the order received', async () => {
      renderScreen();
      await screen.findByRole('heading', { name: 'Undelivered Orders' });

      const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
      expect(names).toEqual(['Rajesh Kumar', 'Priya Sharma']);
    });

    it('shows each order\'s id, phone, quantity, location and amount', async () => {
      renderScreen();
      await screen.findByRole('heading', { name: 'Undelivered Orders' });

      const first = card('Rajesh Kumar');
      expect(first).toHaveTextContent('Order ID: ord-1001');
      expect(first).toHaveTextContent('9876543210');
      expect(first).toHaveTextContent('5000 bricks');
      expect(first).toHaveTextContent('12 MG Road, Coimbatore');
      expect(first).toHaveTextContent('₹40000');

      const second = card('Priya Sharma');
      expect(second).toHaveTextContent('Order ID: ord-1002');
      expect(second).toHaveTextContent('3000 bricks');
      expect(second).toHaveTextContent('₹24000');
    });

    it('marks every order as Pending Delivery', async () => {
      renderScreen();
      await screen.findByRole('heading', { name: 'Undelivered Orders' });

      expect(screen.getAllByText('Pending Delivery')).toHaveLength(2);
    });

    it('does not show the empty message when there are orders', async () => {
      renderScreen();
      await screen.findByRole('heading', { name: 'Undelivered Orders' });

      expect(screen.queryByText('No orders assigned for delivery.')).not.toBeInTheDocument();
    });

    it('still renders an order whose customer details are missing', async () => {
      mocked.getTodayDeliveryOrders.mockResolvedValue([{ ...ORDERS[0], customers: undefined }] as never);
      renderScreen();

      expect(await screen.findByText('Order ID: ord-1001')).toBeInTheDocument();
    });

    it('shows a single order on its own', async () => {
      mocked.getTodayDeliveryOrders.mockResolvedValue([ORDERS[1]] as never);
      renderScreen();
      await screen.findByRole('heading', { name: 'Undelivered Orders' });

      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
      expect(screen.queryByText('Rajesh Kumar')).not.toBeInTheDocument();
    });

    it('copes with a long list', async () => {
      const many = Array.from({ length: 40 }, (_, i) => ({
        ...ORDERS[0],
        id: `ord-${i}`,
        customers: { name: `Customer ${i}`, phone: '9000000000' },
      }));
      mocked.getTodayDeliveryOrders.mockResolvedValue(many as never);
      renderScreen();
      await screen.findByRole('heading', { name: 'Undelivered Orders' });

      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(40);
    });
  });

  describe('when there is nothing to deliver', () => {
    beforeEach(() => {
      mocked.getTodayDeliveryOrders.mockResolvedValue([]);
    });

    it('says no orders are assigned', async () => {
      renderScreen();

      expect(await screen.findByText('No orders assigned for delivery.')).toBeInTheDocument();
      expect(screen.queryByText('Pending Delivery')).not.toBeInTheDocument();
    });

    it('still offers Back to Home', async () => {
      const user = userEvent.setup();
      renderScreen();
      await screen.findByText('No orders assigned for delivery.');

      await user.click(screen.getByRole('button', { name: /Back to Home/ }));

      expect(screen.getByTestId('path')).toHaveTextContent('/employee/home');
    });
  });

  describe('when the orders cannot be loaded', () => {
    beforeEach(() => {
      mocked.getTodayDeliveryOrders.mockRejectedValue(new Error('network down'));
    });

    it('shows a plain error message and no list', async () => {
      renderScreen();

      expect(await screen.findByText('Failed to load orders')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Undelivered Orders' })).not.toBeInTheDocument();
      expect(screen.queryByText('No orders assigned for delivery.')).not.toBeInTheDocument();
    });

    it('does not leak the technical reason', async () => {
      renderScreen();
      await screen.findByText('Failed to load orders');

      expect(screen.queryByText(/network down/)).not.toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('goes back to the home screen from Back to Home', async () => {
      const user = userEvent.setup();
      renderScreen();
      await screen.findByRole('heading', { name: 'Undelivered Orders' });

      await user.click(screen.getByRole('button', { name: /Back to Home/ }));

      expect(screen.getByTestId('path')).toHaveTextContent('/employee/home');
    });

    it.each([
      ['Rajesh Kumar', '/employee/orders/ord-1001/delivery'],
      ['Priya Sharma', '/employee/orders/ord-1002/delivery'],
    ])('opens the delivery entry for %s\'s order when its card is clicked', async (name, path) => {
      const user = userEvent.setup();
      renderScreen();
      await screen.findByRole('heading', { name: 'Undelivered Orders' });

      await user.click(card(name));

      expect(screen.getByTestId('path').textContent).toBe(path);
    });

    it('opens the delivery entry when the Select Order link is clicked', async () => {
      const user = userEvent.setup();
      renderScreen();
      await screen.findByRole('heading', { name: 'Undelivered Orders' });

      await user.click(within(card('Priya Sharma')).getByText('Select Order →'));

      expect(screen.getByTestId('path').textContent).toBe('/employee/orders/ord-1002/delivery');
    });

    it('can open an order from the keyboard', async () => {
      const user = userEvent.setup();
      renderScreen();
      await screen.findByRole('heading', { name: 'Undelivered Orders' });

      card('Rajesh Kumar').focus();
      await user.keyboard('{Enter}');

      expect(screen.getByTestId('path').textContent).toBe('/employee/orders/ord-1001/delivery');
    });

    it('navigates once when a card is clicked', async () => {
      const user = userEvent.setup();
      renderScreen();
      await screen.findByRole('heading', { name: 'Undelivered Orders' });

      await user.click(card('Rajesh Kumar'));

      expect(navigateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('opening an order from the Select Order link', () => {
    it('navigates once, not twice', async () => {
      const user = userEvent.setup();
      renderScreen();
      await screen.findByRole('heading', { name: 'Undelivered Orders' });

      await user.click(within(card('Rajesh Kumar')).getByText('Select Order →'));

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith('/employee/orders/ord-1001/delivery');
    });
  });

  describe('a way back from the error screen', () => {
    it('offers Back to Home when the orders cannot be loaded', async () => {
      const user = userEvent.setup();
      mocked.getTodayDeliveryOrders.mockRejectedValue(new Error('network down'));
      renderScreen();
      await screen.findByText('Failed to load orders');

      await user.click(screen.getByRole('button', { name: /Back to Home/ }));

      expect(screen.getByTestId('path')).toHaveTextContent('/employee/home');
    });
  });
});
