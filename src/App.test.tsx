import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';
import { fakeClient } from './test/fakeHttp';

describe('App-Schale', () => {
  it('zeigt Navigation fuer Lehrkraefte- und Verwaltungsportal mit neutralem Produktnamen', () => {
    render(<App apiClient={fakeClient({ 'GET /api/me': { data: { permissions: [] } } }).client} />);
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    expect(within(nav).getByRole('link', { name: 'Lehrkräfteportal' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Verwaltungsportal' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent('Schulplattform');
  });

  it('wechselt den Inhalt beim Klick auf einen Navigationspunkt', async () => {
    render(<App apiClient={fakeClient({ 'GET /api/me': { data: { permissions: [] } } }).client} />);
    await userEvent.click(screen.getByRole('link', { name: 'Verwaltungsportal' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Verwaltungsportal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Verwaltungsportal' })).toHaveAttribute('aria-current', 'page');
  });

  it('bietet auf kleinen Bildschirmen einen Menue-Schalter fuer die Navigation', async () => {
    render(<App apiClient={fakeClient({ 'GET /api/me': { data: { permissions: [] } } }).client} />);
    const toggle = screen.getByRole('button', { name: 'Menü' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Menuepunkt Konten (Rechte aus GET /api/me)', () => {
  const ME = (permissions: string[]) => ({
    account: { id: '11111111-1111-4111-8111-111111111111', status: 'active', mfa_required: false },
    permissions,
    session: { used_mfa: false, expires_at: '2026-11-17T12:00:00+00:00' }
  });

  it('zeigt Konten mit dem Recht accounts.view und oeffnet die Seite', async () => {
    const { client } = fakeClient({ 'GET /api/me': { data: ME(['accounts.view', 'accounts.invite']) } });
    render(<App apiClient={client} />);

    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    await userEvent.click(await within(nav).findByRole('link', { name: 'Konten' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Konten' })).toBeInTheDocument();
  });

  it('blendet Konten ohne das Recht accounts.view aus', async () => {
    const { client, calls } = fakeClient({ 'GET /api/me': { data: ME(['accounts.invite']) } });
    render(<App apiClient={client} />);

    await waitFor(() => expect(calls.some((c) => c.url === '/api/me')).toBe(true));
    await screen.findByRole('link', { name: 'Mein Konto' });
    expect(screen.queryByRole('link', { name: 'Konten' })).not.toBeInTheDocument();
  });

  it('blendet Konten aus, solange die Rechte nicht geladen sind oder das Laden scheitert', async () => {
    const { client, calls } = fakeClient({ 'GET /api/me': { status: 500 } });
    render(<App apiClient={client} />);

    expect(screen.queryByRole('link', { name: 'Konten' })).not.toBeInTheDocument();
    await waitFor(() => expect(calls.some((c) => c.url === '/api/me')).toBe(true));
    expect(screen.queryByRole('link', { name: 'Konten' })).not.toBeInTheDocument();
  });

  it('wertet keine Wildcard aus: ein Stern in der Liste schaltet nichts frei', async () => {
    const { client } = fakeClient({ 'GET /api/me': { data: ME(['*']) } });
    render(<App apiClient={client} />);

    await screen.findByRole('link', { name: 'Mein Konto' });
    expect(screen.queryByRole('link', { name: 'Konten' })).not.toBeInTheDocument();
  });
});
