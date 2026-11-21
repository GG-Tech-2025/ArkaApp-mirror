import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProductionStatisticsScreen } from './ProductionStatisticsScreen';
import * as middleware from '../../services/middleware.service';

vi.mock('../../services/middleware.service', () => ({ getProductionEntries: vi.fn() }));

// recharts measures real element sizes, which jsdom does not have. The stub keeps what the
// screen hands to the chart, so the data behind the graph can still be checked.
const chart = vi.hoisted(() => ({ data: [] as Array<{ date: string; bricks: number }> }));
vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Stub,
    LineChart: ({ data, children }: { data: typeof chart.data; children?: React.ReactNode }) => {
      chart.data = data;
      return <div data-testid="line-chart">{children}</div>;
    },
    Line: Stub, XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, Tooltip: Stub, Legend: Stub,
  };
});

const mocked = vi.mocked(middleware);

type Row = Record<string, unknown>;

const entry = (overrides: Row = {}): Row => ({
  id: 'p', production_date: '2026-10-14', bricks: 9000, round: 25,
  wet_ash_kg: 500, marble_powder_kg: 120.5, crusher_powder_kg: 80, fly_ash_kg: 40,
  cement_bags: 12, notes: 'Second shift ran late', created_by: 'u1', created_at: '2026-10-14T10:00:00Z',
  ...overrides,
});

const LATEST = entry({ id: 'p2' });
const OLDER = entry({
  id: 'p1', production_date: '2026-10-13', bricks: 7000, round: 1,
  wet_ash_kg: 300, marble_powder_kg: 0, crusher_powder_kg: 0, fly_ash_kg: 0, cement_bags: 0, notes: null,
});

function renderScreen(initial: string | { pathname: string; state: unknown } = '/admin/production') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/admin/production" element={<ProductionStatisticsScreen />} />
        <Route path="/admin/home" element={<div>admin home</div>} />
        <Route path="/admin/orders" element={<div>admin orders</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Renders once the history has loaded. */
async function renderLoaded(entries: Row[] = [LATEST, OLDER]) {
  mocked.getProductionEntries.mockResolvedValue(entries);
  const view = renderScreen();
  await screen.findByRole('table');
  // Wait for the rows (or the empty state) to settle.
  if (entries.length) await screen.findAllByRole('button', { name: /View details/ });
  return view;
}

const labelled = (label: string) => screen.getByText(label).parentElement as HTMLElement;
const card = () => screen.getByRole('heading', { name: 'Last Production' }).parentElement as HTMLElement;
const details = () => screen.getByRole('heading', { name: 'Production Entry' }).parentElement as HTMLElement;
const rowFor = (date: string) => screen.getByRole('row', { name: new RegExp(date) });
const cellsOf = (row: HTMLElement) => within(row).getAllByRole('cell');
const ring = (container: HTMLElement) => container.querySelector('circle[stroke="#10B981"]') as SVGCircleElement;

beforeEach(() => {
  vi.clearAllMocks();
  chart.data = [];
  mocked.getProductionEntries.mockResolvedValue([LATEST, OLDER]);
});

describe('header and navigation', () => {
  it('shows the title and what the screen is for', async () => {
    await renderLoaded();
    expect(screen.getByRole('heading', { level: 1, name: 'Production Statistics' })).toBeInTheDocument();
    expect(screen.getByText('View production metrics and performance')).toBeInTheDocument();
  });

  it('Back to Home goes to the admin dashboard', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Back to Home' }));
    expect(await screen.findByText('admin home')).toBeInTheDocument();
  });

  it('Back to Home returns to where the admin came from when they opened it from elsewhere', async () => {
    const user = userEvent.setup();
    mocked.getProductionEntries.mockResolvedValue([LATEST]);
    renderScreen({ pathname: '/admin/production', state: { from: '/admin/orders' } });
    await user.click(await screen.findByRole('button', { name: 'Back to Home' }));
    expect(await screen.findByText('admin orders')).toBeInTheDocument();
  });
});

