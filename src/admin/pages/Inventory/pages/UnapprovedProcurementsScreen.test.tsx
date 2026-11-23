import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { UnapprovedProcurementsScreen } from './UnapprovedProcurementsScreen';
import * as middleware from '../../../../services/middleware.service';

process.env.TZ = 'Asia/Kolkata'; // the screen prints dates in the machine's timezone

vi.mock('../../../../services/middleware.service', () => ({
  getUnapprovedProcurements: vi.fn(),
  approveProcurement: vi.fn(),
  deleteProcurement: vi.fn(),
}));

const mocked = vi.mocked(middleware);

// Every material row stores unit "kg" in the database; the screen must not show that.
const procurement = (id: string, material: string, quantity: number, vendor = 'ABC Suppliers', date = '2026-10-14') => ({
  id,
  quantity,
  date,
  materials: { name: material, unit: 'kg' },
  vendors: { name: vendor },
});

const CRUSHER = procurement('p-crusher', 'Crusher Powder', 4000);
const CEMENT = procurement('p-cement', 'Cement', 200, 'XYZ Materials', '2026-10-13');
const WET_ASH = procurement('p-wet-ash', 'Wet Ash', 30, 'ABC Suppliers', '2026-10-12');
const ROWS = [CRUSHER, CEMENT, WET_ASH];

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen(from?: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/admin/inventory/unapproved-procurements', state: from ? { from } : undefined }]}>
      <Routes>
        <Route path="/admin/inventory/unapproved-procurements" element={<UnapprovedProcurementsScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const cardFor = async (material: string) =>
  (await screen.findByText(material, { selector: 'p' })).closest('.border') as HTMLElement;
const toggles = () => screen.queryAllByRole('button', { name: 'Approve procurement' });
const openRequest = async (user: ReturnType<typeof userEvent.setup>, material: string) => {
  const card = await cardFor(material);
  await user.click(within(card).getByRole('button', { name: 'Approve procurement' }));
  return screen.getByRole('heading', { name: 'Approve Procurement' });
};
const approveAction = () => screen.getByRole('button', { name: 'Approve', exact: true });
/** The pre-filled fields in the window have labels that are not tied to them, so find them by their value. */
const prefilled = (value: string) => screen.getByDisplayValue(value);

describe('UnapprovedProcurementsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocked.getUnapprovedProcurements.mockResolvedValue(ROWS as never);
    mocked.approveProcurement.mockResolvedValue(undefined);
    mocked.deleteProcurement.mockResolvedValue(undefined);
  });

  describe('the list', () => {
    it('says what the screen is for', async () => {
      renderScreen();
      expect(await screen.findByRole('heading', { level: 1, name: 'Unapproved Procurements' })).toBeInTheDocument();
      expect(screen.getByText('Review and approve pending procurement requests')).toBeInTheDocument();
    });

    it('lists every pending request with material, date, vendor and quantity', async () => {
      renderScreen();
      const card = await cardFor('Cement');
      expect(within(card).getByText(new Date('2026-10-13').toLocaleDateString())).toBeInTheDocument();
      expect(within(card).getByText('XYZ Materials')).toBeInTheDocument();
      expect(within(card).getByText('200 Bags')).toBeInTheDocument();
      expect(toggles()).toHaveLength(3);
    });

    it.each([
      ['Crusher Powder', '4000 Units'],
      ['Cement', '200 Bags'],
      ['Wet Ash', '30 Tons'],
    ])('lists %s as %s, not in kg', async (material, shown) => {
      renderScreen();
      const card = await cardFor(material);
      expect(within(card).getByText(shown)).toBeInTheDocument();
      expect(within(card).queryByText(/kg/i)).not.toBeInTheDocument();
    });

    it('shows N/A for a missing material or vendor', async () => {
      mocked.getUnapprovedProcurements.mockResolvedValue([{ id: 'x', quantity: 1, date: '2026-10-14', materials: null, vendors: null }] as never);
      renderScreen();
      await screen.findByRole('button', { name: 'Approve procurement' });
      expect(screen.getAllByText('N/A')).toHaveLength(2);
    });

    it('shows a loading message until the list arrives', async () => {
      mocked.getUnapprovedProcurements.mockReturnValue(new Promise(() => {}));
      renderScreen();
      expect(await screen.findByText('Loading procurements...')).toBeInTheDocument();
    });

    it('says so when nothing is waiting', async () => {
      mocked.getUnapprovedProcurements.mockResolvedValue([]);
      renderScreen();
      expect(await screen.findByText('No unapproved procurements for this period')).toBeInTheDocument();
    });

    it('shows an error that can be closed when the list cannot be loaded', async () => {
      mocked.getUnapprovedProcurements.mockRejectedValue(new Error('down'));
      const user = userEvent.setup();
      renderScreen();
      expect(await screen.findByRole('heading', { name: 'Error' })).toBeInTheDocument();
      expect(screen.getByText('Failed to load procurements. Please try again.')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(screen.queryByRole('heading', { name: 'Error' })).not.toBeInTheDocument();
    });

    it('Back to Inventory Management returns to where the admin came from', async () => {
      const user = userEvent.setup();
      renderScreen('/admin/inventory');
      await cardFor('Cement');
      await user.click(screen.getByRole('button', { name: /Back to Inventory Management/ }));
      expect(screen.getByTestId('path')).toHaveTextContent('/admin/inventory');
    });
  });

  describe('the approve window', () => {
    it('opens with the request filled in, in the unit it will be approved in', async () => {
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Crusher Powder');

      expect(prefilled('Crusher Powder')).toBeDisabled();
      expect(prefilled('ABC Suppliers')).toBeDisabled();
      expect(prefilled('4000 Units')).toBeDisabled();
      expect(prefilled('₹0')).toBeDisabled();
    });

    it('shows the same unit on the card and in the window', async () => {
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Crusher Powder');
      expect(prefilled('4000 Units')).toBeInTheDocument();
      expect(screen.getByLabelText(/Price per Unit/)).toBeInTheDocument();
    });

    it.each([
      ['Crusher Powder', /Price per Unit/, 'units'],
      ['Cement', /Price per Bag/, 'bags'],
      ['Wet Ash', /Price per Ton/, 'tons'],
    ])('asks for the %s price in the same unit as the quantity', async (material, label, unit) => {
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, material);
      expect(screen.getByLabelText(label)).toHaveAttribute('placeholder', expect.stringContaining(unit));
    });

    it('keeps Approve off until a price is entered', async () => {
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Wet Ash');
      expect(approveAction()).toBeDisabled();

      await user.type(screen.getByLabelText(/Price per Ton/), '900');
      expect(approveAction()).toBeEnabled();

      await user.clear(screen.getByLabelText(/Price per Ton/));
      expect(approveAction()).toBeDisabled();
    });

    it('works out the total from the quantity and the price', async () => {
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Wet Ash');
      await user.type(screen.getByLabelText(/Price per Ton/), '900');
      expect(prefilled('₹27,000')).toBeInTheDocument();
    });

    it('works out the total with a price that has paise', async () => {
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Wet Ash');
      await user.type(screen.getByLabelText(/Price per Ton/), '12.5');
      expect(prefilled('₹375')).toBeInTheDocument();
    });

    it('closes with the X, leaving the request in the list', async () => {
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Wet Ash');
      await user.click(screen.getByRole('button', { name: 'Close modal' }));
      expect(screen.queryByRole('heading', { name: 'Approve Procurement' })).not.toBeInTheDocument();
      expect(toggles()).toHaveLength(3);
      expect(mocked.approveProcurement).not.toHaveBeenCalled();
    });

    it('opens empty again after being closed', async () => {
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Wet Ash');
      await user.type(screen.getByLabelText(/Price per Ton/), '900');
      await user.click(screen.getByRole('button', { name: 'Close modal' }));
      await openRequest(user, 'Wet Ash');
      expect(screen.getByLabelText(/Price per Ton/)).toHaveValue(null);
      expect(approveAction()).toBeDisabled();
    });
  });

  describe('approving', () => {
    it('sends the request, the price and the total, then confirms and drops it from the list', async () => {
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Wet Ash');
      await user.type(screen.getByLabelText(/Price per Ton/), '900');
      mocked.getUnapprovedProcurements.mockResolvedValue([CRUSHER, CEMENT] as never);
      await user.click(approveAction());

      expect(mocked.approveProcurement).toHaveBeenCalledTimes(1);
      expect(mocked.approveProcurement).toHaveBeenCalledWith('p-wet-ash', 900, 27000);
      expect(await screen.findByRole('heading', { name: 'Procurement Approved' })).toBeInTheDocument();
      expect(screen.getByText('Procurement has been approved successfully.')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Approve Procurement' })).not.toBeInTheDocument();
      await waitFor(() => expect(toggles()).toHaveLength(2));
      expect(mocked.getUnapprovedProcurements).toHaveBeenCalledTimes(2);
    });

    it('approves a quantity with a price that has paise, sending an exact total', async () => {
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Cement');
      await user.type(screen.getByLabelText(/Price per Bag/), '379.99');
      await user.click(approveAction());
      await screen.findByRole('heading', { name: 'Procurement Approved' });
      expect(mocked.approveProcurement).toHaveBeenCalledWith('p-cement', 379.99, 75998);
    });

    it('locks both buttons and says Approving... while it saves', async () => {
      let finish: () => void = () => {};
      mocked.approveProcurement.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Wet Ash');
      await user.type(screen.getByLabelText(/Price per Ton/), '900');
      await user.click(approveAction());

      expect(await screen.findByRole('button', { name: 'Approving...' })).toBeDisabled();
      const buttons = screen.getAllByRole('button', { name: /\.\.\.$/ });
      expect(buttons).toHaveLength(2); // Approve and Reject are both locked
      buttons.forEach((b) => expect(b).toBeDisabled());
      finish();
      await screen.findByRole('heading', { name: 'Procurement Approved' });
    });

    it('the confirmation can be dismissed', async () => {
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Wet Ash');
      await user.type(screen.getByLabelText(/Price per Ton/), '900');
      await user.click(approveAction());
      await screen.findByRole('heading', { name: 'Procurement Approved' });
      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(screen.queryByRole('heading', { name: 'Procurement Approved' })).not.toBeInTheDocument();
    });

    it('says it failed, keeps the request and the window, and does not reload the list', async () => {
      mocked.approveProcurement.mockRejectedValue(new Error('down'));
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Wet Ash');
      await user.type(screen.getByLabelText(/Price per Ton/), '900');
      await user.click(approveAction());

      expect(await screen.findByText('Failed to approve procurement. Please try again.')).toBeInTheDocument();
      expect(screen.queryByText('Procurement has been approved successfully.')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(screen.getByRole('heading', { name: 'Approve Procurement' })).toBeInTheDocument();
      expect(screen.getByLabelText(/Price per Ton/)).toHaveValue(900);
      expect(approveAction()).toBeEnabled();
      expect(mocked.getUnapprovedProcurements).toHaveBeenCalledTimes(1);
    });
  });

  describe('rejecting', () => {
    it('deletes the request, confirms, and drops it from the list', async () => {
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Cement');
      mocked.getUnapprovedProcurements.mockResolvedValue([CRUSHER, WET_ASH] as never);
      await user.click(screen.getByRole('button', { name: 'Reject' }));

      expect(mocked.deleteProcurement).toHaveBeenCalledTimes(1);
      expect(mocked.deleteProcurement).toHaveBeenCalledWith('p-cement');
      expect(mocked.approveProcurement).not.toHaveBeenCalled();
      expect(await screen.findByRole('heading', { name: 'Procurement Rejected' })).toBeInTheDocument();
      expect(screen.getByText('Procurement has been rejected and deleted.')).toBeInTheDocument();
      await waitFor(() => expect(toggles()).toHaveLength(2));
      expect(screen.queryByText('200 Bags')).not.toBeInTheDocument();
    });

    it('needs no price', async () => {
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Cement');
      expect(screen.getByRole('button', { name: 'Reject' })).toBeEnabled();
      expect(screen.getByLabelText(/Price per Bag/)).toHaveValue(null);
    });

    it('locks both buttons and says Rejecting... while it deletes', async () => {
      let finish: () => void = () => {};
      mocked.deleteProcurement.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Cement');
      await user.click(screen.getByRole('button', { name: 'Reject' }));

      expect(await screen.findByRole('button', { name: 'Rejecting...' })).toBeDisabled();
      const buttons = screen.getAllByRole('button', { name: /\.\.\.$/ });
      expect(buttons).toHaveLength(2); // Approve and Reject are both locked
      buttons.forEach((b) => expect(b).toBeDisabled());
      finish();
      await screen.findByRole('heading', { name: 'Procurement Rejected' });
    });

    it('says it failed and keeps the request when deleting fails', async () => {
      mocked.deleteProcurement.mockRejectedValue(new Error('down'));
      const user = userEvent.setup();
      renderScreen();
      await openRequest(user, 'Cement');
      await user.click(screen.getByRole('button', { name: 'Reject' }));

      expect(await screen.findByText('Failed to reject procurement. Please try again.')).toBeInTheDocument();
      expect(screen.queryByText('Procurement has been rejected and deleted.')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(screen.getByRole('heading', { name: 'Approve Procurement' })).toBeInTheDocument();
      expect(toggles()).toHaveLength(3);
      expect(mocked.getUnapprovedProcurements).toHaveBeenCalledTimes(1);
    });
  });
});
