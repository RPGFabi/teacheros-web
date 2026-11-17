import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App-Schale', () => {
  it('zeigt Navigation fuer Lehrkraefte- und Verwaltungsportal mit neutralem Produktnamen', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    expect(within(nav).getByRole('link', { name: 'Lehrkräfteportal' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Verwaltungsportal' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent('Schulplattform');
  });

  it('wechselt den Inhalt beim Klick auf einen Navigationspunkt', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('link', { name: 'Verwaltungsportal' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Verwaltungsportal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Verwaltungsportal' })).toHaveAttribute('aria-current', 'page');
  });

  it('bietet auf kleinen Bildschirmen einen Menue-Schalter fuer die Navigation', async () => {
    render(<App />);
    const toggle = screen.getByRole('button', { name: 'Menü' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
