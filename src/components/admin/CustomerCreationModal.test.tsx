import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomerCreationModal } from './CustomerCreationModal';
import * as middleware from '../../services/middleware.service';

vi.mock('../../services/middleware.service', () => ({
  createCustomer: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const CREATED = { id: 'cust-9', name: 'Anita Rao', phone: '9876543299', address: '9 Market Street, Salem', gst_number: null };

const name = () => screen.getByLabelText(/^Customer Name/);
const phone = () => screen.getByLabelText(/^Phone Number/);
const address = () => screen.getByLabelText(/^Address/);
const gst = () => screen.getByLabelText(/^GST Number/);
const create = () => screen.getByRole('button', { name: /^Creat(e|ing)/ });

function setup(props: Partial<React.ComponentProps<typeof CustomerCreationModal>> = {}) {
  const onClose = vi.fn();
  const onCustomerCreated = vi.fn();
  const user = userEvent.setup();
  render(<CustomerCreationModal onClose={onClose} onCustomerCreated={onCustomerCreated} {...props} />);
  return { user, onClose, onCustomerCreated };
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(name(), 'Anita Rao');
  await user.type(phone(), '9876543299');
  await user.type(address(), '9 Market Street, Salem');
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.createCustomer.mockResolvedValue(CREATED as never);
});

describe('CustomerCreationModal', () => {
  describe('the form', () => {
    it('opens empty, with an enabled Create button', () => {
      setup();

      expect(screen.getByRole('heading', { name: 'Customer Creation' })).toBeInTheDocument();
      expect(name()).toHaveValue('');
      expect(phone()).toHaveValue('');
      expect(address()).toHaveValue('');
      expect(gst()).toHaveValue('');
      expect(screen.getByText('0/200 characters')).toBeInTheDocument();
      expect(create()).toBeEnabled();
    });

    it('closes without creating anything when the close button is clicked', async () => {
      const { user, onClose } = setup();

      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mocked.createCustomer).not.toHaveBeenCalled();
    });

    it('accepts only letters and spaces in the name', async () => {
      const { user } = setup();

      await user.type(name(), 'Anita R4o_ Sharma!');

      expect(name()).toHaveValue('Anita Ro Sharma');
    });

    it('accepts only digits in the phone number, up to 10', async () => {
      const { user } = setup();

      await user.type(phone(), '98a76-54321 0987');

      expect(phone()).toHaveValue('9876543210');
    });

    it('upper-cases the GST number and stops at 15 characters', async () => {
      const { user } = setup();

      await user.type(gst(), '33abcde1234f1z5extra');

      expect(gst()).toHaveValue('33ABCDE1234F1Z5');
    });

    it('counts the characters typed in the address and stops at 200', async () => {
      const { user } = setup();

      await user.type(address(), 'Salem');
      expect(screen.getByText('5/200 characters')).toBeInTheDocument();

      await user.clear(address());
      await user.click(address());
      await user.paste('x'.repeat(250));
      expect(address()).toHaveValue('x'.repeat(200));
      expect(screen.getByText('200/200 characters')).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('asks for the name, phone number and address when they are all empty, and does not create', async () => {
      const { user } = setup();

      await user.click(create());

      expect(screen.getByText('Name is required')).toBeInTheDocument();
      expect(screen.getByText('Phone number is required')).toBeInTheDocument();
      expect(screen.getByText('Address is required')).toBeInTheDocument();
      expect(screen.queryByText('Enter valid GST Number')).not.toBeInTheDocument();
      expect(mocked.createCustomer).not.toHaveBeenCalled();
    });

    it('rejects a phone number shorter than 10 digits', async () => {
      const { user } = setup();
      await fillValid(user);
      await user.clear(phone());
      await user.type(phone(), '98765');

      await user.click(create());

      expect(screen.getByText('Phone number must be 10 digits')).toBeInTheDocument();
      expect(mocked.createCustomer).not.toHaveBeenCalled();
    });

    it('rejects a GST number that is not 15 characters, but allows it to be left empty', async () => {
      const { user } = setup();
      await fillValid(user);
      await user.type(gst(), '33ABCDE1234');

      await user.click(create());

      expect(screen.getByText('Enter valid GST Number')).toBeInTheDocument();
      expect(mocked.createCustomer).not.toHaveBeenCalled();

      await user.clear(gst());
      await user.click(create());

      await waitFor(() => expect(mocked.createCustomer).toHaveBeenCalledTimes(1));
    });

    it('clears the errors once the form is corrected and submitted', async () => {
      const { user } = setup();
      await user.click(create());
      expect(screen.getByText('Name is required')).toBeInTheDocument();

      await fillValid(user);
      await user.click(create());

      await waitFor(() => expect(mocked.createCustomer).toHaveBeenCalled());
      expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
    });
  });

  describe('creating the customer', () => {
    it('sends the details, trimmed, with no GST number when none was typed', async () => {
      const { user } = setup();
      await user.type(name(), 'Anita Rao ');
      await user.type(phone(), '9876543299');
      await user.type(address(), '  9 Market Street, Salem ');

      await user.click(create());

      await waitFor(() => expect(mocked.createCustomer).toHaveBeenCalledTimes(1));
      expect(mocked.createCustomer).toHaveBeenCalledWith({
        name: 'Anita Rao',
        phone: '9876543299',
        address: '9 Market Street, Salem',
        gst_number: undefined,
      });
    });

    it('sends the GST number when one was typed', async () => {
      const { user } = setup();
      await fillValid(user);
      await user.type(gst(), '33abcde1234f1z5');

      await user.click(create());

      await waitFor(() => expect(mocked.createCustomer).toHaveBeenCalled());
      expect(mocked.createCustomer).toHaveBeenCalledWith(expect.objectContaining({ gst_number: '33ABCDE1234F1Z5' }));
    });

    it('hands the new customer to the caller and confirms it', async () => {
      const { user, onCustomerCreated, onClose } = setup();
      await fillValid(user);

      await user.click(create());

      expect(await screen.findByRole('heading', { name: 'Customer Created Successfully' })).toBeInTheDocument();
      expect(screen.getByText('The customer has been added to the system.')).toBeInTheDocument();
      expect(onCustomerCreated).toHaveBeenCalledWith(CREATED);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('closes from the confirmation with OK', async () => {
      const { user, onClose } = setup();
      await fillValid(user);
      await user.click(create());

      await user.click(await screen.findByRole('button', { name: 'OK' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('works when the caller does not ask to be told about the new customer', async () => {
      const { user } = setup({ onCustomerCreated: undefined });
      await fillValid(user);

      await user.click(create());

      expect(await screen.findByRole('heading', { name: 'Customer Created Successfully' })).toBeInTheDocument();
    });

    it('disables Create and says Creating... while the customer is being saved', async () => {
      let finish: (c: unknown) => void = () => {};
      mocked.createCustomer.mockReturnValue(new Promise((resolve) => (finish = resolve)) as never);
      const { user } = setup();
      await fillValid(user);

      await user.click(create());

      expect(await screen.findByRole('button', { name: 'Creating...' })).toBeDisabled();
      finish(CREATED);
      expect(await screen.findByRole('heading', { name: 'Customer Created Successfully' })).toBeInTheDocument();
    });

    it('shows the server error and keeps the form so it can be tried again', async () => {
      mocked.createCustomer.mockRejectedValue(new Error('A customer with this phone number already exists'));
      const { user, onCustomerCreated } = setup();
      await fillValid(user);

      await user.click(create());

      expect(await screen.findByText('A customer with this phone number already exists')).toBeInTheDocument();
      expect(name()).toHaveValue('Anita Rao');
      expect(phone()).toHaveValue('9876543299');
      expect(create()).toBeEnabled();
      expect(onCustomerCreated).not.toHaveBeenCalled();
      expect(screen.queryByRole('heading', { name: 'Customer Created Successfully' })).not.toBeInTheDocument();
    });

    it('falls back to a general message when the error has none', async () => {
      mocked.createCustomer.mockRejectedValue({});
      const { user } = setup();
      await fillValid(user);

      await user.click(create());

      expect(await screen.findByText('Failed to create customer')).toBeInTheDocument();
    });
  });
});
