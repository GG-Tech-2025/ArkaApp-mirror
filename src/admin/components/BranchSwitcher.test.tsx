import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BranchSwitcher } from './BranchSwitcher';

const tenant = vi.hoisted(() => ({ value: {} as Record<string, unknown>, switchBranch: vi.fn() }));
vi.mock('../../context/TenantContext', () => ({ useTenant: () => tenant.value }));

const BRANCHES = [
  { id: 'b1', name: 'T.gode', status: 'ACTIVE' },
  { id: 'b2', name: 'Erode Yard', status: 'ACTIVE' },
  { id: 'b3', name: 'Old Yard', status: 'PAUSED' },
];

function setTenant(overrides: Record<string, unknown>) {
  tenant.value = {
    organizationName: 'Bricky box',
    branches: BRANCHES,
    activeBranch: BRANCHES[0],
    switchBranch: tenant.switchBranch,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tenant.switchBranch.mockResolvedValue(undefined);
  setTenant({});
});

describe('BranchSwitcher', () => {
  it('shows nothing before a branch is known', () => {
    setTenant({ activeBranch: null });
    const { container } = render(<BranchSwitcher />);

    expect(container).toBeEmptyDOMElement();
  });

  describe('with a single branch', () => {
    it('shows the organization and branch name, with nothing to choose', () => {
      setTenant({ branches: [BRANCHES[0]] });
      render(<BranchSwitcher />);

      expect(screen.getByText('Bricky box · T.gode')).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('shows just the branch when the organization name is unknown', () => {
      setTenant({ branches: [BRANCHES[0]], organizationName: null });
      render(<BranchSwitcher />);

      expect(screen.getByText('T.gode')).toBeInTheDocument();
    });
  });

  describe('with several branches', () => {
    it('offers a dropdown set to the active branch', () => {
      render(<BranchSwitcher />);

      const select = screen.getByRole('combobox', { name: 'Active branch' });
      expect(select).toHaveValue('b1');
      expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'T.gode',
        'Erode Yard',
        'Old Yard (paused)',
      ]);
    });

    it('does not allow a paused branch to be chosen', () => {
      render(<BranchSwitcher />);

      expect(screen.getByRole('option', { name: 'Old Yard (paused)' })).toBeDisabled();
      expect(screen.getByRole('option', { name: 'Erode Yard' })).toBeEnabled();
    });

    it('switches to the chosen branch', async () => {
      const user = userEvent.setup();
      render(<BranchSwitcher />);

      await user.selectOptions(screen.getByRole('combobox'), 'Erode Yard');

      expect(tenant.switchBranch).toHaveBeenCalledWith('b2');
    });

    it('is locked while a switch is in progress', async () => {
      const user = userEvent.setup();
      let finish: () => void = () => {};
      tenant.switchBranch.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      render(<BranchSwitcher />);

      await user.selectOptions(screen.getByRole('combobox'), 'Erode Yard');
      expect(screen.getByRole('combobox')).toBeDisabled();

      finish();
      await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
    });

    it('says so when the switch fails, and unlocks', async () => {
      const user = userEvent.setup();
      tenant.switchBranch.mockRejectedValue(new Error('nope'));
      render(<BranchSwitcher />);

      await user.selectOptions(screen.getByRole('combobox'), 'Erode Yard');

      expect(await screen.findByText("Couldn't switch branch. Please try again.")).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeEnabled();
    });

    it('clears an earlier failure message when trying again', async () => {
      const user = userEvent.setup();
      tenant.switchBranch.mockRejectedValueOnce(new Error('nope'));
      render(<BranchSwitcher />);
      await user.selectOptions(screen.getByRole('combobox'), 'Erode Yard');
      await screen.findByText("Couldn't switch branch. Please try again.");

      await user.selectOptions(screen.getByRole('combobox'), 'Erode Yard');

      await waitFor(() =>
        expect(screen.queryByText("Couldn't switch branch. Please try again.")).not.toBeInTheDocument(),
      );
    });
  });
});
