import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CreateOrderScreen } from './CreateOrderScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({
  searchCustomers: vi.fn(),
  getAllEmployees: vi.fn(),
  createOrder: vi.fn(),
  validateSession: vi.fn(),
  getUserProfile: vi.fn(),
}));

// The modal has its own tests; here it only has to hand a customer back, or be closed.
vi.mock('../../../../components/admin/CustomerCreationModal', () => ({
  CustomerCreationModal: ({ onClose, onCustomerCreated }: { onClose: () => void; onCustomerCreated: (c: unknown) => void }) => (
    <div role="dialog" aria-label="Customer Creation">
      <button onClick={() => onCustomerCreated(NEW_CUSTOMER)}>Pretend a customer was created</button>
      <button onClick={onClose}>Close customer creation</button>
    </div>
  ),
}));

const mocked = vi.mocked(middleware);

const TODAY = '2026-10-15';

const RAJU = { id: 'emp-1', name: 'Raju Kumar' };
const SURESH = { id: 'emp-2', name: 'Suresh Yadav' };

const ANITA = { id: 'cust-1', name: 'Anita Rao', phone: '9876543299', address: '9 Market Street, Salem', gst_number: '33ABCDE1234F1Z5', created_at: '' };
const MOHAN = { id: 'cust-2', name: 'Mohan Das', phone: '9876543288', address: '1 Lake Road, Erode', gst_number: null, created_at: '' };
const NEW_CUSTOMER = { id: 'cust-3', name: 'Priya Sharma', phone: '9876543277', address: '2 Hill Street, Ooty', gst_number: null, created_at: '' };

