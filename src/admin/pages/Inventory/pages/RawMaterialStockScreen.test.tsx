import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { RawMaterialStockScreen } from './RawMaterialStockScreen';
import * as middleware from '../../../../services/middleware.service';

vi.mock('../../../../services/middleware.service', () => ({ getInventoryStock: vi.fn() }));

const mocked = vi.mocked(middleware);

const NOW = new Date(2026, 9, 15, 10, 0, 0);
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const row = (name: string, quantity: number, updatedAt = ago(2 * DAY), unit = 'kg') => ({
  material_id: `id-${name}`,
  quantity,
  updated_at: updatedAt,
  materials: { id: `id-${name}`, name, unit },
});

const STOCK = [
  row('Wet Ash', 34308),
  row('Marble Powder', 14260),
  row('Crusher Powder', 18422.5),
  row('Fly Ash', 7975),
  row('Cement', 2775),
];

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen(from?: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/admin/inventory/raw-material-stock', state: from ? { from } : undefined }]}>
      <Routes>
        <Route path="/admin/inventory/raw-material-stock" element={<RawMaterialStockScreen />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const names = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
const summary = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
/** The row for one material: its name, when it was updated, and its quantity. */
const rowOf = (name: string) => screen.getByRole('heading', { level: 3, name }).closest('div[class*="justify-between"]') as HTMLElement;

describe('RawMaterialStockScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocked.getInventoryStock.mockResolvedValue(STOCK);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('says what the screen is for', async () => {
    renderScreen();
    expect(await screen.findByRole('heading', { level: 1, name: 'Raw Material Stock' })).toBeInTheDocument();
    expect(screen.getByText('View and track all raw material inventory levels')).toBeInTheDocument();
  });

  it('lists every material alphabetically', async () => {
    renderScreen();
    await screen.findByRole('heading', { level: 3, name: 'Cement' });
    expect(names()).toEqual(['Cement', 'Crusher Powder', 'Fly Ash', 'Marble Powder', 'Wet Ash']);
  });

  describe('quantities', () => {
    it.each([
      ['Cement', '56 Bags (2,775 Kg)'],
      ['Crusher Powder', '4 Units (18,422.5 Kg)'],
      ['Fly Ash', '7.97 Tons (7,975 Kg)'],
      ['Marble Powder', '14.26 Tons (14,260 Kg)'],
      ['Wet Ash', '34.31 Tons (34,308 Kg)'],
    ])('shows %s as %s', async (name, shown) => {
      renderScreen();
      await screen.findByRole('heading', { level: 3, name });
      expect(within(rowOf(name)).getByText(shown)).toBeInTheDocument();
    });

    it('shows a negative stock with its minus sign', async () => {
      mocked.getInventoryStock.mockResolvedValue([row('Cement', -2225)]);
      renderScreen();
      expect(await screen.findByText('-45 Bags (-2,225 Kg)')).toBeInTheDocument();
    });

    it('falls back to the quantity and stored unit for a material it does not know', async () => {
      mocked.getInventoryStock.mockResolvedValue([row('Sand', 1500, ago(DAY), 'kg')]);
      renderScreen();
      expect(await screen.findByText('1,500 kg')).toBeInTheDocument();
    });

    it('calls a row with no material "Unknown Material"', async () => {
      mocked.getInventoryStock.mockResolvedValue([{ material_id: 'x', quantity: 5000, updated_at: ago(DAY) }]);
      renderScreen();
      expect(await screen.findByRole('heading', { level: 3, name: 'Unknown Material' })).toBeInTheDocument();
      expect(screen.getByText('5,000 units')).toBeInTheDocument();
    });
  });

  describe('summary', () => {
    it('counts the materials and adds up the quantity', async () => {
      renderScreen();
      await screen.findByRole('heading', { level: 3, name: 'Cement' });
      expect(summary('Total Materials')).toBe('5');
      expect(summary('Total Quantity')).toBe('77,740.5');
    });

    it('counts the materials below 1,000 as low stock, and flags each one', async () => {
      mocked.getInventoryStock.mockResolvedValue([row('Cement', 999), row('Fly Ash', 1000), row('Wet Ash', 0), row('Marble Powder', -5)]);
      renderScreen();
      await screen.findByRole('heading', { level: 3, name: 'Cement' });
      expect(summary('Low Stock Items')).toBe('3');
      expect(screen.getAllByText('Low stock ⚠️')).toHaveLength(3);
      expect(within(rowOf('Fly Ash')).queryByText('Low stock ⚠️')).not.toBeInTheDocument();
      expect(within(rowOf('Cement')).getByText('Low stock ⚠️')).toBeInTheDocument();
    });

    it('shows no low stock when everything is above the line', async () => {
      renderScreen();
      await screen.findByRole('heading', { level: 3, name: 'Cement' });
      expect(summary('Low Stock Items')).toBe('0');
      expect(screen.queryByText('Low stock ⚠️')).not.toBeInTheDocument();
    });
  });

  describe('last updated', () => {
    it.each([
      [5 * MINUTE, '5 minutes ago'],
      [0, '0 minutes ago'],
      [3 * HOUR, '3 hours ago'],
      [2 * DAY, '2 days ago'],
      [29 * DAY, '29 days ago'],
    ])('says %s ms ago as "%s"', async (elapsed, expected) => {
      mocked.getInventoryStock.mockResolvedValue([row('Cement', 5000, ago(elapsed))]);
      renderScreen();
      expect(await screen.findByText(`Last updated: ${expected}`)).toBeInTheDocument();
    });

    it('gives the date once it is a month or more old', async () => {
      mocked.getInventoryStock.mockResolvedValue([row('Cement', 5000, '2026-08-01T06:00:00Z')]);
      renderScreen();
      expect(await screen.findByText('Last updated: Aug 1, 2026')).toBeInTheDocument();
    });
  });

  describe('loading and errors', () => {
    it('shows a loading message until the stock arrives', async () => {
      mocked.getInventoryStock.mockReturnValue(new Promise(() => {}));
      renderScreen();
      expect(await screen.findByText('Loading inventory stock...')).toBeInTheDocument();
      expect(screen.queryByText('No materials in inventory')).not.toBeInTheDocument();
    });

    it('says so when no material is stocked', async () => {
      mocked.getInventoryStock.mockResolvedValue([]);
      renderScreen();
      expect(await screen.findByText('No materials in inventory')).toBeInTheDocument();
      expect(summary('Total Materials')).toBe('0');
    });

    it('shows an error that can be closed when the stock cannot be loaded', async () => {
      mocked.getInventoryStock.mockRejectedValue(new Error('down'));
      const user = userEvent.setup();
      renderScreen();
      expect(await screen.findByRole('heading', { name: 'Error' })).toBeInTheDocument();
      expect(screen.getByText('Failed to load inventory stock. Please try again.')).toBeInTheDocument();
      expect(screen.getByText('No materials in inventory')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('heading', { name: 'Error' })).not.toBeInTheDocument();
    });
  });

  it('Back to Inventory Management returns to where the admin came from', async () => {
    const user = userEvent.setup();
    renderScreen('/admin/inventory');
    await screen.findByRole('heading', { level: 3, name: 'Cement' });
    await user.click(screen.getByRole('button', { name: /Back to Inventory Management/ }));
    expect(screen.getByTestId('path')).toHaveTextContent('/admin/inventory');
  });
});
