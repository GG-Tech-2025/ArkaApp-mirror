import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RenewalBanner } from './RenewalBanner';

const tenant = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../context/TenantContext', () => ({ useTenant: () => tenant.value }));

// A fixed mid-month day, so "due in n days" is the same whenever the test runs.
const NOW = new Date(2026, 9, 15, 10, 0, 0);

function branch(renewalDate: string | null, overrides: Record<string, unknown> = {}) {
  tenant.value = { activeBranch: { id: 'b1', name: 'T.gode', renewalDate, ...overrides } };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RenewalBanner', () => {
  describe('when nothing needs saying', () => {
    it('shows nothing without a branch', () => {
      tenant.value = { activeBranch: null };
      const { container } = render(<RenewalBanner />);

      expect(container).toBeEmptyDOMElement();
    });

    it('shows nothing when the branch has no renewal date', () => {
      branch(null);
      const { container } = render(<RenewalBanner />);

      expect(container).toBeEmptyDOMElement();
    });

    it('shows nothing when the renewal is more than a week away', () => {
      branch('2026-10-23');
      const { container } = render(<RenewalBanner />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('a renewal due soon', () => {
    it('reminds the admin exactly a week before', () => {
      branch('2026-10-22');
      render(<RenewalBanner />);

      const banner = screen.getByRole('status');
      expect(banner).toHaveTextContent('The payment for T.gode is due on');
      expect(banner).toHaveTextContent('in 7 days');
      expect(banner).toHaveTextContent('Please make the payment to avoid any interruption.');
    });

    it('says it is due today', () => {
      branch('2026-10-15');
      render(<RenewalBanner />);

      expect(screen.getByRole('status')).toHaveTextContent('is due today');
    });

    it('says "in 1 day" in the singular', () => {
      branch('2026-10-16');
      render(<RenewalBanner />);

      expect(screen.getByRole('status')).toHaveTextContent('in 1 day)');
    });

    it('can be dismissed, and stays dismissed after a redraw', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      branch('2026-10-18');
      const { unmount } = render(<RenewalBanner />);

      await user.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      unmount();
      render(<RenewalBanner />);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('remembers a dismissal per branch and renewal date', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      branch('2026-10-18');
      const first = render(<RenewalBanner />);
      await user.click(screen.getByRole('button', { name: 'Dismiss' }));
      first.unmount();

      branch('2026-10-19', { id: 'b2', name: 'Other branch' });
      render(<RenewalBanner />);

      expect(screen.getByRole('status')).toHaveTextContent('Other branch');
    });

    it('still shows when session storage is unavailable', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      branch('2026-10-18');
      render(<RenewalBanner />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      spy.mockRestore();
    });
  });

  describe('an overdue renewal', () => {
    it('warns that the branch may be paused, with how long ago it was due', () => {
      branch('2026-10-12');
      render(<RenewalBanner />);

      const banner = screen.getByRole('status');
      expect(banner).toHaveTextContent('was due on');
      expect(banner).toHaveTextContent('3 days ago');
      expect(banner).toHaveTextContent('Please pay now to avoid this branch being paused.');
    });

    it('says "1 day ago" in the singular', () => {
      branch('2026-10-14');
      render(<RenewalBanner />);

      expect(screen.getByRole('status')).toHaveTextContent('1 day ago');
    });

    it('cannot be dismissed', () => {
      branch('2026-10-12');
      render(<RenewalBanner />);

      expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    });

    it('stays visible even if a reminder was dismissed earlier', () => {
      sessionStorage.setItem('renewal-banner:b1:2026-10-12', '1');
      branch('2026-10-12');
      render(<RenewalBanner />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});
