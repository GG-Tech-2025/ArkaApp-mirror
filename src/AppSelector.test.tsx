import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AppSelector from './AppSelector';

function CurrentPath() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderSelector() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<AppSelector />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppSelector', () => {
  describe('content', () => {
    it('shows the brand, the prompt and the logo', () => {
      renderSelector();

      expect(screen.getByRole('heading', { level: 1, name: 'Arka Bricks' })).toBeInTheDocument();
      expect(screen.getByText('Select your application')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Arka Bricks' })).toBeInTheDocument();
    });

    it('offers exactly two applications, Employee and Admin', () => {
      renderSelector();

      expect(screen.getAllByRole('button')).toHaveLength(2);
      expect(screen.getByRole('button', { name: /Employee App/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Admin App/ })).toBeInTheDocument();
    });

    it('describes what the Employee app is for', () => {
      renderSelector();
      const employee = screen.getByRole('button', { name: /Employee App/ });

      expect(employee).toHaveTextContent('Material Purchase Entry');
      expect(employee).toHaveTextContent('Production Entry');
      expect(employee).toHaveTextContent('Delivery Entry');
    });

    it('describes what the Admin app is for', () => {
      renderSelector();
      const admin = screen.getByRole('button', { name: /Admin App/ });

      expect(admin).toHaveTextContent('Order & Customer Management');
      expect(admin).toHaveTextContent('Inventory & Production Stats');
      expect(admin).toHaveTextContent('Accounts & Employee Management');
    });

    it('shows the footer credit', () => {
      renderSelector();

      expect(screen.getByText(/Powered by/)).toHaveTextContent('Powered by GG-Tech');
    });
  });

  describe('navigation', () => {
    it('stays on the selection screen until something is chosen', () => {
      renderSelector();

      expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    });

    it('takes the user to the Employee app when Employee App is selected', async () => {
      const user = userEvent.setup();
      renderSelector();

      await user.click(screen.getByRole('button', { name: /Employee App/ }));

      expect(screen.getByTestId('path')).toHaveTextContent('/employee');
      expect(screen.queryByText('Select your application')).not.toBeInTheDocument();
    });

    it('takes the user to the Admin app when Admin App is selected', async () => {
      const user = userEvent.setup();
      renderSelector();

      await user.click(screen.getByRole('button', { name: /Admin App/ }));

      expect(screen.getByTestId('path')).toHaveTextContent('/admin');
      expect(screen.queryByText('Select your application')).not.toBeInTheDocument();
    });

    it('can be operated from the keyboard', async () => {
      const user = userEvent.setup();
      renderSelector();

      await user.tab();
      expect(screen.getByRole('button', { name: /Employee App/ })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: /Admin App/ })).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(screen.getByTestId('path')).toHaveTextContent('/admin');
    });

    it('chooses the Employee app with the Space key too', async () => {
      const user = userEvent.setup();
      renderSelector();

      await user.tab();
      await user.keyboard(' ');

      expect(screen.getByTestId('path')).toHaveTextContent('/employee');
    });
  });
});