describe('loading', () => {
  it('shows "Loading chart…" instead of the chart until the history arrives', async () => {
    let resolve!: (rows: Row[]) => void;
    mocked.getProductionEntries.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderScreen();

    expect(await screen.findByText('Loading chart…')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();

    resolve([LATEST]);
    expect(await screen.findByTestId('line-chart')).toBeInTheDocument();
    expect(screen.queryByText('Loading chart…')).not.toBeInTheDocument();
  });

  it('asks for the history once', async () => {
    await renderLoaded();
    expect(mocked.getProductionEntries).toHaveBeenCalledTimes(1);
  });
});

describe("This Month's Production graph", () => {
  it('has its heading', async () => {
    await renderLoaded();
    expect(screen.getByRole('heading', { name: "This Month's Production" })).toBeInTheDocument();
  });

  it('plots bricks per day from the oldest day to the newest, with short date labels', async () => {
    await renderLoaded();
    // The history arrives newest first; the graph reads left to right in time.
    expect(chart.data).toEqual([
      { date: '13 Oct', bricks: 7000 },
      { date: '14 Oct', bricks: 9000 },
    ]);
  });

  it('plots only the 30 most recent days, even when there are more', async () => {
    const days = Array.from({ length: 35 }, (_, i) =>
      entry({ id: `d${i}`, production_date: `2026-09-${String(35 - i).padStart(2, '0').slice(-2)}`, bricks: 1000 + i }),
    );
    // Newest first: bricks 1000 is the newest day, 1034 the oldest.
    await renderLoaded(days);
    expect(chart.data).toHaveLength(30);
    expect(chart.data[29].bricks).toBe(1000);
    expect(chart.data[0].bricks).toBe(1029);
    expect(screen.getAllByRole('row')).toHaveLength(36); // header + all 35
  });

  it('plots nothing when there is no history', async () => {
    await renderLoaded([]);
    expect(chart.data).toEqual([]);
  });

  it('labels the 1st of a month and single-digit days without a leading zero', async () => {
    await renderLoaded([entry({ production_date: '2026-11-01' }), entry({ production_date: '2026-10-05' })]);
    expect(chart.data.map((d) => d.date)).toEqual(['5 Oct', '1 Nov']);
  });
});

describe('Last Production card', () => {
  it('shows the newest entry: bricks against the 15,000 target, and the round', async () => {
    await renderLoaded();
    expect(screen.getByRole('heading', { name: 'Last Production' })).toBeInTheDocument();
    expect(within(card()).getByText('9,000')).toBeInTheDocument();
    expect(within(card()).getByText('/ 15,000')).toBeInTheDocument();
    expect(labelled('Round:')).toHaveTextContent('25');
  });

  it('uses the first entry the backend returns, not an older one', async () => {
    await renderLoaded([OLDER, LATEST]);
    expect(labelled('Round:')).toHaveTextContent(/^Round:1$/);
  });

  it('shows tons with the total kg beneath for each material', async () => {
    await renderLoaded();
    // 25 rounds × 500 kg = 12,500 kg = 12.50 tons
    expect(within(labelled('Wet Ash:')).getByText('12.50 Tons')).toBeInTheDocument();
    expect(within(labelled('Wet Ash:')).getByText('12,500 kg')).toBeInTheDocument();
    // 25 × 120.5 = 3,012.5 kg keeps its decimal
    expect(within(labelled('Marble Powder:')).getByText('3.01 Tons')).toBeInTheDocument();
    expect(within(labelled('Marble Powder:')).getByText('3,012.5 kg')).toBeInTheDocument();
    expect(within(labelled('Crusher Powder:')).getByText('2.00 Tons')).toBeInTheDocument();
    expect(within(labelled('Crusher Powder:')).getByText('2,000 kg')).toBeInTheDocument();
    expect(within(labelled('Fly Ash:')).getByText('1.00 Tons')).toBeInTheDocument();
    expect(within(labelled('Fly Ash:')).getByText('1,000 kg')).toBeInTheDocument();
  });

  it('shows cement in bags, with no kg figure', async () => {
    await renderLoaded();
    expect(within(labelled('Cement:')).getByText('12 Bags')).toBeInTheDocument();
    expect(within(labelled('Cement:')).queryByText(/kg$/)).not.toBeInTheDocument();
  });

  it('shows half a bag of cement as entered, not rounded up to a whole bag', async () => {
    await renderLoaded([entry({ cement_bags: 7.5 })]);
    expect(within(labelled('Cement:')).getByText('7.5 Bags')).toBeInTheDocument();
  });

  it('fills the progress ring in proportion to the target', async () => {
    const { container } = await renderLoaded();
    // 9,000 of 15,000 = 60% done, so 40% of the 440 ring is left empty.
    expect(Number(ring(container).getAttribute('stroke-dashoffset'))).toBeCloseTo(176);
  });

  it('shows an empty ring for a day with no bricks', async () => {
    const { container } = await renderLoaded([entry({ bricks: 0 })]);
    expect(within(card()).getByText('0')).toBeInTheDocument();
    expect(Number(ring(container).getAttribute('stroke-dashoffset'))).toBeCloseTo(440);
  });

  it('shows a full ring, not an overflowing one, when production beats the target', async () => {
    const { container } = await renderLoaded([entry({ bricks: 20000 })]);
    expect(within(card()).getByText('20,000')).toBeInTheDocument();
    expect(Number(ring(container).getAttribute('stroke-dashoffset'))).toBeCloseTo(0);
  });

  it('shows dashes and an empty ring when there is no production yet', async () => {
    const { container } = await renderLoaded([]);
    for (const label of ['Round:', 'Wet Ash:', 'Marble Powder:', 'Crusher Powder:', 'Fly Ash:', 'Cement:']) {
      expect(within(labelled(label)).getByText('-')).toBeInTheDocument();
    }
    expect(Number(ring(container).getAttribute('stroke-dashoffset'))).toBeCloseTo(440);
    expect(screen.queryByText(/ kg$/)).not.toBeInTheDocument();
  });
});

describe('Production History table', () => {
  it('has a column for each figure, in both units for the materials', async () => {
    await renderLoaded();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Date', 'No of Bricks', 'Round',
      'Wet Ash (Tons / kg)', 'Marble Powder (Tons / kg)', 'Crusher Powder (Tons / kg)', 'Fly Ash (Tons / kg)',
      'Cement (Bags)', 'Notes', 'Details',
    ]);
  });

  it('lists one row per entry, in the order the backend returns them', async () => {
    await renderLoaded();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('14-Oct-2026');
    expect(rows[1]).toHaveTextContent('13-Oct-2026');
  });

  it('shows each figure formatted for reading', async () => {
    await renderLoaded([entry({ production_date: '2026-10-05', bricks: 1234567 })]);
    const cells = cellsOf(rowFor('05-Oct-2026'));
    expect(cells[0]).toHaveTextContent(/^05-Oct-2026$/);
    expect(cells[1]).toHaveTextContent(/^1,234,567$/);
    expect(cells[2]).toHaveTextContent(/^25$/);
    expect(cells[3]).toHaveTextContent(/^12\.50 Tons12,500 kg$/);
    expect(cells[4]).toHaveTextContent(/^3\.01 Tons3,012\.5 kg$/);
    expect(cells[5]).toHaveTextContent(/^2\.00 Tons2,000 kg$/);
    expect(cells[6]).toHaveTextContent(/^1\.00 Tons1,000 kg$/);
    expect(cells[7]).toHaveTextContent(/^12$/);
    expect(cells[8]).toHaveTextContent('Second shift ran late');
  });

  it('rounds tons to two decimals and keeps fractional bags', async () => {
    await renderLoaded([entry({ round: 3, wet_ash_kg: 333.337, cement_bags: 12.6 })]);
    const cells = cellsOf(screen.getAllByRole('row')[1]);
    // 3 × 333.337 = 1,000.011 kg
    expect(cells[3]).toHaveTextContent(/^1\.00 Tons1,000\.01 kg$/);
    expect(cells[7]).toHaveTextContent(/^12\.6$/);
  });

  it('shows a full note when it is 25 characters or fewer', async () => {
    const note = 'a'.repeat(25);
    await renderLoaded([entry({ notes: note })]);
    expect(cellsOf(screen.getAllByRole('row')[1])[8]).toHaveTextContent(new RegExp(`^${note}$`));
  });

  it('cuts a longer note to 25 characters and adds an ellipsis', async () => {
    await renderLoaded([entry({ notes: `${'a'.repeat(25)}b` })]);
    expect(cellsOf(screen.getAllByRole('row')[1])[8]).toHaveTextContent(new RegExp(`^${'a'.repeat(25)}\\.\\.\\.$`));
  });

  it('shows a dash for an entry with no note', async () => {
    await renderLoaded([OLDER]);
    expect(cellsOf(screen.getAllByRole('row')[1])[8]).toHaveTextContent(/^—$/);
  });

  it('treats a material the backend left empty as zero', async () => {
    await renderLoaded([entry({ wet_ash_kg: null, marble_powder_kg: null, crusher_powder_kg: null, fly_ash_kg: null, cement_bags: null })]);
    const cells = cellsOf(screen.getAllByRole('row')[1]);
    expect(cells[3]).toHaveTextContent(/^0\.00 Tons0 kg$/);
    expect(cells[6]).toHaveTextContent(/^0\.00 Tons0 kg$/);
    expect(cells[7]).toHaveTextContent(/^0$/);
  });

  it('also understands entries already in camelCase', async () => {
    await renderLoaded([{ date: '2026-10-14', bricks: 4000, round: 2, wetAshKg: 250, marblePowderKg: 0, crusherPowderKg: 0, flyAshKg: 0, cementBags: 3, notes: null }]);
    const cells = cellsOf(screen.getAllByRole('row')[1]);
    expect(cells[0]).toHaveTextContent('14-Oct-2026');
    expect(cells[3]).toHaveTextContent(/^0\.50 Tons500 kg$/);
    expect(cells[7]).toHaveTextContent(/^3$/);
  });

  it('shows half a bag of cement as 7.5, matching the 375 kg the inventory uses', async () => {
    await renderLoaded([entry({ cement_bags: 7.5 })]);
    expect(cellsOf(screen.getAllByRole('row')[1])[7]).toHaveTextContent(/^7\.5$/);
  });

  it('groups large bag counts with thousands separators', async () => {
    await renderLoaded([entry({ cement_bags: 1200 })]);
    expect(cellsOf(screen.getAllByRole('row')[1])[7]).toHaveTextContent(/^1,200$/);
  });

  it('shows only the header row when there is no history', async () => {
    await renderLoaded([]);
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });

  it('has no Load More button', async () => {
    await renderLoaded();
    expect(screen.queryByRole('button', { name: 'Load More' })).not.toBeInTheDocument();
  });
});

