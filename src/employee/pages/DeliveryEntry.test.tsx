import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { DeliveryEntry } from './DeliveryEntry';
import * as middleware from '../../services/middleware.service';

vi.mock('../../services/middleware.service', () => ({
  getOrderWithLoadmen: vi.fn(),
  getDeliveryStaff: vi.fn(),
  getAppSettings: vi.fn(),
  completeDelivery: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const role = (name: string, noLoadingSalary: boolean) => ({
  id: `role-${name}`,
  name,
  category: 'DAILY',
  salary_value: 500,
  no_loading_salary: noLoadingSalary,
});

const STAFF = [
  { id: 'emp-ravi', name: 'Ravi', phone: '1', role_id: 'r1', roles: role('Loader', false) },
  { id: 'emp-kumar', name: 'Kumar', phone: '2', role_id: 'r1', roles: role('Loader', false) },
  { id: 'emp-ram', name: 'Operator Ram', phone: '3', role_id: 'r2', roles: role('Operator', true) },
];

const ORDER = {
  id: 'ord-1001',
  customer_id: 'cust-1',
  delivery_date: '2026-10-15',
  brick_quantity: 5000,
  final_price: 40000,
  location: '12 MG Road, Coimbatore',
  payment_status: 'NOT_PAID',
  loading_type: 'LOADING_UNLOADING',
  amount_paid: 0,
  gst_number: '33ABCDE1234F1Z5',
  dc_number: null,
  delivered: false,
  time: null,
  customers: { name: 'Rajesh Kumar', phone: '9876543210' },
  loadmen: [] as Array<{ id: string }>,
};

const DELIVERED_ORDER = {
  ...ORDER,
  id: 'ord-0999',
  delivered: true,
  dc_number: 'DC-77',
  time: '10:00 AM',
  loading_type: 'LOADING_ONLY',
  payment_status: 'FULLY_PAID',
  amount_paid: 40000,
  loadmen: [{ id: 'emp-ravi' }],
};

const PRICE_SETTING = [{ key: 'LOADING_AND_UNLOADING_PRICE_PER_BRICK', value: '2' }];

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen(orderId = 'ord-1001') {
  return render(
    <MemoryRouter initialEntries={[`/employee/orders/${orderId}/delivery`]}>
      <Routes>
        <Route path="/employee/orders/:orderId/delivery" element={<DeliveryEntry />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const timeField = () => screen.getByLabelText(/^Time/);
const locationField = () => screen.getByLabelText(/^Location/);
const challanField = () => screen.getByLabelText(/^Delivery Challan Number/);
const loadingTypeField = () => screen.getByLabelText(/^Loading Type/);
const submitButton = () => screen.getByRole('button', { name: /Submit/ });
const loadman = (name: string) => screen.getByRole('checkbox', { name });

type User = ReturnType<typeof userEvent.setup>;

async function loaded(orderId = 'ord-1001') {
  await waitFor(() => expect(screen.getByLabelText('Order ID')).toHaveValue(orderId));
  await screen.findByRole('checkbox', { name: 'Ravi' }).catch(() => undefined);
}

async function fillRequired(user: User) {
  await user.selectOptions(timeField(), '10:00 AM');
  await user.type(challanField(), 'DC-1');
}

async function readyToSubmit(user: User, ...names: string[]) {
  renderScreen();
  await loaded();
  await fillRequired(user);
  for (const name of names) await user.click(loadman(name));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocked.getOrderWithLoadmen.mockImplementation(async (id: string) =>
    (id === 'ord-0999' ? DELIVERED_ORDER : ORDER) as never,
  );
  mocked.getDeliveryStaff.mockResolvedValue(STAFF as never);
  mocked.getAppSettings.mockResolvedValue(PRICE_SETTING as never);
  mocked.completeDelivery.mockResolvedValue(undefined);
});

describe('DeliveryEntry (the update screen for an undelivered order)', () => {
  describe('what is shown', () => {
    it('shows the heading for entering delivery details', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByRole('heading', { name: 'Delivery Entry' })).toBeInTheDocument();
      expect(screen.getByText('Enter the delivery details')).toBeInTheDocument();
      expect(screen.queryByText('This order has been delivered and cannot be edited.')).not.toBeInTheDocument();
    });

    it('looks up the order that is in the address', async () => {
      renderScreen('ord-1001');
      await loaded();

      expect(mocked.getOrderWithLoadmen).toHaveBeenCalledWith('ord-1001');
    });

    it('shows the order\'s fixed details in read-only fields', async () => {
      renderScreen();
      await loaded();

      const readOnly: Array<[string, string]> = [
        ['Order ID', 'ord-1001'],
        ['Customer Number', '9876543210'],
        ['Customer Name', 'Rajesh Kumar'],
        ['Date', '2026-10-15'],
        ['Quantity (bricks)', '5000'],
        ['Actual Amount', '₹40000'],
      ];
      for (const [label, value] of readOnly) {
        expect(screen.getByLabelText(label)).toHaveValue(value === '5000' ? 5000 : value);
        expect(screen.getByLabelText(label)).toBeDisabled();
      }
    });

    it('shows the order\'s GST number, read-only', async () => {
      renderScreen();
      await loaded();

      expect(screen.getByLabelText('GST Number')).toHaveValue('33ABCDE1234F1Z5');
      expect(screen.getByLabelText('GST Number')).toBeDisabled();
    });

    it('starts the editable fields from what the order already holds', async () => {
      renderScreen();
      await loaded();

      expect(locationField()).toHaveValue('12 MG Road, Coimbatore');
      expect(timeField()).toHaveValue('');
      expect(challanField()).toHaveValue('');
      expect(loadingTypeField()).toHaveValue('LOADING_UNLOADING');
    });

    it('fills the editable fields from an order that already has details', async () => {
      mocked.getOrderWithLoadmen.mockResolvedValue({
        ...ORDER,
        time: '02:00 PM',
        dc_number: 'DC-5',
        loading_type: 'LOADING_ONLY',
      } as never);
      renderScreen();
      await loaded();

      await waitFor(() => expect(timeField()).toHaveValue('02:00 PM'));
      expect(challanField()).toHaveValue('DC-5');
      expect(loadingTypeField()).toHaveValue('LOADING_ONLY');
    });

    it('offers a prompt and all 24 hourly time slots', async () => {
      renderScreen();
      await loaded();

      const options = within(timeField()).getAllByRole('option').map((o) => o.textContent);
      expect(options).toHaveLength(25);
      expect(options[0]).toBe('Select Time');
      expect(options[1]).toBe('12:00 AM');
      expect(options[13]).toBe('12:00 PM');
      expect(options[24]).toBe('11:00 PM');
    });

    it('offers the three loading types', async () => {
      renderScreen();
      await loaded();

      expect(within(loadingTypeField()).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Loading and Unloading',
        'Loading Only',
        'Customer Self Loading',
      ]);
    });

    it('marks time, location, challan number, loading type and load man as required', async () => {
      renderScreen();
      await loaded();

      for (const label of [/^Time/, /^Location/, /^Delivery Challan Number/, /^Loading Type/, /^Load Man/]) {
        expect(screen.getByText(label).querySelector('.text-red-600')).toHaveTextContent('*');
      }
    });

    it('lists the delivery staff to choose from', async () => {
      renderScreen();
      await loaded();

      for (const name of ['Ravi', 'Kumar', 'Operator Ram']) {
        expect(await screen.findByRole('checkbox', { name })).not.toBeChecked();
      }
    });

    it('has Submit ready and Back to Orders', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();

      expect(submitButton()).toBeEnabled();
      await user.click(screen.getByRole('button', { name: /Back to Orders/ }));
      expect(screen.getByTestId('path')).toHaveTextContent('/employee/orders');
    });
  });

  describe('choosing load men', () => {
    it('ticks and unticks a load man and shows who is selected', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await screen.findByRole('checkbox', { name: 'Ravi' });

      await user.click(loadman('Ravi'));
      await user.click(loadman('Kumar'));
      expect(loadman('Ravi')).toBeChecked();
      expect(screen.getByText('Selected: Ravi, Kumar')).toBeInTheDocument();

      await user.click(loadman('Ravi'));
      expect(loadman('Ravi')).not.toBeChecked();
      expect(screen.getByText('Selected: Kumar')).toBeInTheDocument();

      await user.click(loadman('Kumar'));
      expect(screen.queryByText(/^Selected:/)).not.toBeInTheDocument();
    });

    it('starts with the load men already assigned to the order ticked', async () => {
      mocked.getOrderWithLoadmen.mockResolvedValue({ ...ORDER, loadmen: [{ id: 'emp-kumar' }] } as never);
      renderScreen();
      await loaded();

      await waitFor(() => expect(loadman('Kumar')).toBeChecked());
      expect(loadman('Ravi')).not.toBeChecked();
      expect(screen.getByText('Selected: Kumar')).toBeInTheDocument();
    });

    it('hides the load man list when the customer loads for themselves', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await screen.findByRole('checkbox', { name: 'Ravi' });

      await user.selectOptions(loadingTypeField(), 'CUSTOMER_SELF');

      expect(screen.queryByRole('checkbox', { name: 'Ravi' })).not.toBeInTheDocument();
      expect(screen.queryByText(/^Load Man/)).not.toBeInTheDocument();
    });

    it('brings the list back, with the ticks kept, when switched away from self loading', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await screen.findByRole('checkbox', { name: 'Ravi' });
      await user.click(loadman('Ravi'));

      await user.selectOptions(loadingTypeField(), 'CUSTOMER_SELF');
      await user.selectOptions(loadingTypeField(), 'LOADING_ONLY');

      expect(loadman('Ravi')).toBeChecked();
    });
  });

  describe('validation', () => {
    it('lists every missing required detail, and does not contact the server', async () => {
      const user = userEvent.setup();
      mocked.getOrderWithLoadmen.mockResolvedValue({ ...ORDER, location: '' } as never);
      renderScreen();
      await loaded();

      await user.click(submitButton());

      expect(screen.getByText('Time is required')).toBeInTheDocument();
      expect(screen.getByText('Location is required')).toBeInTheDocument();
      expect(screen.getByText('Delivery challan number is required')).toBeInTheDocument();
      expect(screen.getByText('At least one load man must be selected')).toBeInTheDocument();
      expect(mocked.completeDelivery).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument();
    });

    it('asks only for what is missing', async () => {
      const user = userEvent.setup();
      await readyToSubmit(user, 'Ravi');
      await user.selectOptions(timeField(), '');

      await user.click(submitButton());

      expect(screen.getByText('Time is required')).toBeInTheDocument();
      expect(screen.getAllByText(/ is required$| must be selected$/)).toHaveLength(1);
    });

    it.each([
      ['location', () => locationField()],
      ['challan number', () => challanField()],
    ])('treats a %s of only spaces as missing', async (_label, field) => {
      const user = userEvent.setup();
      await readyToSubmit(user, 'Ravi');
      await user.clear(field());
      await user.type(field(), '    ');

      await user.click(submitButton());

      expect(screen.getAllByText(/ is required$/)).toHaveLength(1);
      expect(mocked.completeDelivery).not.toHaveBeenCalled();
    });

    it('requires a load man for loading and unloading, and for loading only', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillRequired(user);

      await user.click(submitButton());
      expect(screen.getByText('At least one load man must be selected')).toBeInTheDocument();

      await user.selectOptions(loadingTypeField(), 'LOADING_ONLY');
      await user.click(submitButton());
      expect(screen.getByText('At least one load man must be selected')).toBeInTheDocument();
      expect(mocked.completeDelivery).not.toHaveBeenCalled();
    });

    it('does not require a load man when the customer loads for themselves', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillRequired(user);
      await user.selectOptions(loadingTypeField(), 'CUSTOMER_SELF');

      await user.click(submitButton());

      await waitFor(() => expect(mocked.completeDelivery).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('At least one load man must be selected')).not.toBeInTheDocument();
    });

    it('recalculates the errors on every Submit and drops the ones that are fixed', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(submitButton());
      expect(screen.getByText('Time is required')).toBeInTheDocument();

      await user.selectOptions(timeField(), '09:00 AM');
      await user.click(submitButton());

      expect(screen.queryByText('Time is required')).not.toBeInTheDocument();
      expect(screen.getByText('Delivery challan number is required')).toBeInTheDocument();
    });
  });

  describe('saving', () => {
    it('records the delivery with the entered details and the selected load men', async () => {
      const user = userEvent.setup();
      await readyToSubmit(user, 'Ravi', 'Kumar');

      await user.click(submitButton());

      await waitFor(() => expect(mocked.completeDelivery).toHaveBeenCalledTimes(1));
      const [orderId, update, loadmen] = mocked.completeDelivery.mock.calls[0];
      expect(orderId).toBe('ord-1001');
      expect(update).toEqual({
        time: '10:00 AM',
        brick_quantity: 5000,
        location: '12 MG Road, Coimbatore',
        payment_status: 'NOT_PAID',
        amount_paid: 0,
        gst_number: '33ABCDE1234F1Z5',
        dc_number: 'DC-1',
        loading_type: 'LOADING_UNLOADING',
      });
      expect(loadmen).toEqual(['emp-ravi', 'emp-kumar']);
    });

    it('sends an edited location', async () => {
      const user = userEvent.setup();
      await readyToSubmit(user, 'Ravi');
      await user.clear(locationField());
      await user.type(locationField(), 'Gate 3, Salem Road');

      await user.click(submitButton());

      await waitFor(() => expect(mocked.completeDelivery).toHaveBeenCalled());
      expect(mocked.completeDelivery.mock.calls[0][1].location).toBe('Gate 3, Salem Road');
    });

    it('sends no GST number when the order has none', async () => {
      const user = userEvent.setup();
      mocked.getOrderWithLoadmen.mockResolvedValue({ ...ORDER, gst_number: null } as never);
      await readyToSubmit(user, 'Ravi');

      await user.click(submitButton());

      await waitFor(() => expect(mocked.completeDelivery).toHaveBeenCalled());
      expect(mocked.completeDelivery.mock.calls[0][1].gst_number).toBeNull();
    });

    it.each([
      ['NOT_PAID', 0, 0],
      ['FULLY_PAID', 0, 40000],
      ['PARTIALLY_PAID', 15000, 15000],
    ])('records the paid amount for a %s order', async (paymentStatus, alreadyPaid, expected) => {
      const user = userEvent.setup();
      mocked.getOrderWithLoadmen.mockResolvedValue({
        ...ORDER,
        payment_status: paymentStatus,
        amount_paid: alreadyPaid,
      } as never);
      await readyToSubmit(user, 'Ravi');

      await user.click(submitButton());

      await waitFor(() => expect(mocked.completeDelivery).toHaveBeenCalled());
      const update = mocked.completeDelivery.mock.calls[0][1];
      expect(update.payment_status).toBe(paymentStatus);
      expect(update.amount_paid).toBe(expected);
    });

    it('confirms with a success popup, and OK goes to the home screen', async () => {
      const user = userEvent.setup();
      await readyToSubmit(user, 'Ravi');

      await user.click(submitButton());

      expect(await screen.findByText('Delivery Entry Successful')).toBeInTheDocument();
      expect(screen.getByText('Delivery details have been recorded successfully.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(screen.getByTestId('path')).toHaveTextContent('/employee/home');
    });

    it('shows Submitting... and ignores another press while the save is in flight', async () => {
      const user = userEvent.setup();
      let finish: () => void = () => {};
      mocked.completeDelivery.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      await readyToSubmit(user, 'Ravi');

      await user.click(submitButton());

      const busy = await screen.findByRole('button', { name: 'Submitting...' });
      expect(busy).toBeDisabled();
      await user.click(busy);
      expect(mocked.completeDelivery).toHaveBeenCalledTimes(1);

      finish();
      expect(await screen.findByText('Delivery Entry Successful')).toBeInTheDocument();
    });
  });

  describe('loader wages', () => {
    async function submitWith(names: string[], configure?: () => void) {
      const user = userEvent.setup();
      configure?.();
      await readyToSubmit(user, ...names);
      await user.click(submitButton());
      await waitFor(() => expect(mocked.completeDelivery).toHaveBeenCalledTimes(1));
      return mocked.completeDelivery.mock.calls[0];
    }

    it('splits quantity x price per brick equally between the selected load men', async () => {
      const [, , loadmen, wages] = await submitWith(['Ravi', 'Kumar']);

      expect(loadmen).toEqual(['emp-ravi', 'emp-kumar']);
      expect(wages).toMatchObject({
        loadmenIds: ['emp-ravi', 'emp-kumar'],
        amountPerLoadman: 5000, // 5000 bricks x 2 / 2 people
        notes: 'Auto salary entry for delivery of order #ord-1001',
      });
      expect(new Date(wages!.paymentAt!).toString()).not.toBe('Invalid Date');
    });

    it('gives one load man the whole amount', async () => {
      const [, , , wages] = await submitWith(['Ravi']);

      expect(wages).toMatchObject({ loadmenIds: ['emp-ravi'], amountPerLoadman: 10000 });
    });

    it('pays half for loading only', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillRequired(user);
      await user.click(loadman('Ravi'));
      await user.click(loadman('Kumar'));
      await user.selectOptions(loadingTypeField(), 'LOADING_ONLY');

      await user.click(submitButton());

      await waitFor(() => expect(mocked.completeDelivery).toHaveBeenCalled());
      expect(mocked.completeDelivery.mock.calls[0][3]).toMatchObject({ amountPerLoadman: 2500 });
      expect(mocked.completeDelivery.mock.calls[0][1].loading_type).toBe('LOADING_ONLY');
    });

    it('uses the price per brick from the app settings', async () => {
      const [, , , wages] = await submitWith(['Ravi'], () =>
        mocked.getAppSettings.mockResolvedValue([
          { key: 'OTHER_SETTING', value: '99' },
          { key: 'LOADING_AND_UNLOADING_PRICE_PER_BRICK', value: '0.5' },
        ] as never),
      );

      expect(wages).toMatchObject({ amountPerLoadman: 2500 });
    });

    it('does not pay staff whose role earns no loading wages, but still counts them in the split', async () => {
      const [, , loadmen, wages] = await submitWith(['Ravi', 'Operator Ram']);

      expect(loadmen).toEqual(['emp-ravi', 'emp-ram']);
      expect(wages).toMatchObject({ loadmenIds: ['emp-ravi'], amountPerLoadman: 5000 });
    });

    it('does not redistribute an unpaid share to the others', async () => {
      const [, , , wages] = await submitWith(['Ravi', 'Kumar', 'Operator Ram']);

      expect(wages!.loadmenIds).toEqual(['emp-ravi', 'emp-kumar']);
      expect(wages!.amountPerLoadman).toBeCloseTo(10000 / 3, 5);
    });

    it('records the delivery with no wages when nobody selected earns any', async () => {
      const [, , loadmen, wages] = await submitWith(['Operator Ram']);

      expect(loadmen).toEqual(['emp-ram']);
      expect(wages).toBeUndefined();
    });

    it('records the delivery with no wages when the customer loads for themselves and nobody is selected', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillRequired(user);
      await user.selectOptions(loadingTypeField(), 'CUSTOMER_SELF');

      await user.click(submitButton());

      await waitFor(() => expect(mocked.completeDelivery).toHaveBeenCalled());
      expect(mocked.completeDelivery.mock.calls[0][2]).toEqual([]);
      expect(mocked.completeDelivery.mock.calls[0][3]).toBeUndefined();
    });

    it.each([
      ['missing', [] as Array<{ key: string; value: string }>],
      ['zero', [{ key: 'LOADING_AND_UNLOADING_PRICE_PER_BRICK', value: '0' }]],
      ['negative', [{ key: 'LOADING_AND_UNLOADING_PRICE_PER_BRICK', value: '-3' }]],
      ['not a number', [{ key: 'LOADING_AND_UNLOADING_PRICE_PER_BRICK', value: 'abc' }]],
    ])('refuses to record a delivery with paid load men when the price setting is %s', async (_label, settings) => {
      const user = userEvent.setup();
      mocked.getAppSettings.mockResolvedValue(settings as never);
      await readyToSubmit(user, 'Ravi');

      await user.click(submitButton());

      expect(await screen.findByText('Delivery Entry Failed')).toBeInTheDocument();
      expect(screen.getByText('Failed to update delivery')).toBeInTheDocument();
      expect(mocked.completeDelivery).not.toHaveBeenCalled();
    });

    it('refuses the same way when the settings cannot be read at all', async () => {
      const user = userEvent.setup();
      mocked.getAppSettings.mockRejectedValue(new Error('down'));
      await readyToSubmit(user, 'Ravi');

      await user.click(submitButton());

      expect(await screen.findByText('Delivery Entry Failed')).toBeInTheDocument();
      expect(mocked.completeDelivery).not.toHaveBeenCalled();
    });

    it('still records a delivery when the price is missing but nobody selected earns wages', async () => {
      const user = userEvent.setup();
      mocked.getAppSettings.mockResolvedValue([] as never);
      await readyToSubmit(user, 'Operator Ram');

      await user.click(submitButton());

      expect(await screen.findByText('Delivery Entry Successful')).toBeInTheDocument();
      expect(mocked.completeDelivery).toHaveBeenCalledTimes(1);
    });
  });

  describe('when saving fails', () => {
    it('explains the failure in a popup', async () => {
      const user = userEvent.setup();
      mocked.completeDelivery.mockRejectedValue(new Error('rpc failed'));
      await readyToSubmit(user, 'Ravi');

      await user.click(submitButton());

      expect(await screen.findByText('Delivery Entry Failed')).toBeInTheDocument();
      expect(screen.getByText('Failed to update delivery')).toBeInTheDocument();
      expect(screen.queryByText('Delivery Entry Successful')).not.toBeInTheDocument();
    });

    it('keeps everything entered and stays on the screen, so the employee can retry', async () => {
      const user = userEvent.setup();
      mocked.completeDelivery.mockRejectedValueOnce(new Error('rpc failed'));
      await readyToSubmit(user, 'Ravi');
      await user.click(submitButton());
      await screen.findByText('Delivery Entry Failed');

      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.queryByText('Delivery Entry Failed')).not.toBeInTheDocument();
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
      expect(timeField()).toHaveValue('10:00 AM');
      expect(challanField()).toHaveValue('DC-1');
      expect(loadman('Ravi')).toBeChecked();
      expect(submitButton()).toBeEnabled();
    });

    it('succeeds on a second attempt', async () => {
      const user = userEvent.setup();
      mocked.completeDelivery.mockRejectedValueOnce(new Error('rpc failed'));
      await readyToSubmit(user, 'Ravi');
      await user.click(submitButton());
      await user.click(await screen.findByRole('button', { name: 'OK' }));

      await user.click(submitButton());

      expect(await screen.findByText('Delivery Entry Successful')).toBeInTheDocument();
      expect(mocked.completeDelivery).toHaveBeenCalledTimes(2);
    });
  });

  describe('an order that is already delivered', () => {
    async function openDelivered() {
      renderScreen('ord-0999');
      await loaded('ord-0999');
      await waitFor(() => expect(loadman('Ravi')).toBeChecked());
    }

    it('shows it as view-only, with who it was for and a Delivered badge', async () => {
      await openDelivered();

      expect(screen.getByText('View delivery information')).toBeInTheDocument();
      expect(screen.getByText('This order has been delivered and cannot be edited.')).toBeInTheDocument();
      expect(screen.getByText('Customer: Rajesh Kumar')).toBeInTheDocument();
      expect(screen.getByText('Phone: 9876543210')).toBeInTheDocument();
      expect(screen.getByText('Delivered')).toBeInTheDocument();
    });

    it('shows the recorded delivery details', async () => {
      await openDelivered();

      expect(timeField()).toHaveValue('10:00 AM');
      expect(challanField()).toHaveValue('DC-77');
      expect(loadingTypeField()).toHaveValue('LOADING_ONLY');
      expect(screen.getByText('Selected: Ravi')).toBeInTheDocument();
    });

    it('locks every field and every load man', async () => {
      await openDelivered();

      for (const field of [timeField(), locationField(), challanField(), loadingTypeField()]) {
        expect(field).toBeDisabled();
      }
      for (const name of ['Ravi', 'Kumar', 'Operator Ram']) expect(loadman(name)).toBeDisabled();
    });

    it('has no Submit button', async () => {
      await openDelivered();

      expect(screen.queryByRole('button', { name: /Submit/ })).not.toBeInTheDocument();
    });

    it('cannot be changed by clicking a load man', async () => {
      const user = userEvent.setup();
      await openDelivered();

      await user.click(loadman('Kumar'));

      expect(loadman('Kumar')).not.toBeChecked();
      expect(mocked.completeDelivery).not.toHaveBeenCalled();
    });

    it('still lets the employee go back to the orders list', async () => {
      const user = userEvent.setup();
      await openDelivered();

      await user.click(screen.getByRole('button', { name: /Back to Orders/ }));

      expect(screen.getByTestId('path')).toHaveTextContent('/employee/orders');
    });
  });

  describe('when the customer loads for themselves', () => {
    async function submitSelfLoading(user: User, ...ticked: string[]) {
      renderScreen();
      await loaded();
      await fillRequired(user);
      for (const name of ticked) await user.click(loadman(name));
      await user.selectOptions(loadingTypeField(), 'CUSTOMER_SELF');
      await user.click(submitButton());
      await waitFor(() => expect(mocked.completeDelivery).toHaveBeenCalledTimes(1));
      return mocked.completeDelivery.mock.calls[0];
    }

    it('assigns no load men and pays no wages, even if some were ticked before switching', async () => {
      const [, update, loadmen, wages] = await submitSelfLoading(userEvent.setup(), 'Ravi', 'Kumar');

      expect(loadmen).toEqual([]);
      expect(wages).toBeUndefined();
      expect(update.loading_type).toBe('CUSTOMER_SELF');
    });

    it('does not pay staff assigned to the order in advance either', async () => {
      mocked.getOrderWithLoadmen.mockResolvedValue({ ...ORDER, loadmen: [{ id: 'emp-ravi' }] } as never);
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await waitFor(() => expect(loadman('Ravi')).toBeChecked());
      await fillRequired(user);
      await user.selectOptions(loadingTypeField(), 'CUSTOMER_SELF');

      await user.click(submitButton());

      await waitFor(() => expect(mocked.completeDelivery).toHaveBeenCalledTimes(1));
      expect(mocked.completeDelivery.mock.calls[0][2]).toEqual([]);
      expect(mocked.completeDelivery.mock.calls[0][3]).toBeUndefined();
    });

    it('still pays wages if the type is switched back before saving', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await fillRequired(user);
      await user.click(loadman('Ravi'));
      await user.selectOptions(loadingTypeField(), 'CUSTOMER_SELF');
      await user.selectOptions(loadingTypeField(), 'LOADING_UNLOADING');

      await user.click(submitButton());

      await waitFor(() => expect(mocked.completeDelivery).toHaveBeenCalledTimes(1));
      expect(mocked.completeDelivery.mock.calls[0][2]).toEqual(['emp-ravi']);
      expect(mocked.completeDelivery.mock.calls[0][3]).toMatchObject({ loadmenIds: ['emp-ravi'] });
    });

    it('records the delivery even when the price per brick is not set up', async () => {
      const user = userEvent.setup();
      mocked.getAppSettings.mockResolvedValue([] as never);

      await submitSelfLoading(user, 'Ravi');

      expect(await screen.findByText('Delivery Entry Successful')).toBeInTheDocument();
    });
  });

  describe('when the order cannot be loaded', () => {
    beforeEach(() => {
      mocked.getOrderWithLoadmen.mockRejectedValue(new Error('down'));
    });

    it('tells the employee, instead of showing an empty form', async () => {
      renderScreen();

      expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load order details');
      expect(screen.queryByLabelText('Order ID')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Submit/ })).not.toBeInTheDocument();
    });

    it('still lets the employee go back to the orders list', async () => {
      const user = userEvent.setup();
      renderScreen();
      await screen.findByRole('alert');

      await user.click(screen.getByRole('button', { name: /Back to Orders/ }));

      expect(screen.getByTestId('path')).toHaveTextContent('/employee/orders');
    });

    it('does not show the message for an order that loaded', async () => {
      mocked.getOrderWithLoadmen.mockResolvedValue(ORDER as never);
      renderScreen();
      await loaded();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('when the delivery staff cannot be loaded', () => {
    beforeEach(() => {
      mocked.getDeliveryStaff.mockRejectedValue(new Error('down'));
    });

    it('says so, and leaves the rest of the form usable', async () => {
      renderScreen();

      expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load the delivery staff');
      expect(screen.getByLabelText('Order ID')).toHaveValue('ord-1001');
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('still allows a customer-loaded delivery to be recorded', async () => {
      const user = userEvent.setup();
      renderScreen();
      await screen.findByRole('alert');
      await fillRequired(user);
      await user.selectOptions(loadingTypeField(), 'CUSTOMER_SELF');

      await user.click(submitButton());

      expect(await screen.findByText('Delivery Entry Successful')).toBeInTheDocument();
    });
  });

  describe('errors clear as the field is corrected', () => {
    it.each([
      ['time', 'Time is required', async (u: User) => u.selectOptions(timeField(), '09:00 AM')],
      ['challan number', 'Delivery challan number is required', async (u: User) => u.type(challanField(), 'D')],
    ])('clears the %s error when it is changed', async (_label, message, change) => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(submitButton());
      expect(screen.getByText(message)).toBeInTheDocument();

      await change(user);

      expect(screen.queryByText(message)).not.toBeInTheDocument();
    });

    it('clears the location error when a location is typed', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.clear(locationField());
      await user.click(submitButton());
      expect(screen.getByText('Location is required')).toBeInTheDocument();

      await user.type(locationField(), 'Gate 3');

      expect(screen.queryByText('Location is required')).not.toBeInTheDocument();
    });

    it('clears the load man error when one is ticked', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await screen.findByRole('checkbox', { name: 'Ravi' });
      await user.click(submitButton());
      expect(screen.getByText('At least one load man must be selected')).toBeInTheDocument();

      await user.click(loadman('Ravi'));

      expect(screen.queryByText('At least one load man must be selected')).not.toBeInTheDocument();
    });

    it('clears the load man error when the customer is set to load for themselves', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(submitButton());
      expect(screen.getByText('At least one load man must be selected')).toBeInTheDocument();

      await user.selectOptions(loadingTypeField(), 'CUSTOMER_SELF');

      expect(screen.queryByText('At least one load man must be selected')).not.toBeInTheDocument();
    });

    it('leaves the errors of the other fields showing', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(submitButton());

      await user.selectOptions(timeField(), '09:00 AM');

      expect(screen.queryByText('Time is required')).not.toBeInTheDocument();
      expect(screen.getByText('Delivery challan number is required')).toBeInTheDocument();
      expect(screen.getByText('At least one load man must be selected')).toBeInTheDocument();
    });
  });

  describe('problems with details taken from the order', () => {
    it('says why Submit did nothing when a part-paid order has no amount recorded', async () => {
      const user = userEvent.setup();
      mocked.getOrderWithLoadmen.mockResolvedValue({
        ...ORDER,
        payment_status: 'PARTIALLY_PAID',
        amount_paid: 0,
      } as never);
      await readyToSubmit(user, 'Ravi');

      await user.click(submitButton());

      expect(
        screen.getByText('Paid amount is required for a part-paid order. Please ask an administrator to record it.'),
      ).toBeInTheDocument();
      expect(mocked.completeDelivery).not.toHaveBeenCalled();
    });

    it('records a part-paid order that does have an amount', async () => {
      const user = userEvent.setup();
      mocked.getOrderWithLoadmen.mockResolvedValue({
        ...ORDER,
        payment_status: 'PARTIALLY_PAID',
        amount_paid: 15000,
      } as never);
      await readyToSubmit(user, 'Ravi');

      await user.click(submitButton());

      await waitFor(() => expect(mocked.completeDelivery).toHaveBeenCalledTimes(1));
      expect(screen.queryByText(/Paid amount is required/)).not.toBeInTheDocument();
    });

    it('says why Submit did nothing when the order has no quantity', async () => {
      const user = userEvent.setup();
      mocked.getOrderWithLoadmen.mockResolvedValue({ ...ORDER, brick_quantity: 0 } as never);
      await readyToSubmit(user, 'Ravi');

      await user.click(submitButton());

      expect(screen.getByText('Quantity must be greater than 0')).toBeInTheDocument();
      expect(mocked.completeDelivery).not.toHaveBeenCalled();
    });
  });
});
