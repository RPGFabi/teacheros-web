import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import InvitationPage from './InvitationPage';
import { fakeClient } from '../test/fakeHttp';

const PASSWORD = 'Neues!Passwort22';

async function fillAndSubmit(password = PASSWORD, repeat = password) {
  await userEvent.type(screen.getByLabelText('Passwort'), password);
  await userEvent.type(screen.getByLabelText('Passwort wiederholen'), repeat);
  await userEvent.click(screen.getByRole('button', { name: 'Passwort setzen' }));
}

describe('Einladung annehmen', () => {
  it('setzt das Passwort direkt beim Anmeldedienst und leitet danach zur Anmeldung', async () => {
    const { client, calls } = fakeClient({ 'POST /acceptInvite': { data: { ok: 'Dein Konto ist eingerichtet.' } } });
    const onAccepted = vi.fn();
    render(<InvitationPage authClient={client} token="abc123" onAccepted={onAccepted} />);

    await fillAndSubmit();

    await vi.waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'POST', url: '/acceptInvite', data: { token: 'abc123', password: PASSWORD } });
  });

  it('verlangt, dass beide Passwoerter uebereinstimmen, und sendet sonst nichts', async () => {
    const { client, calls } = fakeClient({ 'POST /acceptInvite': { data: {} } });
    const onAccepted = vi.fn();
    render(<InvitationPage authClient={client} token="abc123" onAccepted={onAccepted} />);

    await fillAndSubmit(PASSWORD, 'Anderes!Passwort33');

    expect(await screen.findByRole('alert')).toHaveTextContent('stimmen nicht überein');
    expect(calls).toHaveLength(0);
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('zeigt die Passwortregel des Anmeldedienstes und laesst den Link weiter nutzbar', async () => {
    const rule = 'Das Passwort erfüllt nicht alle Anforderungen: Es muss mindestens ein Sonderzeichen enthalten.';
    const { client } = fakeClient({ 'POST /acceptInvite': { status: 400, data: { error: rule } } });
    const onAccepted = vi.fn();
    render(<InvitationPage authClient={client} token="abc123" onAccepted={onAccepted} />);

    await fillAndSubmit('Schwach1234');

    expect(await screen.findByRole('alert')).toHaveTextContent(rule);
    expect(screen.getByRole('button', { name: 'Passwort setzen' })).toBeEnabled();
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('erklaert bei abgelaufenem oder schon benutztem Link, dass eine neue Einladung noetig ist', async () => {
    const { client } = fakeClient({ 'POST /acceptInvite': { status: 400, data: { error: 'Der Link ist ungültig oder abgelaufen.' } } });
    render(<InvitationPage authClient={client} token="abc123" onAccepted={() => {}} />);

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('abgelaufen oder wurde schon benutzt');
    expect(screen.getByRole('alert')).toHaveTextContent('neue Einladung');
  });

  it('meldet einen Ausfall des Anmeldedienstes verstaendlich', async () => {
    const { client } = fakeClient({ 'POST /acceptInvite': { status: 500 } });
    render(<InvitationPage authClient={client} token="abc123" onAccepted={() => {}} />);

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('nicht erreichbar');
  });

  it('nimmt einen Einladungscode aus dem Link an und sendet ihn als code', async () => {
    const { client, calls } = fakeClient({ 'POST /acceptInvite': { data: {} } });
    render(<InvitationPage authClient={client} code="ABCD-EFGH-JKMN-PQRS" onAccepted={() => {}} />);

    await fillAndSubmit();

    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].data).toEqual({ code: 'ABCD-EFGH-JKMN-PQRS', password: PASSWORD });
  });

  it('fragt ohne Token und Code nach dem Einladungscode von der Karte', async () => {
    const { client, calls } = fakeClient({ 'POST /acceptInvite': { data: {} } });
    render(<InvitationPage authClient={client} onAccepted={() => {}} />);

    await userEvent.type(screen.getByLabelText('Einladungscode'), 'abcd-efgh-jkmn-pqrs');
    await fillAndSubmit();

    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].data).toEqual({ code: 'abcd-efgh-jkmn-pqrs', password: PASSWORD });
  });
});
