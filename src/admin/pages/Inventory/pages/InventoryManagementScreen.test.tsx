import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { InventoryRoutes } from '../routes';
import * as middleware from '../../../../services/middleware.service';

// The screens print dates in the machine's timezone; pin one so every machine gives the same answer.
process.env.TZ = 'Asia/Kolkata';

vi.mock('../../../../services/middleware.service', () => ({
  getUnapprovedProcurementCount: vi.fn(),
  getUnapprovedProcurements: vi.fn(),
  approveProcurement: vi.fn(),
  deleteProcurement: vi.fn(),
  getInventoryStock: vi.fn(),
  getProcurements: vi.fn(),
  getProductionEntries: vi.fn(),
  getProductInventory: vi.fn(),
  getAdjustments: vi.fn(),
  validateSession: vi.fn(),
  createAdjustment: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const NOW = new Date(2026, 9, 15, 10, 0, 0); // 15 Oct 2026: "Current month" is October, "Last month" September

type Row = Record<string, unknown>;

const material = (id: string, name: string) => ({ id, name, unit: 'kg' }); // real rows store "kg" for every material
const WET = material('m-wet', 'Wet Ash');
const MARBLE = material('m-marble', 'Marble Powder');
const CRUSHER = material('m-crusher', 'Crusher Powder');
const FLY = material('m-fly', 'Fly Ash');
const CEMENT = material('m-cement', 'Cement');
const ABC = { id: 'v-abc', name: 'ABC Suppliers', phone: null };
const XYZ = { id: 'v-xyz', name: 'XYZ Materials', phone: null };

const stockRow = (m: typeof WET, quantity: number) => ({ material_id: m.id, quantity, updated_at: '2026-10-12T10:00:00Z', materials: m });
const STOCK = [
  stockRow(WET, 34308),
  stockRow(MARBLE, 14260),
  stockRow(CRUSHER, 18422.5),
  stockRow(FLY, 7975),
  stockRow(CEMENT, 2775),
];

const procurement = (id: string, m: typeof WET, v: typeof ABC, quantity: number, date: string, rate: number): Row => ({
  id, material_id: m.id, vendor_id: v.id, quantity, rate_per_unit: rate, total_price: quantity * rate,
  date, approved: true, created_by: 'u1', created_at: `${date}T09:00:00Z`, materials: m, vendors: v,
});
const PROCUREMENTS = [
  procurement('p1', CRUSHER, ABC, 5, '2026-10-10', 3200),
  procurement('p2', CEMENT, XYZ, 100, '2026-10-08', 380),
  procurement('p3', WET, ABC, 60, '2026-10-05', 900),
  procurement('p4', WET, ABC, 30, '2026-09-12', 900), // last month
  procurement('p5', CEMENT, XYZ, 80, '2025-06-10', 360), // last year
];

const production = (overrides: Row = {}): Row => ({
  id: 'e1', production_date: '2026-10-14', bricks: 9000, round: 25,
  wet_ash_kg: 500, marble_powder_kg: 120.5, crusher_powder_kg: 80, fly_ash_kg: 40, cement_bags: 12,
  created_by: 'u1', created_at: '2026-10-14T10:00:00Z',
  ...overrides,
});
const HISTORY = [
  production(),
  production({ id: 'e2', production_date: '2026-10-13', bricks: 7500, round: 10, wet_ash_kg: 200, marble_powder_kg: null, crusher_powder_kg: null, fly_ash_kg: null, cement_bags: null }),
  production({ id: 'e3', production_date: '2026-09-20', bricks: 100, round: 1 }),
];

const ADJUSTMENTS = [
  {
    id: 'a1', adjustment_date: '2026-10-12',
    actual_bricks: 33100, adjusted_bricks: 33000,
    actual_wet_ash_kg: 34308, adjusted_wet_ash_kg: 34308,
    actual_marble_powder_kg: 14260, adjusted_marble_powder_kg: 14300,
    actual_crusher_powder_kg: null, adjusted_crusher_powder_kg: null,
    actual_fly_ash_kg: 7975, adjusted_fly_ash_kg: 7970,
    actual_cement_bags: 55.5, adjusted_cement_bags: 55.5,
    reason: 'Physical count correction', created_by: 'u1', created_at: '2026-10-12T09:00:00Z',
  },
  {
    id: 'a2', adjustment_date: '2026-10-11',
    actual_bricks: 10, adjusted_bricks: 12,
    actual_wet_ash_kg: null, adjusted_wet_ash_kg: null,
    actual_marble_powder_kg: null, adjusted_marble_powder_kg: null,
    actual_crusher_powder_kg: null, adjusted_crusher_powder_kg: null,
    actual_fly_ash_kg: null, adjusted_fly_ash_kg: null,
    actual_cement_bags: null, adjusted_cement_bags: null,
    reason: null, created_by: 'u1', created_at: '2026-10-11T09:00:00Z',
  },
];

function Destination() {
  const { pathname } = useLocation();
  return <div data-testid="path">{pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/admin/inventory']}>
      <Routes>
        <Route path="/admin/inventory/*" element={<InventoryRoutes />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const loaded = () => screen.findByText('34,308 Kg (34.31 Tons)');
const stockCard = () => within(screen.getByRole('heading', { name: 'Raw Material Stock' }).parentElement as HTMLElement);
const stockOf = (name: string) => stockCard().getByText(name).nextElementSibling?.textContent;
const tab = (name: string) => screen.getByRole('button', { name, exact: true });
const chip = (name: string) => screen.getByRole('button', { name, exact: true });
const totals = () => screen.queryAllByText('Total Price');

describe('InventoryManagementScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocked.getUnapprovedProcurementCount.mockResolvedValue(3);
    mocked.getInventoryStock.mockResolvedValue(STOCK);
    mocked.getProcurements.mockResolvedValue(PROCUREMENTS);
    mocked.getProductionEntries.mockResolvedValue(HISTORY);
    mocked.getProductInventory.mockResolvedValue({ id: 'pi', product_type: 'BRICKS', quantity: 33100, updated_at: null });
    mocked.getAdjustments.mockResolvedValue(ADJUSTMENTS);
    mocked.validateSession.mockResolvedValue({ id: 'admin-1' } as never);
    mocked.createAdjustment.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('the page', () => {
    it('says what the screen is for', async () => {
      renderScreen();
      await loaded();
      expect(screen.getByRole('heading', { level: 1, name: 'Inventory Management' })).toBeInTheDocument();
      expect(screen.getByText('Track stock, production, and raw material usage')).toBeInTheDocument();
    });

    it('Back to Home goes to the dashboard', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(screen.getByRole('button', { name: /Back to Home/ }));
      expect(screen.getByTestId('path')).toHaveTextContent('/admin/home');
    });
  });

  describe('stock figures', () => {
    it('shows the bricks ready', async () => {
      renderScreen();
      await loaded();
      expect(screen.getByRole('heading', { name: 'Bricks Ready' })).toBeInTheDocument();
      expect(screen.getByText('33,100')).toBeInTheDocument();
    });

    it('shows every raw material in kg beside its tons or bags', async () => {
      renderScreen();
      await loaded();
      expect(stockOf('Wet Ash')).toBe('34,308 Kg (34.31 Tons)');
      expect(stockOf('Marble Powder')).toBe('14,260 Kg (14.26 Tons)');
      expect(stockOf('Crusher Powder')).toBe('18,422.5 Kg (18.42 Tons)');
      expect(stockOf('Fly Ash')).toBe('7,975 Kg (7.97 Tons)');
      expect(stockOf('Cement')).toBe('2,775 Kg (56 Bags)');
    });

    it('shows zeros while nothing is stocked', async () => {
      mocked.getInventoryStock.mockResolvedValue([]);
      mocked.getProcurements.mockResolvedValue([]);
      mocked.getProductInventory.mockResolvedValue({ id: null, product_type: 'BRICKS', quantity: 0, updated_at: null });
      renderScreen();
      await screen.findByText('No procurements found');
      expect(stockOf('Wet Ash')).toBe('0 Kg (0.00 Tons)');
      expect(stockOf('Cement')).toBe('0 Kg (0 Bags)');
      expect(screen.getByText('Bricks (0 rounds)')).toBeInTheDocument();
    });

    it('shows a negative stock with its minus sign (production can run ahead of approvals)', async () => {
      mocked.getInventoryStock.mockResolvedValue([stockRow(WET, 34308), stockRow(CEMENT, -2225)]);
      renderScreen();
      await loaded();
      expect(stockOf('Cement')).toBe('-2,225 Kg (-45 Bags)');
    });

    it('matches materials by name, whatever the unit stored on the row', async () => {
      mocked.getInventoryStock.mockResolvedValue([{ ...stockRow(WET, 1000), materials: { id: 'x', name: 'WET ASH (grade 2)', unit: 'tons' } }]);
      renderScreen();
      await screen.findByText('1,000 Kg (1.00 Tons)');
    });

    it('works out how many rounds the stock allows and what limits it', async () => {
      renderScreen();
      await loaded();
      // crusher powder: 18,422.5 / 1,800 per round = 10 rounds, fewer than any other material
      expect(screen.getByText('Bricks (10 rounds)')).toBeInTheDocument();
      expect(screen.getByText('1,750')).toBeInTheDocument();
      expect(screen.getByText('Limited by: Crusher Powder')).toBeInTheDocument();
    });

    it.each([
      ['Cement', 25 * 3],
      ['Fly Ash', 110 * 3],
      ['Wet Ash', 90 * 3],
      ['Marble Powder', 90 * 3],
      ['Crusher Powder', 1800 * 3],
    ])('names %s as the limit when it only covers three rounds', async (limiting, kg) => {
      const plenty = (m: typeof WET) => stockRow(m, 1_000_000);
      const stock = [WET, MARBLE, CRUSHER, FLY, CEMENT].map((m) => (m.name === limiting ? stockRow(m, kg) : plenty(m)));
      mocked.getInventoryStock.mockResolvedValue(stock);
      renderScreen();
      await screen.findByText(`Limited by: ${limiting}`);
      expect(screen.getByText('Bricks (3 rounds)')).toBeInTheDocument();
      expect(screen.getByText('525')).toBeInTheDocument(); // 3 x 175 bricks
    });
  });

  describe('unapproved procurements', () => {
    it('shows how many are waiting', async () => {
      renderScreen();
      await loaded();
      expect(screen.getByRole('button', { name: /^Unapproved procurements/ })).toHaveTextContent('3');
    });

    it('shows no number when none are waiting', async () => {
      mocked.getUnapprovedProcurementCount.mockResolvedValue(0);
      renderScreen();
      await loaded();
      expect(screen.getByRole('button', { name: /^Unapproved procurements/ })).toHaveTextContent(/^Unapproved procurements$/);
    });

    it('does not filter the count by the period', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.selectOptions(screen.getByRole('combobox'), 'Last year');
      expect(mocked.getUnapprovedProcurementCount).toHaveBeenCalledTimes(1);
      expect(mocked.getUnapprovedProcurementCount).toHaveBeenCalledWith();
    });

    it('opens the list of requests', async () => {
      mocked.getUnapprovedProcurements.mockResolvedValue([]);
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(screen.getByRole('button', { name: /^Unapproved procurements/ }));
      expect(await screen.findByRole('heading', { level: 1, name: 'Unapproved Procurements' })).toBeInTheDocument();
    });
  });

  describe('Procurement tab', () => {
    it('lists this month\'s approved procurements in tons, bags and units, not kg', async () => {
      renderScreen();
      await loaded();
      expect(totals()).toHaveLength(3);
      expect(screen.getByText('5 Units')).toBeInTheDocument();
      expect(screen.getByText('100 Bags')).toBeInTheDocument();
      expect(screen.getByText('60 Tons')).toBeInTheDocument();
      expect(screen.queryByText(/^\d+ kg$/i)).not.toBeInTheDocument();
    });

    it('shows each procurement\'s date, vendor and total price', async () => {
      renderScreen();
      await loaded();
      expect(screen.getByText('10-Oct-2026')).toBeInTheDocument();
      expect(screen.getByText('08-Oct-2026')).toBeInTheDocument();
      expect(screen.getByText('05-Oct-2026')).toBeInTheDocument();
      expect(screen.getAllByText('ABC Suppliers')).toHaveLength(2);
      expect(screen.getByText('XYZ Materials')).toBeInTheDocument();
      expect(screen.getByText('₹16,000')).toBeInTheDocument();
      expect(screen.getByText('₹38,000')).toBeInTheDocument();
      expect(screen.getByText('₹54,000')).toBeInTheDocument();
    });

    it('shows N/A for a missing material or vendor', async () => {
      mocked.getProcurements.mockResolvedValue([{ ...PROCUREMENTS[0], materials: null, vendors: null }]);
      renderScreen();
      await loaded();
      expect(screen.getAllByText('N/A')).toHaveLength(2);
    });

    it('only asks for approved procurements', async () => {
      renderScreen();
      await loaded();
      expect(mocked.getProcurements).toHaveBeenCalledTimes(1);
    });

    it('says so when there are none', async () => {
      mocked.getProcurements.mockResolvedValue([]);
      renderScreen();
      expect(await screen.findByText('No procurements found')).toBeInTheDocument();
    });

    it('shows a loading message until the list arrives', async () => {
      mocked.getProcurements.mockReturnValue(new Promise(() => {}));
      renderScreen();
      expect(await screen.findByText('Loading procurements...')).toBeInTheDocument();
    });

    it('shows an empty list, not a crash, when procurements cannot be loaded', async () => {
      mocked.getProcurements.mockRejectedValue(new Error('down'));
      renderScreen();
      expect(await screen.findByText('No procurements found')).toBeInTheDocument();
    });

    describe('material chips', () => {
      it.each([
        ['Crusher Powder', '5 Units'],
        ['Cement', '100 Bags'],
        ['Wet Ash', '60 Tons'],
      ])('%s keeps only that material', async (name, quantity) => {
        const user = userEvent.setup();
        renderScreen();
        await loaded();
        await user.click(chip(name));
        expect(totals()).toHaveLength(1);
        expect(screen.getByText(quantity)).toBeInTheDocument();
      });

      it('says so when a material has none, and All brings the list back', async () => {
        const user = userEvent.setup();
        renderScreen();
        await loaded();
        await user.click(chip('Marble Powder'));
        expect(screen.getByText('No procurements found')).toBeInTheDocument();
        await user.click(chip('All'));
        expect(totals()).toHaveLength(3);
      });

      it('goes back to All when you leave the tab and return', async () => {
        const user = userEvent.setup();
        renderScreen();
        await loaded();
        await user.click(chip('Cement'));
        await user.click(tab('Usage'));
        await user.click(tab('Procurement'));
        expect(totals()).toHaveLength(3);
      });
    });

    describe('period', () => {
      it('defaults to the current month', async () => {
        renderScreen();
        await loaded();
        expect(screen.getByRole('combobox')).toHaveValue('Current month');
        expect(screen.getByRole('option', { name: 'Last month' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Last year' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Custom range' })).toBeInTheDocument();
      });

      it('Last month lists September', async () => {
        const user = userEvent.setup();
        renderScreen();
        await loaded();
        await user.selectOptions(screen.getByRole('combobox'), 'Last month');
        expect(totals()).toHaveLength(1);
        expect(screen.getByText('30 Tons')).toBeInTheDocument();
      });

      it('Last year lists last calendar year', async () => {
        const user = userEvent.setup();
        renderScreen();
        await loaded();
        await user.selectOptions(screen.getByRole('combobox'), 'Last year');
        expect(totals()).toHaveLength(1);
        expect(screen.getByText('80 Bags')).toBeInTheDocument();
      });

      it('Custom range waits for both dates, then lists what falls inside them', async () => {
        const user = userEvent.setup();
        renderScreen();
        await loaded();
        await user.selectOptions(screen.getByRole('combobox'), 'Custom range');
        expect(screen.getByRole('heading', { name: 'Custom Date Range' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Apply Filter' })).toBeDisabled();

        fireEvent.change(screen.getByLabelText(/^Start/), { target: { value: '2026-09-01' } });
        expect(screen.getByRole('button', { name: 'Apply Filter' })).toBeDisabled();
        fireEvent.change(screen.getByLabelText(/^End/), { target: { value: '2026-09-20' } });
        expect(screen.getByRole('button', { name: 'Apply Filter' })).toBeEnabled();
        await user.click(screen.getByRole('button', { name: 'Apply Filter' }));

        expect(screen.queryByRole('heading', { name: 'Custom Date Range' })).not.toBeInTheDocument();
        expect(screen.getByRole('combobox')).toHaveValue('Custom range');
        expect(totals()).toHaveLength(1);
        expect(screen.getByText('12-Sep-2026')).toBeInTheDocument();
      });

      it('Cancel leaves the period that was showing', async () => {
        const user = userEvent.setup();
        renderScreen();
        await loaded();
        await user.selectOptions(screen.getByRole('combobox'), 'Custom range');
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByRole('heading', { name: 'Custom Date Range' })).not.toBeInTheDocument();
        expect(screen.getByRole('combobox')).toHaveValue('Current month');
        expect(totals()).toHaveLength(3);
      });

      it('keeps the material chip when the period changes', async () => {
        const user = userEvent.setup();
        renderScreen();
        await loaded();
        await user.click(chip('Wet Ash'));
        await user.selectOptions(screen.getByRole('combobox'), 'Last month');
        expect(totals()).toHaveLength(1);
        expect(screen.getByText('30 Tons')).toBeInTheDocument();
        await user.click(chip('Cement'));
        expect(screen.getByText('No procurements found')).toBeInTheDocument();
      });
    });

    describe('Load More', () => {
      const many = Array.from({ length: 23 }, (_, i) =>
        procurement(`m${i}`, WET, ABC, i + 1, `2026-10-${String((i % 14) + 1).padStart(2, '0')}`, 100),
      );

      it('shows ten at a time', async () => {
        mocked.getProcurements.mockResolvedValue(many);
        const user = userEvent.setup();
        renderScreen();
        await loaded();
        expect(totals()).toHaveLength(10);
        await user.click(screen.getByRole('button', { name: 'Load More' }));
        expect(totals()).toHaveLength(20);
        await user.click(screen.getByRole('button', { name: 'Load More' }));
        expect(totals()).toHaveLength(23);
        expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
      });

      it('is not offered for exactly ten', async () => {
        mocked.getProcurements.mockResolvedValue(many.slice(0, 10));
        renderScreen();
        await loaded();
        expect(totals()).toHaveLength(10);
        expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
      });

      it('starts again at ten when a chip is picked', async () => {
        mocked.getProcurements.mockResolvedValue(many);
        const user = userEvent.setup();
        renderScreen();
        await loaded();
        await user.click(screen.getByRole('button', { name: 'Load More' }));
        expect(totals()).toHaveLength(20);
        await user.click(chip('Wet Ash'));
        expect(totals()).toHaveLength(10);
      });
    });
  });

  describe('Usage tab', () => {
    it('lists this month\'s production with each material in kg and tons, cement in bags', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(tab('Usage'));
      const latest = screen.getByRole('row', { name: /14-Oct-2026/ });
      expect(latest).toHaveTextContent('9,000');
      expect(latest).toHaveTextContent('25');
      expect(latest).toHaveTextContent('500 Kg (0.50 Tons)');
      expect(latest).toHaveTextContent('120.5 Kg (0.12 Tons)');
      expect(latest).toHaveTextContent('80 Kg (0.08 Tons)');
      expect(latest).toHaveTextContent('40 Kg (0.04 Tons)');
      expect(latest).toHaveTextContent('12 Bags (600 Kg)');
    });

    it('shows a material that was not used as zero', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(tab('Usage'));
      const row = screen.getByRole('row', { name: /13-Oct-2026/ });
      expect(row).toHaveTextContent('200 Kg (0.20 Tons)');
      expect(row).toHaveTextContent('0 Kg (0.00 Tons)');
      expect(row).toHaveTextContent('0 Bags (0 Kg)');
    });

    it('leaves out entries from other months', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(tab('Usage'));
      expect(screen.queryByRole('row', { name: /20-Sep-2026/ })).not.toBeInTheDocument();
      await user.selectOptions(screen.getByRole('combobox'), 'Last month');
      expect(screen.getByRole('row', { name: /20-Sep-2026/ })).toBeInTheDocument();
      expect(screen.queryByRole('row', { name: /14-Oct-2026/ })).not.toBeInTheDocument();
    });

    it('says so when nothing was produced', async () => {
      mocked.getProductionEntries.mockResolvedValue([]);
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(tab('Usage'));
      expect(screen.getByText('No production entries found')).toBeInTheDocument();
    });

    it('has no material chips', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(tab('Usage'));
      expect(screen.queryByRole('button', { name: 'Marble Powder', exact: true })).not.toBeInTheDocument();
    });
  });

  describe('Adjustments tab', () => {
    it('shows counted, corrected and the difference, in green for up, red for down, grey for none', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(tab('Adjustments'));
      const row = screen.getByRole('row', { name: /12-Oct-2026/ });
      expect(row).toHaveTextContent('33,100 → 33,000(-100)');
      expect(row).toHaveTextContent('14,260 → 14,300(+40)');
      expect(row).toHaveTextContent('34,308 → 34,308(0)');
      expect(within(row).getByText('(-100)')).toHaveStyle({ color: '#ef4444' });
      expect(within(row).getByText('(+40)')).toHaveStyle({ color: '#22c55e' });
      for (const unchanged of within(row).getAllByText('(0)')) {
        expect(unchanged).toHaveStyle({ color: '#999999' });
      }
    });

    it('shows N/A for a figure that was not counted and for a missing reason', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(tab('Adjustments'));
      expect(screen.getByRole('row', { name: /12-Oct-2026/ })).toHaveTextContent('Physical count correction');
      const noReason = screen.getByRole('row', { name: /11-Oct-2026/ });
      expect(noReason).toHaveTextContent('N/A');
      expect(noReason).toHaveTextContent('10 → 12(+2)');
    });

    it('says so when there are none', async () => {
      mocked.getAdjustments.mockResolvedValue([]);
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(tab('Adjustments'));
      expect(screen.getByText('No adjustments found')).toBeInTheDocument();
    });

    it('follows the period filter', async () => {
      const user = userEvent.setup();
      renderScreen();
      await loaded();
      await user.click(tab('Adjustments'));
      await user.selectOptions(screen.getByRole('combobox'), 'Last month');
      expect(screen.getByText('No adjustments found')).toBeInTheDocument();
    });
  });

  describe('Make adjustments', () => {
    const open = async (user: ReturnType<typeof userEvent.setup>) => {
      renderScreen();
      await loaded();
      await user.click(screen.getByRole('button', { name: 'Make adjustments' }));
      await screen.findByRole('heading', { name: 'Make Adjustments' });
    };
    const field = (label: string) => screen.getByLabelText(label);
    const type = async (user: ReturnType<typeof userEvent.setup>, label: string, value: string) => {
      await user.clear(field(label));
      await user.type(field(label), value);
    };

    it('opens with the current figures, cement in bags, and no reason', async () => {
      await open(userEvent.setup());
      expect(field('Bricks Ready')).toHaveValue(33100);
      expect(field('Wet Ash (Kg)')).toHaveValue(34308);
      expect(field('Marble Powder (Kg)')).toHaveValue(14260);
      expect(field('Crusher Powder (Kg)')).toHaveValue(18422.5);
      expect(field('Fly Ash (Kg)')).toHaveValue(7975);
      expect(field('Cement (Bags)')).toHaveValue(55.5);
      expect(field('Reason (Optional)')).toHaveValue('');
    });

    it('saves what was counted against what the system had, then confirms', async () => {
      const user = userEvent.setup();
      await open(user);
      await type(user, 'Bricks Ready', '33000');
      await type(user, 'Wet Ash (Kg)', '30000');
      await type(user, 'Cement (Bags)', '40');
      await user.type(field('Reason (Optional)'), 'Recount after the rain');
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(await screen.findByRole('heading', { name: 'Adjustment Submitted' })).toBeInTheDocument();
      expect(screen.getByText('The inventory adjustment has been recorded successfully.')).toBeInTheDocument();
      expect(mocked.createAdjustment).toHaveBeenCalledTimes(1);
      expect(mocked.createAdjustment).toHaveBeenCalledWith(
        '2026-10-15', // today
        33100, 34308, 14260, 18422.5, 7975, 55.5, // what the system had
        33000, 30000, 14260, 18422.5, 7975, 40, // what was counted
        'Recount after the rain',
        'admin-1',
      );
      expect(screen.queryByRole('heading', { name: 'Make Adjustments' })).not.toBeInTheDocument();
    });

    it('sends no reason when none was typed', async () => {
      const user = userEvent.setup();
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      await screen.findByRole('heading', { name: 'Adjustment Submitted' });
      expect(mocked.createAdjustment.mock.calls[0][13]).toBeNull();
    });

    it('treats a cleared figure as zero', async () => {
      const user = userEvent.setup();
      await open(user);
      await user.clear(field('Fly Ash (Kg)'));
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      await screen.findByRole('heading', { name: 'Adjustment Submitted' });
      expect(mocked.createAdjustment.mock.calls[0][11]).toBe(0); // adjusted fly ash
      expect(mocked.createAdjustment.mock.calls[0][5]).toBe(7975); // actual fly ash
    });

    it('reloads stock, bricks, procurements, usage and adjustments so the screen shows the new figures', async () => {
      mocked.createAdjustment.mockImplementation(async () => {
        mocked.getInventoryStock.mockResolvedValue([stockRow(WET, 30000), stockRow(CEMENT, 2000)]);
        mocked.getProductInventory.mockResolvedValue({ id: 'pi', product_type: 'BRICKS', quantity: 33000, updated_at: null });
      });
      const user = userEvent.setup();
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      await screen.findByRole('heading', { name: 'Adjustment Submitted' });

      await waitFor(() => expect(stockOf('Wet Ash')).toBe('30,000 Kg (30.00 Tons)'));
      expect(stockOf('Cement')).toBe('2,000 Kg (40 Bags)');
      expect(screen.getByText('33,000')).toBeInTheDocument();
      for (const read of [mocked.getInventoryStock, mocked.getProductInventory, mocked.getAdjustments, mocked.getProcurements, mocked.getProductionEntries]) {
        expect(read).toHaveBeenCalledTimes(2);
      }
    });

    it('the confirmation can be dismissed', async () => {
      const user = userEvent.setup();
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Submit' }));
      await screen.findByRole('heading', { name: 'Adjustment Submitted' });
      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(screen.queryByRole('heading', { name: 'Adjustment Submitted' })).not.toBeInTheDocument();
    });

    it('is locked and says Submitting... while it saves', async () => {
      let finish: () => void = () => {};
      mocked.createAdjustment.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
      const user = userEvent.setup();
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(await screen.findByRole('button', { name: 'Submitting...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      finish();
      await screen.findByRole('heading', { name: 'Adjustment Submitted' });
    });

    it('Cancel closes it without saving', async () => {
      const user = userEvent.setup();
      await open(user);
      await type(user, 'Wet Ash (Kg)', '1');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('heading', { name: 'Make Adjustments' })).not.toBeInTheDocument();
      expect(mocked.createAdjustment).not.toHaveBeenCalled();
    });

    it('reopening starts from the current figures, not from what was typed before', async () => {
      const user = userEvent.setup();
      await open(user);
      await type(user, 'Wet Ash (Kg)', '1');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      await user.click(screen.getByRole('button', { name: 'Make adjustments' }));
      expect(field('Wet Ash (Kg)')).toHaveValue(34308);
    });

    it('stays open with what was typed, and shows no confirmation, when saving fails', async () => {
      mocked.createAdjustment.mockRejectedValue(new Error('down'));
      const user = userEvent.setup();
      await open(user);
      await type(user, 'Wet Ash (Kg)', '30000');
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled());
      expect(screen.getByRole('heading', { name: 'Make Adjustments' })).toBeInTheDocument();
      expect(field('Wet Ash (Kg)')).toHaveValue(30000);
      expect(screen.queryByRole('heading', { name: 'Adjustment Submitted' })).not.toBeInTheDocument();
    });

    it('does not save when nobody is signed in', async () => {
      mocked.validateSession.mockResolvedValue(null);
      const user = userEvent.setup();
      await open(user);
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled());
      expect(mocked.createAdjustment).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'Make Adjustments' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Adjustment Submitted' })).not.toBeInTheDocument();
    });
  });
});