describe('entry details', () => {
  it('is closed until a row is opened', async () => {
    await renderLoaded();
    expect(screen.queryByRole('heading', { name: 'Production Entry' })).not.toBeInTheDocument();
  });

  it('gives each details button a name that says which day it opens', async () => {
    await renderLoaded();
    expect(screen.getByRole('button', { name: 'View details for 14-Oct-2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details for 13-Oct-2026' })).toBeInTheDocument();
  });

  it('shows every figure of the chosen entry, with the working for each material', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'View details for 14-Oct-2026' }));

    expect(screen.getByRole('heading', { name: 'Production Entry' })).toBeInTheDocument();
    const modal = details();
    expect(modal).toHaveTextContent('Date14-Oct-2026');
    expect(modal).toHaveTextContent('Bricks9,000');
    expect(modal).toHaveTextContent('Round25');
    expect(modal).toHaveTextContent('Wet Ash12.50 Tons500 kg × 25 rounds = 12,500 kg');
    expect(modal).toHaveTextContent('Marble Powder3.01 Tons120.5 kg × 25 rounds = 3,012.5 kg');
    expect(modal).toHaveTextContent('Crusher Powder2.00 Tons80 kg × 25 rounds = 2,000 kg');
    expect(modal).toHaveTextContent('Fly Ash1.00 Tons40 kg × 25 rounds = 1,000 kg');
    expect(modal).toHaveTextContent('Cement12 Bags');
  });

  it('shows the other entry when a different row is chosen', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'View details for 13-Oct-2026' }));
    const modal = details();
    expect(modal).toHaveTextContent('Date13-Oct-2026');
    expect(modal).toHaveTextContent('Bricks7,000');
    expect(modal).toHaveTextContent('300 kg × 1 round = 300 kg');
  });

  it('shows the whole note, not the shortened one from the table', async () => {
    const user = userEvent.setup();
    const long = 'Kiln two was restarted after lunch because the burner stalled twice';
    await renderLoaded([entry({ notes: long })]);
    expect(screen.queryByText(long)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /View details/ }));
    expect(screen.getByText(long)).toBeInTheDocument();
  });

  it('shows half a bag of cement as entered', async () => {
    const user = userEvent.setup();
    await renderLoaded([entry({ cement_bags: 7.5 })]);
    await user.click(screen.getByRole('button', { name: /View details/ }));
    expect(details()).toHaveTextContent('Cement7.5 Bags');
  });

  it('shows a dash when the entry has no note', async () => {
    const user = userEvent.setup();
    await renderLoaded([OLDER]);
    await user.click(screen.getByRole('button', { name: /View details/ }));
    expect(within(details()).getByText('Notes').parentElement).toHaveTextContent(/^Notes—$/);
  });

  it('closes with Close, and another entry can be opened afterwards', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'View details for 14-Oct-2026' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Production Entry' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View details for 13-Oct-2026' }));
    expect(details()).toHaveTextContent('Date13-Oct-2026');
  });

  it('can be opened and closed from the keyboard', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    screen.getByRole('button', { name: 'View details for 14-Oct-2026' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'Production Entry' })).toBeInTheDocument();
    screen.getByRole('button', { name: 'Close' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('heading', { name: 'Production Entry' })).not.toBeInTheDocument();
  });
});

describe('when the history cannot be loaded', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocked.getProductionEntries.mockRejectedValue(new Error('boom'));
  });

  it('says so in a popup', async () => {
    renderScreen();
    expect(await screen.findByRole('heading', { name: 'Error Loading Data' })).toBeInTheDocument();
    expect(screen.getByText('Failed to load production entries. Please try again.')).toBeInTheDocument();
  });

  it('leaves no figures behind the popup', async () => {
    renderScreen();
    await screen.findByRole('heading', { name: 'Error Loading Data' });
    expect(within(labelled('Wet Ash:')).getByText('-')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });

  it('OK closes the popup and goes to the admin dashboard', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await screen.findByText('admin home')).toBeInTheDocument();
  });

  it('shows no popup when loading works', async () => {
    mocked.getProductionEntries.mockResolvedValue([LATEST]);
    await renderLoaded([LATEST]);
    expect(screen.queryByRole('heading', { name: 'Error Loading Data' })).not.toBeInTheDocument();
  });
});
