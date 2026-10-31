import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Popup } from './Popup';

describe('Popup', () => {
  it('shows the title, the message and an OK button', () => {
    render(<Popup title="Order Placed Successfully" message="The order has been created." onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Order Placed Successfully' })).toBeInTheDocument();
    expect(screen.getByText('The order has been created.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OK' })).toBeEnabled();
  });

  it('calls onClose once when OK is clicked', async () => {
    const onClose = vi.fn();
    render(<Popup title="Error" message="Something failed" onClose={onClose} type="error" />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'OK' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close by itself', () => {
    const onClose = vi.fn();
    render(<Popup title="Error" message="Something failed" onClose={onClose} type="error" />);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Error' })).toBeInTheDocument();
  });

  it.each(['success', 'error', 'warning', 'purchase', 'production'] as const)(
    'shows an icon, the text and OK for the %s type',
    (type) => {
      const { container } = render(<Popup title={`A ${type} popup`} message="Details" onClose={vi.fn()} type={type} />);

      expect(container.querySelectorAll('svg')).toHaveLength(1);
      expect(screen.getByRole('heading', { name: `A ${type} popup` })).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
    },
  );

  it('uses the same icon for the default type as for success', () => {
    const { container: byDefault } = render(<Popup title="Default" message="m" onClose={vi.fn()} />);
    const { container: success } = render(<Popup title="Success" message="m" onClose={vi.fn()} type="success" />);

    expect(byDefault.querySelector('svg')?.getAttribute('class')).toBe(success.querySelector('svg')?.getAttribute('class'));
  });

  it('uses a different icon for an error than for a success', () => {
    const { container: error } = render(<Popup title="E" message="m" onClose={vi.fn()} type="error" />);
    const { container: success } = render(<Popup title="S" message="m" onClose={vi.fn()} type="success" />);

    expect(error.querySelector('svg')?.getAttribute('class')).not.toBe(success.querySelector('svg')?.getAttribute('class'));
  });
});
