import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ProductionEntry } from './ProductionEntry';
import * as middleware from '../../services/middleware.service';

vi.mock('../../services/middleware.service', () => ({
  createProductionEntry: vi.fn(),
  validateSession: vi.fn(),
}));

const mocked = vi.mocked(middleware);

const USER_ID = 'user-1';
// A mid-month morning, so "today", earlier days and later days sit on one calendar page.
const NOW = new Date(2026, 9, 15, 10, 0, 0);

const REQUIRED_MESSAGES = {
  round: 'Round is required',
  bricks: 'Bricks is required',
  wetAsh: 'Wet Ash is required',
  marblePowder: 'Marble Powder is required',
  crusherPowder: 'Crusher Powder is required',
  flyAsh: 'Fly Ash is required',
  cement: 'Cement is required',
};

type User = ReturnType<typeof userEvent.setup>;
type FieldKey = keyof typeof REQUIRED_MESSAGES;

function Destination() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/employee/production-entry']}>
      <Routes>
        <Route path="/employee/production-entry" element={<ProductionEntry />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

const fields: Record<FieldKey, () => HTMLElement> = {
  round: () => screen.getByLabelText(/^Round/),
  bricks: () => screen.getByLabelText(/^Bricks/),
  wetAsh: () => screen.getByLabelText(/^Wet Ash/),
  marblePowder: () => screen.getByLabelText(/^Marble Powder/),
  crusherPowder: () => screen.getByLabelText(/^Crusher Powder/),
  flyAsh: () => screen.getByLabelText(/^Fly Ash/),
  cement: () => screen.getByLabelText(/^Cement/),
};
const notesField = () => screen.getByLabelText('Notes');
const submitButton = () => screen.getByRole('button', { name: /Submit/ });
const dateButton = () => screen.getByRole('button', { name: /2026|Select a date/ });

const VALID: Record<FieldKey, string> = {
  round: '2',
  bricks: '1000',
  wetAsh: '150.5',
  marblePowder: '80',
  crusherPowder: '60',
  flyAsh: '40',
  cement: '12.5',
};

async function fillValid(user: User, overrides: Partial<Record<FieldKey, string>> = {}) {
  const values = { ...VALID, ...overrides };
  for (const key of Object.keys(values) as FieldKey[]) {
    if (values[key] !== '') await user.type(fields[key](), values[key]);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  mocked.validateSession.mockResolvedValue({ id: USER_ID } as never);
  mocked.createProductionEntry.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

describe('ProductionEntry', () => {
  describe('layout', () => {
    it('shows the heading and the subtitle', () => {
      renderScreen();

      expect(screen.getByRole('heading', { name: 'Production Entry' })).toBeInTheDocument();
      expect(screen.getByText('Enter the production details for today')).toBeInTheDocument();
    });

    it('has a field for every production figure, with the unit in its label', () => {
      renderScreen();

      expect(fields.round()).toBeInTheDocument();
      expect(fields.bricks()).toBeInTheDocument();
      expect(screen.getByText(/Wet Ash \(Kg\)/)).toBeInTheDocument();
      expect(screen.getByText(/Marble Powder \(Kg\)/)).toBeInTheDocument();
      expect(screen.getByText(/Crusher Powder \(Kg\)/)).toBeInTheDocument();
      expect(screen.getByText(/Fly Ash \(Kg\)/)).toBeInTheDocument();
      expect(screen.getByText(/Cement \(Bags\)/)).toBeInTheDocument();
      expect(notesField()).toBeInTheDocument();
    });

    it('marks every field but Notes as required', () => {
      renderScreen();

      for (const label of [/^Date/, /^Round/, /^Bricks/, /^Wet Ash/, /^Marble Powder/, /^Crusher Powder/, /^Fly Ash/, /^Cement/]) {
        expect(screen.getByText(label).querySelector('.text-red-600')).toHaveTextContent('*');
      }
      expect(screen.getByText('Notes').querySelector('.text-red-600')).toBeNull();
    });

    it('uses number inputs, with decimals allowed for the materials only', () => {
      renderScreen();

      for (const key of Object.keys(fields) as FieldKey[]) {
        expect(fields[key]()).toHaveAttribute('type', 'number');
      }
      expect(fields.round()).toHaveAttribute('min', '1');
      expect(fields.round()).toHaveAttribute('max', '99');
      for (const key of ['bricks', 'wetAsh', 'marblePowder', 'crusherPowder', 'flyAsh', 'cement'] as FieldKey[]) {
        expect(fields[key]()).toHaveAttribute('min', '0');
      }
      for (const key of ['wetAsh', 'marblePowder', 'crusherPowder', 'flyAsh', 'cement'] as FieldKey[]) {
        expect(fields[key]()).toHaveAttribute('step', '0.01');
      }
      expect(fields.bricks()).not.toHaveAttribute('step');
    });

    it('starts empty with today as the date, and Submit ready', () => {
      renderScreen();

      for (const key of Object.keys(fields) as FieldKey[]) expect(fields[key]()).toHaveValue(null);
      expect(notesField()).toHaveValue('');
      expect(dateButton()).toHaveTextContent('October 15th, 2026');
      expect(submitButton()).toBeEnabled();
    });

    it('goes back to the home screen from Back to Home', async () => {
      const user = setup();
      renderScreen();

      await user.click(screen.getByRole('button', { name: /Back to Home/ }));

      expect(screen.getByTestId('path')).toHaveTextContent('/employee/home');
    });

    it('lets go of focus when the mouse wheel is turned over a number field', async () => {
      const user = setup();
      renderScreen();
      await user.click(fields.bricks());
      expect(fields.bricks()).toHaveFocus();

      fields.bricks().dispatchEvent(new WheelEvent('wheel', { bubbles: true }));

      expect(fields.bricks()).not.toHaveFocus();
    });
  });

  describe('validation', () => {
    it('reports every missing figure on an empty form, but not the date, which defaults to today', async () => {
      const user = setup();
      renderScreen();

      await user.click(submitButton());

      for (const message of Object.values(REQUIRED_MESSAGES)) {
        expect(screen.getByText(message)).toBeInTheDocument();
      }
      expect(screen.queryByText('Date is required')).not.toBeInTheDocument();
      expect(mocked.createProductionEntry).not.toHaveBeenCalled();
    });

    it.each(Object.keys(REQUIRED_MESSAGES) as FieldKey[])('reports only %s when it alone is missing', async (key) => {
      const user = setup();
      renderScreen();
      await fillValid(user, { [key]: '' });

      await user.click(submitButton());

      expect(screen.getByText(REQUIRED_MESSAGES[key])).toBeInTheDocument();
      expect(screen.getAllByText(/ is required$/)).toHaveLength(1);
      expect(mocked.createProductionEntry).not.toHaveBeenCalled();
    });

    it.each(['bricks', 'wetAsh', 'marblePowder', 'crusherPowder', 'flyAsh', 'cement'] as FieldKey[])(
      'treats a zero %s as missing',
      async (key) => {
        const user = setup();
        renderScreen();
        await fillValid(user, { [key]: '0' });

        await user.click(submitButton());

        expect(screen.getByText(REQUIRED_MESSAGES[key])).toBeInTheDocument();
        expect(mocked.createProductionEntry).not.toHaveBeenCalled();
      },
    );

    it('rejects a round above 99', async () => {
      const user = setup();
      renderScreen();
      await fillValid(user, { round: '100' });

      await user.click(submitButton());

      expect(screen.getByText('Round cannot exceed 99')).toBeInTheDocument();
      expect(mocked.createProductionEntry).not.toHaveBeenCalled();
    });

    it.each(['1', '99'])('accepts round %s', async (round) => {
      const user = setup();
      renderScreen();
      await fillValid(user, { round });

      await user.click(submitButton());

      await waitFor(() => expect(mocked.createProductionEntry).toHaveBeenCalledTimes(1));
      expect(mocked.createProductionEntry.mock.calls[0][0].round).toBe(Number(round));
    });

    it('does not contact the server or show a popup when validation fails', async () => {
      const user = setup();
      renderScreen();

      await user.click(submitButton());

      expect(mocked.validateSession).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument();
    });

    it('does not require Notes', async () => {
      const user = setup();
      renderScreen();
      await fillValid(user);

      await user.click(submitButton());

      await waitFor(() => expect(mocked.createProductionEntry).toHaveBeenCalledTimes(1));
    });

    it('clears the round error as soon as the round is changed', async () => {
      const user = setup();
      renderScreen();
      await user.click(submitButton());
      expect(screen.getByText(REQUIRED_MESSAGES.round)).toBeInTheDocument();

      await user.type(fields.round(), '1');

      expect(screen.queryByText(REQUIRED_MESSAGES.round)).not.toBeInTheDocument();
    });

    it('clears an over-99 round error as soon as the round is changed', async () => {
      const user = setup();
      renderScreen();
      await fillValid(user, { round: '100' });
      await user.click(submitButton());
      expect(screen.getByText('Round cannot exceed 99')).toBeInTheDocument();

      await user.type(fields.round(), '0');

      expect(screen.queryByText('Round cannot exceed 99')).not.toBeInTheDocument();
    });

    it('gives a fixed form a clean submission after the errors', async () => {
      const user = setup();
      renderScreen();
      await user.click(submitButton());
      await fillValid(user);

      await user.click(submitButton());

      await waitFor(() => expect(mocked.createProductionEntry).toHaveBeenCalledTimes(1));
      expect(screen.queryByText(/ is required$/)).not.toBeInTheDocument();
    });
  });

  describe('negative quantities', () => {
    const QUANTITIES: Array<[FieldKey, string]> = [
      ['bricks', 'Bricks'],
      ['wetAsh', 'Wet Ash'],
      ['marblePowder', 'Marble Powder'],
      ['crusherPowder', 'Crusher Powder'],
      ['flyAsh', 'Fly Ash'],
      ['cement', 'Cement'],
    ];

    it.each(QUANTITIES)('refuses a negative %s with a message, without calling the server', async (key, label) => {
      const user = setup();
      renderScreen();
      await fillValid(user, { [key]: '-5' });

      await user.click(submitButton());

      expect(screen.getByText(`${label} cannot be negative`)).toBeInTheDocument();
      expect(screen.queryByText(REQUIRED_MESSAGES[key])).not.toBeInTheDocument();
      expect(mocked.validateSession).not.toHaveBeenCalled();
      expect(mocked.createProductionEntry).not.toHaveBeenCalled();
    });

    it('reports a negative quantity alongside any other problem', async () => {
      const user = setup();
      renderScreen();
      await fillValid(user, { bricks: '-1', cement: '' });

      await user.click(submitButton());

      expect(screen.getByText('Bricks cannot be negative')).toBeInTheDocument();
      expect(screen.getByText('Cement is required')).toBeInTheDocument();
    });

    it('clears the negative-quantity message when the figure is corrected', async () => {
      const user = setup();
      renderScreen();
      await fillValid(user, { bricks: '-5' });
      await user.click(submitButton());
      expect(screen.getByText('Bricks cannot be negative')).toBeInTheDocument();

      await user.clear(fields.bricks());
      await user.type(fields.bricks(), '500');

      expect(screen.queryByText('Bricks cannot be negative')).not.toBeInTheDocument();
    });
  });

  describe('round must be at least 1', () => {
    it.each(['0', '-1'])('refuses round %s with a message, without calling the server', async (round) => {
      const user = setup();
      renderScreen();
      await fillValid(user, { round });

      await user.click(submitButton());

      expect(screen.getByText('Round must be at least 1')).toBeInTheDocument();
      expect(screen.queryByText('Round is required')).not.toBeInTheDocument();
      expect(mocked.validateSession).not.toHaveBeenCalled();
      expect(mocked.createProductionEntry).not.toHaveBeenCalled();
    });

    it('clears the message when the round is corrected', async () => {
      const user = setup();
      renderScreen();
      await fillValid(user, { round: '0' });
      await user.click(submitButton());
      expect(screen.getByText('Round must be at least 1')).toBeInTheDocument();

      await user.clear(fields.round());
      await user.type(fields.round(), '1');

      expect(screen.queryByText('Round must be at least 1')).not.toBeInTheDocument();
    });
  });

  describe('figure errors clear as the figure is corrected', () => {
    it.each(['bricks', 'wetAsh', 'marblePowder', 'crusherPowder', 'flyAsh', 'cement'] as FieldKey[])(
      'clears the %s error as soon as that figure is changed',
      async (key) => {
        const user = setup();
        renderScreen();
        await user.click(submitButton());
        expect(screen.getByText(REQUIRED_MESSAGES[key])).toBeInTheDocument();

        await user.type(fields[key](), '5');

        expect(screen.queryByText(REQUIRED_MESSAGES[key])).not.toBeInTheDocument();
      },
    );

    it('leaves the other errors in place when one is corrected', async () => {
      const user = setup();
      renderScreen();
      await user.click(submitButton());

      await user.type(fields.bricks(), '500');

      expect(screen.queryByText(REQUIRED_MESSAGES.bricks)).not.toBeInTheDocument();
      expect(screen.getByText(REQUIRED_MESSAGES.wetAsh)).toBeInTheDocument();
      expect(screen.getByText(REQUIRED_MESSAGES.cement)).toBeInTheDocument();
      expect(screen.getByText(REQUIRED_MESSAGES.round)).toBeInTheDocument();
    });
  });

  describe('choosing the date', () => {
    it('opens a calendar on the current month', async () => {
      const user = setup();
      renderScreen();

      await user.click(dateButton());

      expect(await screen.findByRole('grid')).toBeInTheDocument();
      expect(screen.getByText('October 2026')).toBeInTheDocument();
    });

    it('lets today be picked but not any later day', async () => {
      const user = setup();
      renderScreen();
      await user.click(dateButton());
      await screen.findByRole('grid');

      expect(screen.getByRole('gridcell', { name: '15' })).toBeEnabled();
      expect(screen.getByRole('gridcell', { name: '14' })).toBeEnabled();
      expect(screen.getByRole('gridcell', { name: '16' })).toBeDisabled();
      expect(screen.getByRole('gridcell', { name: '31' })).toBeDisabled();
    });

    it('shows an earlier day once it is chosen', async () => {
      const user = setup();
      renderScreen();
      await user.click(dateButton());

      await user.click(await screen.findByRole('gridcell', { name: '10' }));

      expect(dateButton()).toHaveTextContent('October 10th, 2026');
    });
  });

  describe('submitting', () => {
    it('records the entry with every figure as a number, the date as yyyy-MM-dd, and the signed-in user', async () => {
      const user = setup();
      renderScreen();
      await fillValid(user);

      await user.click(submitButton());

      await waitFor(() => expect(mocked.createProductionEntry).toHaveBeenCalledTimes(1));
      expect(mocked.createProductionEntry).toHaveBeenCalledWith(
        {
          date: '2026-10-15',
          round: 2,
          bricks: 1000,
          wetAsh: 150.5,
          marblePowder: 80,
          crusherPowder: 60,
          flyAsh: 40,
          cement: 12.5,
          notes: undefined,
        },
        USER_ID,
      );
    });

    it('sends the date that was picked', async () => {
      const user = setup();
      renderScreen();
      await fillValid(user);
      await user.click(dateButton());
      await user.click(await screen.findByRole('gridcell', { name: '3' }));

      await user.click(submitButton());

      await waitFor(() => expect(mocked.createProductionEntry).toHaveBeenCalled());
      expect(mocked.createProductionEntry.mock.calls[0][0].date).toBe('2026-10-03');
    });

    it('sends the notes with surrounding spaces trimmed', async () => {
      const user = setup();
      renderScreen();
      await fillValid(user);
      await user.type(notesField(), '  Machine 2 was slow  ');

      await user.click(submitButton());

      await waitFor(() => expect(mocked.createProductionEntry).toHaveBeenCalled());
      expect(mocked.createProductionEntry.mock.calls[0][0].notes).toBe('Machine 2 was slow');
    });

    it('sends no notes when the box holds only spaces', async () => {
      const user = setup();
      renderScreen();
      await fillValid(user);
      await user.type(notesField(), '    ');

      await user.click(submitButton());

      await waitFor(() => expect(mocked.createProductionEntry).toHaveBeenCalled());
      expect(mocked.createProductionEntry.mock.calls[0][0].notes).toBeUndefined();
    });

    it('confirms a recorded entry with a success popup', async () => {
      const user = setup();
      renderScreen();
      await fillValid(user);

      await user.click(submitButton());

      expect(await screen.findByText('Production Entry Successful')).toBeInTheDocument();
      expect(screen.getByText('Production details have been entered successfully.')).toBeInTheDocument();
    });

    it('returns to the home screen after the success popup is closed', async () => {
      const user = setup();
      renderScreen();
      await fillValid(user);
      await user.click(submitButton());
      await screen.findByText('Production Entry Successful');

      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.getByTestId('path')).toHaveTextContent('/employee/home');
    });

    it('shows Submitting... and ignores another press while the save is in flight', async () => {
      const user = setup();
      let finish: () => void = () => {};
      mocked.createProductionEntry.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      renderScreen();
      await fillValid(user);

      await user.click(submitButton());

      const busy = await screen.findByRole('button', { name: 'Submitting...' });
      expect(busy).toBeDisabled();
      await user.click(busy);
      expect(mocked.createProductionEntry).toHaveBeenCalledTimes(1);

      finish();
      expect(await screen.findByText('Production Entry Successful')).toBeInTheDocument();
    });
  });

  describe('when saving fails', () => {
    it('explains the failure in a popup', async () => {
      const user = setup();
      mocked.createProductionEntry.mockRejectedValue(new Error('Not allowed'));
      renderScreen();
      await fillValid(user);

      await user.click(submitButton());

      expect(await screen.findByText('Submission Failed')).toBeInTheDocument();
      expect(screen.getByText('Failed to submit production entry')).toBeInTheDocument();
      expect(screen.queryByText('Production Entry Successful')).not.toBeInTheDocument();
    });

    it('treats a signed-out user as a failed save and writes nothing', async () => {
      const user = setup();
      mocked.validateSession.mockResolvedValue(null);
      renderScreen();
      await fillValid(user);

      await user.click(submitButton());

      expect(await screen.findByText('Submission Failed')).toBeInTheDocument();
      expect(mocked.createProductionEntry).not.toHaveBeenCalled();
    });

    it('keeps everything the employee typed, and stays on the screen, so they can retry', async () => {
      const user = setup();
      mocked.createProductionEntry.mockRejectedValueOnce(new Error('boom'));
      renderScreen();
      await fillValid(user);
      await user.type(notesField(), 'keep me');
      await user.click(submitButton());
      await screen.findByText('Submission Failed');

      await user.click(screen.getByRole('button', { name: 'OK' }));

      expect(screen.queryByText('Submission Failed')).not.toBeInTheDocument();
      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
      expect(fields.round()).toHaveValue(2);
      expect(fields.bricks()).toHaveValue(1000);
      expect(fields.wetAsh()).toHaveValue(150.5);
      expect(fields.cement()).toHaveValue(12.5);
      expect(notesField()).toHaveValue('keep me');
      expect(submitButton()).toBeEnabled();
    });

    it('succeeds on a second attempt after a failure', async () => {
      const user = setup();
      mocked.createProductionEntry.mockRejectedValueOnce(new Error('boom'));
      renderScreen();
      await fillValid(user);
      await user.click(submitButton());
      await user.click(await screen.findByRole('button', { name: 'OK' }));

      await user.click(submitButton());

      expect(await screen.findByText('Production Entry Successful')).toBeInTheDocument();
      expect(screen.queryByText('Submission Failed')).not.toBeInTheDocument();
      expect(mocked.createProductionEntry).toHaveBeenCalledTimes(2);
    });
  });
});