function Destination() {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin/orders/create']}>
      <Routes>
        <Route path="/admin/orders/create" element={<CreateOrderScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

type User = ReturnType<typeof userEvent.setup>;

const loadingType = () => screen.getByLabelText('Loading Type');
const loadman = (name: RegExp) => screen.getByRole('checkbox', { name });
const field = (label: RegExp | string) => screen.getByLabelText(label);
const create = () => screen.getByRole('button', { name: /^Creat(e|ing)\.{0,3}$/ });

async function pickCustomerFromTheModal(user: User) {
  await user.click(screen.getByRole('button', { name: 'Go to create customer' }));
  await user.click(screen.getByRole('button', { name: 'Pretend a customer was created' }));
}

async function pickDeliveryDate(user: User, day = '20') {
  await user.click(screen.getByRole('button', { name: /Select delivery date|, 20\d\d$/ }));
  await user.click(await screen.findByRole('gridcell', { name: day }));
}

/** Fills every required field with valid values. */
async function fillValidOrder(user: User) {
  await pickCustomerFromTheModal(user);
  await user.type(field(/^Brick Quantity/), '1000');
  await pickDeliveryDate(user);
  await user.type(field(/^Price Per Brick/), '8.5');
  await user.type(field(/^Location/), '12 MG Road, Coimbatore');
  await user.type(field(/^Final Price/), '9000');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T10:00:00Z`));
  mocked.getAllEmployees.mockResolvedValue([RAJU, SURESH] as never);
  mocked.searchCustomers.mockResolvedValue([] as never);
  mocked.validateSession.mockResolvedValue({ id: 'user-1' } as never);
  mocked.getUserProfile.mockResolvedValue({ role: 'ADMIN' } as never);
  mocked.createOrder.mockResolvedValue(undefined as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CreateOrderScreen', () => {
  describe('the form', () => {
    it('opens empty, with today\'s date fixed and the default loading type', async () => {
      renderScreen();

      expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument();
      expect(screen.getByText('Create a new customer order')).toBeInTheDocument();
      expect(field(/^Customer/)).toHaveValue('');
      expect(field(/^Brick Quantity/)).toHaveValue(null);
      expect(field(/^Price Per Brick/)).toHaveValue(null);
      expect(field(/^Location/)).toHaveValue('');
      expect(field(/^Final Price/)).toHaveValue(null);
      expect(field(/^GST Number/)).toHaveValue('');
      expect(field(/^Delivery Challan Number/)).toHaveValue('');
      expect(field('Date')).toHaveValue(TODAY);
      expect(field('Date')).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Select delivery date' })).toBeInTheDocument();
      expect(loadingType()).toHaveValue('LOADING_UNLOADING');
      expect(create()).toBeEnabled();
      await waitFor(() => expect(mocked.getAllEmployees).toHaveBeenCalledWith(true));
    });

    it('works out the paper price from the quantity and the price per brick', async () => {
      const user = userEvent.setup();
      renderScreen();
      expect(field('Paper Price')).toHaveValue('');
      expect(field('Paper Price')).toBeDisabled();

      await user.type(field(/^Brick Quantity/), '1000');
      expect(field('Paper Price')).toHaveValue('');
      await user.type(field(/^Price Per Brick/), '8.5');

      expect(field('Paper Price')).toHaveValue('₹8,500');
    });

    it('shows the price per brick that the final price works out to', async () => {
      const user = userEvent.setup();
      renderScreen();
      await user.type(field(/^Brick Quantity/), '1000');
      expect(screen.queryByText(/^Price per brick:/)).not.toBeInTheDocument();

      await user.type(field(/^Final Price/), '9000');

      expect(screen.getByText('Price per brick: ₹9.00')).toBeInTheDocument();
    });

    it('upper-cases the GST number and stops at 15 characters', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.type(field(/^GST Number/), '33abcde1234f1z5extra');

      expect(field(/^GST Number/)).toHaveValue('33ABCDE1234F1Z5');
    });

    it('goes back to the orders list', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole('button', { name: /Back to Orders/ }));

      expect(screen.getByTestId('path')).toHaveTextContent('/admin/orders');
    });
  });

  describe('the delivery date', () => {
    it('shows the date that was picked', async () => {
      const user = userEvent.setup();
      renderScreen();

      await pickDeliveryDate(user, '20');

      expect(screen.getByRole('button', { name: 'October 20th, 2026' })).toBeInTheDocument();
    });

    it('does not let a day before today be picked', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole('button', { name: 'Select delivery date' }));

      expect(await screen.findByRole('gridcell', { name: '14' })).toBeDisabled();
      expect(screen.getByRole('gridcell', { name: '15' })).toBeEnabled();
      expect(screen.getByRole('gridcell', { name: '16' })).toBeEnabled();
    });
  });

  describe('the customer', () => {
    it('searches by what is typed, once typing pauses, and lists the matches', async () => {
      mocked.searchCustomers.mockResolvedValue([ANITA, MOHAN] as never);
      const user = userEvent.setup();
      renderScreen();

      await user.type(field(/^Customer/), '9876');

      expect(await screen.findByRole('button', { name: '9876543299, Anita Rao' }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '9876543288, Mohan Das' })).toBeInTheDocument();
      expect(mocked.searchCustomers).toHaveBeenCalledTimes(1);
      expect(mocked.searchCustomers).toHaveBeenCalledWith('9876');
    });

    it('says it is searching while the search is under way', async () => {
      let finish: (value: unknown) => void = () => {};
      mocked.searchCustomers.mockReturnValue(new Promise((resolve) => (finish = resolve)) as never);
      const user = userEvent.setup();
      renderScreen();

      await user.type(field(/^Customer/), 'Anita');

      expect(await screen.findByText('Searching customers...', {}, { timeout: 4000 })).toBeInTheDocument();
      finish([ANITA]);
      expect(await screen.findByRole('button', { name: '9876543299, Anita Rao' })).toBeInTheDocument();
      expect(screen.queryByText('Searching customers...')).not.toBeInTheDocument();
    });

    it('fills in the customer that is picked from the matches, and its GST number', async () => {
      mocked.searchCustomers.mockResolvedValue([ANITA] as never);
      const user = userEvent.setup();
      renderScreen();
      await user.type(field(/^Customer/), 'Anita');

      await user.click(await screen.findByRole('button', { name: '9876543299, Anita Rao' }, { timeout: 4000 }));

      expect(field(/^Customer/)).toHaveValue('9876543299, Anita Rao');
      expect(field(/^GST Number/)).toHaveValue('33ABCDE1234F1Z5');
      expect(screen.queryByRole('button', { name: '9876543299, Anita Rao' })).not.toBeInTheDocument();
    });

    it('keeps a GST number already typed when the customer picked has none', async () => {
      const user = userEvent.setup();
      renderScreen();
      await user.type(field(/^GST Number/), '29aaaaa0000a1z5');

      await pickCustomerFromTheModal(user);

      expect(field(/^GST Number/)).toHaveValue('29AAAAA0000A1Z5');
    });

    it('lists nothing when the search fails', async () => {
      mocked.searchCustomers.mockRejectedValue(new Error('search failed'));
      const user = userEvent.setup();
      renderScreen();

      await user.type(field(/^Customer/), 'Anita');

      await waitFor(() => expect(mocked.searchCustomers).toHaveBeenCalled(), { timeout: 4000 });
      expect(screen.queryByRole('button', { name: /Anita/ })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Create Order' })).toBeInTheDocument();
    });

    it('forgets the customer when the search box is edited again', async () => {
      const user = userEvent.setup();
      renderScreen();
      await fillValidOrder(user);
      expect(field(/^Customer/)).toHaveValue('9876543277, Priya Sharma');

      await user.type(field(/^Customer/), 'x');
      await user.click(create());

      expect(screen.getByText('Customer is required')).toBeInTheDocument();
      expect(mocked.createOrder).not.toHaveBeenCalled();
    });

    it('opens the customer creation modal and picks the new customer', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole('button', { name: 'Go to create customer' }));
      expect(screen.getByRole('dialog', { name: 'Customer Creation' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Pretend a customer was created' }));

      expect(screen.queryByRole('dialog', { name: 'Customer Creation' })).not.toBeInTheDocument();
      expect(field(/^Customer/)).toHaveValue('9876543277, Priya Sharma');
    });

    it('closes the customer creation modal without picking anyone', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole('button', { name: 'Go to create customer' }));
      await user.click(screen.getByRole('button', { name: 'Close customer creation' }));

      expect(screen.queryByRole('dialog', { name: 'Customer Creation' })).not.toBeInTheDocument();
      expect(field(/^Customer/)).toHaveValue('');
    });
  });

  describe('validation', () => {
    it('lists every missing required field when an empty form is submitted, and does not create', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(create());

      expect(screen.getByText('Customer is required')).toBeInTheDocument();
      expect(screen.getByText('Brick quantity must be greater than 0')).toBeInTheDocument();
      expect(screen.getByText('Delivery date is required')).toBeInTheDocument();
      expect(screen.getByText('Price per brick must be greater than 0')).toBeInTheDocument();
      expect(screen.getByText('Delivery location is required')).toBeInTheDocument();
      expect(screen.getByText('Final price must be greater than 0')).toBeInTheDocument();
      expect(mocked.validateSession).not.toHaveBeenCalled();
      expect(mocked.createOrder).not.toHaveBeenCalled();
    });

    it('rejects a GST number that is not 15 characters', async () => {
      const user = userEvent.setup();
      renderScreen();
      await fillValidOrder(user);
      await user.type(field(/^GST Number/), '33ABCDE12');

      await user.click(create());

      expect(screen.getByText('GST Number must be exactly 15 characters')).toBeInTheDocument();
      expect(mocked.createOrder).not.toHaveBeenCalled();
    });

    it('names only the field that is wrong when the rest are filled', async () => {
      const user = userEvent.setup();
      renderScreen();
      await fillValidOrder(user);
      await user.clear(field(/^Location/));

      await user.click(create());

      expect(screen.getByText('Delivery location is required')).toBeInTheDocument();
      expect(screen.queryByText('Customer is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Brick quantity must be greater than 0')).not.toBeInTheDocument();
      expect(mocked.createOrder).not.toHaveBeenCalled();
    });

    it('does not show the failure popup for a validation error', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(create());

      expect(screen.queryByRole('heading', { name: 'Creation Failed' })).not.toBeInTheDocument();
    });
  });

  describe('creating the order', () => {
    it('sends the order with its loadmen and who created it, then confirms', async () => {
      const user = userEvent.setup();
      renderScreen();
      await fillValidOrder(user);
      await user.type(field(/^Delivery Challan Number/), 'DC-101');
      await user.type(field(/^GST Number/), '33abcde1234f1z5');
      await waitFor(() => expect(loadman(/Raju Kumar/)).toBeInTheDocument());
      await user.click(loadman(/Raju Kumar/));
      await user.selectOptions(loadingType(), 'LOADING_ONLY');

      await user.click(create());

      expect(await screen.findByRole('heading', { name: 'Order Placed Successfully' })).toBeInTheDocument();
      expect(screen.getByText('The order has been created successfully.')).toBeInTheDocument();
      expect(mocked.createOrder).toHaveBeenCalledTimes(1);
      expect(mocked.createOrder).toHaveBeenCalledWith(
        {
          customer_id: 'cust-3',
          order_date: TODAY,
          delivery_date: '2026-10-20',
          brick_quantity: 1000,
          price_per_brick: 8.5,
          paper_price: 8500,
          final_price: 9000,
          location: '12 MG Road, Coimbatore',
          payment_status: 'NOT_PAID',
          amount_paid: 0,
          gst_number: '33ABCDE1234F1Z5',
          dc_number: 'DC-101',
          loading_type: 'LOADING_ONLY',
        },
        ['emp-1'],
        'user-1',
      );
    });

    it('sends no GST number or challan number, and no loadmen, when none were entered', async () => {
      const user = userEvent.setup();
      renderScreen();
      await fillValidOrder(user);

      await user.click(create());

      await waitFor(() => expect(mocked.createOrder).toHaveBeenCalled());
      expect(mocked.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ gst_number: null, dc_number: null, loading_type: 'LOADING_UNLOADING' }),
        [],
        'user-1',
      );
    });

    it('sends no loadmen for customer self loading, even after some were ticked', async () => {
      const user = userEvent.setup();
      renderScreen();
      await fillValidOrder(user);
      await waitFor(() => expect(loadman(/Raju Kumar/)).toBeInTheDocument());
      await user.click(loadman(/Raju Kumar/));
      await user.selectOptions(loadingType(), 'CUSTOMER_SELF');

      await user.click(create());

      await waitFor(() => expect(mocked.createOrder).toHaveBeenCalled());
      expect(mocked.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ loading_type: 'CUSTOMER_SELF' }),
        [],
        'user-1',
      );
    });

    it('goes back to the orders list when the confirmation is closed', async () => {
      const user = userEvent.setup();
      renderScreen();
      await fillValidOrder(user);
      await user.click(create());

      await user.click(await screen.findByRole('button', { name: 'OK' }));

      expect(screen.getByTestId('path')).toHaveTextContent('/admin/orders');
    });

    it('disables Create and says Creating... while the order is being saved', async () => {
      let finish: () => void = () => {};
      mocked.createOrder.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)) as never);
      const user = userEvent.setup();
      renderScreen();
      await fillValidOrder(user);

      await user.click(create());

      expect(await screen.findByRole('button', { name: 'Creating...' })).toBeDisabled();
      finish();
      expect(await screen.findByRole('heading', { name: 'Order Placed Successfully' })).toBeInTheDocument();
    });

    it('shows why it failed in a popup and keeps the form for another try', async () => {
      mocked.createOrder.mockRejectedValue(new Error('Not enough stock for this order'));
      const user = userEvent.setup();
      renderScreen();
      await fillValidOrder(user);

      await user.click(create());

      expect(await screen.findByRole('heading', { name: 'Creation Failed' })).toBeInTheDocument();
      expect(screen.getByText('Not enough stock for this order')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Order Placed Successfully' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.queryByRole('heading', { name: 'Creation Failed' })).not.toBeInTheDocument();
      expect(field(/^Location/)).toHaveValue('12 MG Road, Coimbatore');
      expect(field(/^Final Price/)).toHaveValue(9000);
      expect(create()).toBeEnabled();
    });

    it('falls back to a general message when the failure has none', async () => {
      mocked.createOrder.mockRejectedValue(new Error(''));
      const user = userEvent.setup();
      renderScreen();
      await fillValidOrder(user);

      await user.click(create());

      expect(await screen.findByText('Failed to create order')).toBeInTheDocument();
    });

    it('can be tried again after a failure', async () => {
      mocked.createOrder.mockRejectedValueOnce(new Error('Temporary problem'));
      const user = userEvent.setup();
      renderScreen();
      await fillValidOrder(user);
      await user.click(create());
      await user.click(await screen.findByRole('button', { name: 'OK' }));

      await user.click(create());

      expect(await screen.findByRole('heading', { name: 'Order Placed Successfully' })).toBeInTheDocument();
      expect(mocked.createOrder).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the session or the role is not right', () => {
    it('sends the user to the login screen when there is no session', async () => {
      mocked.validateSession.mockResolvedValue(null as never);
      const user = userEvent.setup();
      renderScreen();
      await fillValidOrder(user);

      await user.click(create());

      expect(await screen.findByRole('heading', { name: 'Session Invalid' })).toBeInTheDocument();
      expect(screen.getByText('Your session is invalid or you do not have permission. Please log in as an admin.')).toBeInTheDocument();
      expect(mocked.createOrder).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.getByTestId('path')).toHaveTextContent('/admin/login');
    });

    it('does not let a user who is not an admin create an order', async () => {
      mocked.getUserProfile.mockResolvedValue({ role: 'EMPLOYEE' } as never);
      const user = userEvent.setup();
      renderScreen();
      await fillValidOrder(user);

      await user.click(create());

      expect(await screen.findByRole('heading', { name: 'Session Invalid' })).toBeInTheDocument();
      expect(mocked.getUserProfile).toHaveBeenCalledWith('user-1');
      expect(mocked.createOrder).not.toHaveBeenCalled();
    });

    it('stays on the form when the session check itself fails, and says so', async () => {
      mocked.validateSession.mockRejectedValue(new Error('Network down'));
      const user = userEvent.setup();
      renderScreen();
      await fillValidOrder(user);

      await user.click(create());

      expect(await screen.findByRole('heading', { name: 'Creation Failed' })).toBeInTheDocument();
      expect(screen.getByText('Network down')).toBeInTheDocument();
      expect(mocked.createOrder).not.toHaveBeenCalled();
    });
  });

  describe('loadmen and the loading type', () => {
    it('lists the loadmen, with none chosen, for the default loading type', async () => {
      renderScreen();

      await waitFor(() => expect(loadman(/Raju Kumar/)).not.toBeChecked());
      expect(loadman(/Suresh Yadav/)).not.toBeChecked();
      expect(loadingType()).toHaveValue('LOADING_UNLOADING');
    });

    it('ticks and unticks a loadman, and lists the ones ticked', async () => {
      const user = userEvent.setup();
      renderScreen();
      await waitFor(() => expect(loadman(/Raju Kumar/)).toBeInTheDocument());

      await user.click(loadman(/Raju Kumar/));
      await user.click(loadman(/Suresh Yadav/));
      expect(screen.getByText('Selected: Raju Kumar, Suresh Yadav')).toBeInTheDocument();

      await user.click(loadman(/Raju Kumar/));
      expect(loadman(/Raju Kumar/)).not.toBeChecked();
      expect(screen.getByText('Selected: Suresh Yadav')).toBeInTheDocument();
    });

    it('says there are no loadmen when there are none to list', async () => {
      mocked.getAllEmployees.mockResolvedValue([] as never);
      renderScreen();

      expect(await screen.findByText('No loadmen available')).toBeInTheDocument();
    });

    it('says there are no loadmen when the staff cannot be loaded', async () => {
      mocked.getAllEmployees.mockRejectedValue(new Error('staff failed'));
      renderScreen();

      expect(await screen.findByText('No loadmen available')).toBeInTheDocument();
    });

    it('hides the loadmen for customer self loading', async () => {
      const user = userEvent.setup();
      renderScreen();
      await waitFor(() => expect(loadman(/Raju Kumar/)).toBeInTheDocument());

      await user.selectOptions(loadingType(), 'CUSTOMER_SELF');

      expect(screen.queryByRole('checkbox', { name: /Raju Kumar/ })).not.toBeInTheDocument();
    });

    it('drops the chosen loadmen when switched to customer self loading', async () => {
      const user = userEvent.setup();
      renderScreen();
      await waitFor(() => expect(loadman(/Raju Kumar/)).toBeInTheDocument());
      await user.click(loadman(/Raju Kumar/));
      await user.click(loadman(/Suresh Yadav/));
      expect(screen.getByText('Selected: Raju Kumar, Suresh Yadav')).toBeInTheDocument();

      await user.selectOptions(loadingType(), 'CUSTOMER_SELF');
      await user.selectOptions(loadingType(), 'LOADING_ONLY');

      expect(loadman(/Raju Kumar/)).not.toBeChecked();
      expect(loadman(/Suresh Yadav/)).not.toBeChecked();
      expect(screen.queryByText(/^Selected:/)).not.toBeInTheDocument();
    });

    it('keeps the chosen loadmen when switched between the other loading types', async () => {
      const user = userEvent.setup();
      renderScreen();
      await waitFor(() => expect(loadman(/Raju Kumar/)).toBeInTheDocument());
      await user.click(loadman(/Raju Kumar/));

      await user.selectOptions(loadingType(), 'LOADING_ONLY');

      expect(loadman(/Raju Kumar/)).toBeChecked();
      expect(loadman(/Suresh Yadav/)).not.toBeChecked();
      expect(screen.getByText('Selected: Raju Kumar')).toBeInTheDocument();
    });
  });

  describe('known gaps', () => {
    // The "No customers found" line is only drawn inside a box that is itself only drawn when
    // there are matches or a search is running, so it can never appear.
    it.fails('says so when a search finds no customer', async () => {
      mocked.searchCustomers.mockResolvedValue([] as never);
      const user = userEvent.setup();
      renderScreen();

      await user.type(field(/^Customer/), '1234567890');
      await waitFor(() => expect(mocked.searchCustomers).toHaveBeenCalled(), { timeout: 4000 });

      expect(await screen.findByText('No customers found', {}, { timeout: 500 })).toBeInTheDocument();
    });
  });
});
