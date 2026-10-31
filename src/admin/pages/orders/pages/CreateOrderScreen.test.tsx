import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CreateOrderScreen } from './CreateOrderScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({
  searchCustomers: vi.fn(),
  getAllEmployees: vi.fn(),
  createOrder: vi.fn(),
  validateSession: vi.fn(),
  getUserProfile: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const RAJU = { id: 'emp-1', name: 'Raju Kumar' };
const SURESH = { id: 'emp-2', name: 'Suresh Yadav' };

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin/orders/create']}>
      <CreateOrderScreen />
    </MemoryRouter>,
  );
}

const loadingType = () => screen.getByLabelText('Loading Type');
const loadman = (name: RegExp) => screen.getByRole('checkbox', { name });

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getAllEmployees.mockResolvedValue([RAJU, SURESH] as never);
  mocked.searchCustomers.mockResolvedValue([] as never);
});

describe('CreateOrderScreen', () => {
  describe('loadmen and the loading type', () => {
    it('lists the loadmen, with none chosen, for the default loading type', async () => {
      renderScreen();

      await waitFor(() => expect(loadman(/Raju Kumar/)).not.toBeChecked());
      expect(loadman(/Suresh Yadav/)).not.toBeChecked();
      expect(loadingType()).toHaveValue('LOADING_UNLOADING');
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
});
