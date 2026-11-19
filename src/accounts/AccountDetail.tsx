import { useCallback, useEffect, useState } from 'react';
import { Button, Card, ConfirmDialog } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { SYNC_PENDING_LABEL, statusLabel } from '../account/status';
import type { AccountAccess, PermissionAction, RoleAction } from './access';
import EffectivePermissions, { PermissionSources } from './EffectivePermissions';
import { describeFailure, loadFailureText, openCallText, syncRejectionText, type Flow } from './errorText';

interface Props {
  apiClient: AxiosInstance;
  accountId: string;
  /** Recht `roles.assign` aus GET /api/me; ohne es sind Vergeben und Entziehen gesperrt (sichtbar, mit Begruendung). */
  canAssign: boolean;
  /** Recht `permissions.assign` aus GET /api/me; ohne es sind Einzelrechte gesperrt (sichtbar, mit Begruendung). */
  canAssignPermissions?: boolean;
  onBack: () => void;
}

const SYNC_PENDING_NOTICE = 'Der Abgleich mit dem Anmeldedienst ist noch offen; wiederholen Sie ihn im Abschnitt „Konto“.';
const REVOCATION_PENDING_NOTICE = 'Sitzungen beendet. Der Anmeldedienst hat das noch nicht bestätigt; bis dahin lehnt die Anwendung jede Anfrage des Kontos ab. Wiederholen Sie den Abgleich im Abschnitt „Konto“.';
const NO_OPEN_CALLS: never[] = [];
const NO_RIGHT_REASON = 'Dafür fehlt Ihnen das Recht „Rollen vergeben und entziehen“.';
const NO_PERMISSION_RIGHT_REASON = 'Dafür fehlt Ihnen das Recht „Einzelrechte vergeben und entziehen“.';

const PERMISSION_VERBS = {
  grant: { button: 'Gewähren', label: 'Einzelrecht gewähren', done: 'gewährt' },
  withdraw: { button: 'Entziehen', label: 'Einzelrecht entziehen', done: 'entzogen' },
  clear: { button: 'Zurücksetzen', label: 'Einzelrecht zurücksetzen', done: 'zurückgesetzt' }
} as const;

/**
 * Detailansicht eines Kontos (Ticket #34): Rollen einzeln hinzufuegen und entziehen, effektive Rechte mit Herkunft.
 * Welche Aktion erlaubt ist, entscheidet die API (`role_actions`); nicht erlaubte Aktionen bleiben sichtbar und
 * deaktiviert, mit Begruendung. Jede Antwort der API ist die neue Sicht; nach einem Fehler wird sie neu geladen.
 * Einzelrechte (Ticket #36) folgen demselben Muster ueber `permission_actions`: ein Abschnitt mit allen Katalogrechten,
 * je Recht die eine moegliche Aktion (gewaehren, entziehen, zuruecksetzen). Der letzte aktive Schuladmin (Ticket #35,
 * `last_admin`) kommt als gesperrte Aktion mit Begruendung in `role_actions`.
 * Konto deaktivieren (Ticket #41): „Deaktivieren …“ mit Bestaetigungsdialog; ob die Aktion erlaubt ist, sagt die API in
 * `account_actions` (auch das Recht `accounts.deactivate` und die Regeln), sonst bleibt sie gesperrt sichtbar.
 * Reaktivierung (Ticket #43): bei einem deaktivierten Konto steht im Abschnitt „Konto“ „Reaktivieren“ (Aktion `reactivate`,
 * gesperrt sichtbar mit Begruendung); die API ruft zuerst den Anmeldedienst, bei Fehlschlag bleibt das Konto deaktiviert.
 * Sitzungen beenden (Ticket #48): „Sitzungen beenden …“ mit Bestaetigungsdialog im Abschnitt „Konto“ (Aktion `revoke_sessions`, gesperrt
 * sichtbar mit Begruendung); das Konto bleibt aktiv, nur alle Sitzungen enden. Ist der Anmeldedienst nicht erreichbar, bleibt der
 * Widerruf als offener Aufruf bestehen (`open_calls`) und die Ansicht nennt das.
 * Abgleich mit dem Anmeldedienst (Tickets #42, #47): ist ein Aufruf dort noch offen (`open_calls`, z. B. die Deaktivierung), steht im
 * Abschnitt „Konto“ je offenem Aufruf ein Satz mit dem Grund der Ablehnung und einmal „Abgleich wiederholen“ (Aktion
 * `resync_login`, holt alle nach; gesperrt sichtbar ohne Recht).
 */
export default function AccountDetail({ apiClient, accountId, canAssign, canAssignPermissions = false, onBack }: Props) {
  const [access, setAccess] = useState<AccountAccess | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeactivation, setConfirmingDeactivation] = useState(false);
  const [confirmingRevocation, setConfirmingRevocation] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setAccess((await apiClient.get<AccountAccess>(`/api/accounts/${accountId}/access`)).data);
    } catch (err) {
      setLoadError(loadFailureText(err));
    }
  }, [apiClient, accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Der gemeinsame Ablauf jeder Aenderung: die Antwort der API ist die neue Sicht; bei einem Fehler erscheint der Text zur
   * Aktion und die Sicht wird neu geladen.
   */
  async function perform(flow: Flow, request: () => Promise<AccountAccess>, done: (data: AccountAccess) => string) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const data = await request();
      setAccess(data);
      setNotice(done(data));
    } catch (err) {
      setError(describeFailure(err, flow));
      await load();
    } finally {
      setBusy(false);
    }
  }

  const post = async (suffix: string, body?: unknown) => (await apiClient.post<AccountAccess>(`/api/accounts/${accountId}/${suffix}`, body)).data;

  const change = (role: RoleAction) => {
    const assigning = role.action === 'assign';
    return perform(
      'assign',
      () => (assigning ? post('roles', { role_id: role.role_id }) : post(`roles/${role.role_id}/revoke`)),
      () => (assigning ? `Rolle ${role.role_name} vergeben.` : `Rolle ${role.role_name} entzogen.`)
    );
  };

  const changePermission = (item: PermissionAction) =>
    perform('assign', () => post(`permissions/${item.action}`, { permission: item.permission }), () => `Einzelrecht „${item.name}“ ${PERMISSION_VERBS[item.action].done}.`);

  function deactivate() {
    setConfirmingDeactivation(false);
    return perform('deactivate', () => post('deactivate'), (data) => (data.account.open_calls?.length ? `Konto deaktiviert. ${SYNC_PENDING_NOTICE}` : 'Konto deaktiviert.'));
  }

  function revokeSessions() {
    setConfirmingRevocation(false);
    return perform(
      'revoke',
      () => post('revoke-sessions'),
      (data) => (data.account.open_calls?.some((call) => call.operation === 'revoke_sessions') ? REVOCATION_PENDING_NOTICE : 'Alle Sitzungen beendet.')
    );
  }

  const reactivate = () => perform('reactivate', () => post('reactivate'), () => 'Konto reaktiviert.');

  const resync = () => perform('resync', () => post('resync-login'), () => 'Abgleich mit dem Anmeldedienst nachgeholt.');

  const back = <Button variant="secondary" onClick={onBack}>Zurück zur Kontenliste</Button>;

  if (loadError) {
    return (
      <main className="content">
        <p role="alert">{loadError}</p>
        <p>
          {back} <Button variant="secondary" onClick={() => void load()}>Erneut laden</Button>
        </p>
      </main>
    );
  }
  if (access === null) {
    return (
      <main className="content">
        <p>Konto wird geladen …</p>
      </main>
    );
  }

  // Rollen und Rechte liefert die API nur mit einem der drei Verwaltungsrechte; sonst zeigt die Ansicht nur das Konto.
  const { permissions, role_actions: roleActions, permission_actions: permissionActions } = access;
  const showsAccess = permissions !== undefined && roleActions !== undefined && permissionActions !== undefined;
  const held = (roleActions ?? []).filter((a) => a.action === 'revoke');
  const available = (roleActions ?? []).filter((a) => a.action === 'assign');

  const roleRow = (role: RoleAction, label: string) => {
    const blocked = !canAssign ? NO_RIGHT_REASON : role.allowed ? null : (role.reason ?? 'Diese Aktion ist nicht erlaubt.');
    const hintId = `role-hint-${role.role_id}`;
    return (
      <li key={role.role_id}>
        <strong>{role.role_name}</strong>{' '}
        <Button
          variant="secondary"
          disabled={busy || blocked !== null}
          aria-label={`${label}: ${role.role_name}`}
          aria-describedby={blocked ? hintId : undefined}
          onClick={() => void change(role)}
        >
          {role.action === 'assign' ? 'Hinzufügen' : 'Entziehen'}
        </Button>
        {blocked && (
          <small id={hintId} style={{ display: 'block' }}>
            {blocked}
          </small>
        )}
      </li>
    );
  };

  const deactivation = access.account_actions.find((a) => a.action === 'deactivate');
  const deactivationBlocked = deactivation?.allowed ? null : (deactivation?.reason ?? 'Diese Aktion ist nicht erlaubt.');
  const revocation = access.account_actions.find((a) => a.action === 'revoke_sessions');
  const revocationBlocked = revocation?.allowed ? null : (revocation?.reason ?? 'Diese Aktion ist nicht erlaubt.');
  const reactivation = access.account_actions.find((a) => a.action === 'reactivate');
  const reactivationBlocked = reactivation?.allowed ? null : (reactivation?.reason ?? 'Diese Aktion ist nicht erlaubt.');
  const openCalls = access.account.open_calls ?? NO_OPEN_CALLS;
  const resyncAction = openCalls.length > 0 ? access.account_actions.find((a) => a.action === 'resync_login') : undefined;
  const resyncBlocked = resyncAction?.allowed ? null : (resyncAction?.reason ?? 'Diese Aktion ist nicht erlaubt.');
  const accountName = access.account.email ?? access.account.login_name;

  const permissionRow = (item: PermissionAction) => {
    const row = permissions?.find((p) => p.key === item.permission);
    const blocked = !canAssignPermissions ? NO_PERMISSION_RIGHT_REASON : item.allowed ? null : (item.reason ?? 'Diese Aktion ist nicht erlaubt.');
    const hintId = `permission-hint-${item.permission}`;
    const verb = PERMISSION_VERBS[item.action];
    return (
      <tr key={item.permission}>
        <th scope="row">{item.name}</th>
        <td>
          <PermissionSources sources={row?.sources ?? []} />
        </td>
        <td>
          <Button
            variant="secondary"
            disabled={busy || blocked !== null}
            aria-label={`${verb.label}: ${item.name}`}
            aria-describedby={blocked ? hintId : undefined}
            onClick={() => void changePermission(item)}
          >
            {verb.button}
          </Button>
          {blocked && (
            <small id={hintId} style={{ display: 'block' }}>
              {blocked}
            </small>
          )}
        </td>
      </tr>
    );
  };

  return (
    <main className="content">
      <p>{back}</p>
      <h1>{access.account.email ?? access.account.login_name}</h1>
      <p>
        Anmeldename {access.account.login_name} · {statusLabel(access.account.status, access.account.inactive_since)}
        {openCalls.length > 0 ? ` (${SYNC_PENDING_LABEL})` : ''} · Erfordert MFA:{' '}
        {access.account.mfa_required ? 'Ja' : 'Nein'}
      </p>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <Card>
        <section aria-label="Konto">
          <h2>Konto</h2>
          <p>Eine Deaktivierung beendet laufende Sitzungen sofort, die Person kann sich nicht mehr anmelden. Rollen und Rechte bleiben erhalten.</p>
          <Button
            variant="secondary"
            disabled={busy || deactivationBlocked !== null}
            aria-describedby={deactivationBlocked ? 'deactivate-hint' : undefined}
            onClick={() => setConfirmingDeactivation(true)}
          >
            Deaktivieren …
          </Button>
          {deactivationBlocked && (
            <small id="deactivate-hint" style={{ display: 'block' }}>
              {deactivationBlocked}
            </small>
          )}
          {revocation && (
            <>
              <h3>Sitzungen beenden</h3>
              <p>Beendet alle Sitzungen des Kontos auf allen Geräten, etwa nach einem Geräteverlust. Das Konto bleibt aktiv; die Person meldet sich danach neu an.</p>
              <Button
                variant="secondary"
                disabled={busy || revocationBlocked !== null}
                aria-describedby={revocationBlocked ? 'revoke-hint' : undefined}
                onClick={() => setConfirmingRevocation(true)}
              >
                Sitzungen beenden …
              </Button>
              {revocationBlocked && (
                <small id="revoke-hint" style={{ display: 'block' }}>
                  {revocationBlocked}
                </small>
              )}
            </>
          )}
          {reactivation && (
            <>
              <h3>Konto reaktivieren</h3>
              <p>Die Person kann sich danach wieder anmelden. Frühere Sitzungen bleiben beendet: Die Person muss sich danach neu anmelden.</p>
              <Button
                variant="secondary"
                disabled={busy || reactivationBlocked !== null}
                aria-describedby={reactivationBlocked ? 'reactivate-hint' : undefined}
                onClick={() => void reactivate()}
              >
                Reaktivieren
              </Button>
              {reactivationBlocked && (
                <small id="reactivate-hint" style={{ display: 'block' }}>
                  {reactivationBlocked}
                </small>
              )}
            </>
          )}
          {resyncAction && (
            <>
              <h3>Abgleich mit dem Anmeldedienst offen</h3>
              <ul aria-label="Offene Aufrufe">
                {openCalls.map((call) => (
                  <li key={call.operation}>
                    {openCallText(call.operation)}
                    {call.rejection_code && <> {syncRejectionText(call.rejection_code)}</>}
                  </li>
                ))}
              </ul>
              <Button
                variant="secondary"
                disabled={busy || resyncBlocked !== null}
                aria-describedby={resyncBlocked ? 'resync-hint' : undefined}
                onClick={() => void resync()}
              >
                Abgleich wiederholen
              </Button>
              {resyncBlocked && (
                <small id="resync-hint" style={{ display: 'block' }}>
                  {resyncBlocked}
                </small>
              )}
            </>
          )}
        </section>
      </Card>
      <ConfirmDialog
        open={confirmingDeactivation}
        title={`Konto „${accountName}“ deaktivieren?`}
        description="Die Person kann sich nicht mehr anmelden, laufende Sitzungen enden sofort. Konto, Rollen und Daten bleiben erhalten; die Verwaltung kann das Konto später reaktivieren."
        confirmText="Deaktivieren"
        variant="danger"
        onConfirm={() => void deactivate()}
        onCancel={() => setConfirmingDeactivation(false)}
      />
      <ConfirmDialog
        open={confirmingRevocation}
        title={`Sitzungen von „${accountName}“ beenden?`}
        description="Alle Sitzungen des Kontos enden sofort, auch auf anderen Geräten. Das Konto bleibt aktiv, Rollen und Daten bleiben erhalten; die Person muss sich neu anmelden."
        confirmText="Sitzungen beenden"
        variant="danger"
        onConfirm={() => void revokeSessions()}
        onCancel={() => setConfirmingRevocation(false)}
      />
      {showsAccess && (
        <>
        <Card>
          <section aria-label="Rollen">
            <h2>Rollen</h2>
            {held.length === 0 ? <p>Dieses Konto hat keine Rolle.</p> : <ul>{held.map((role) => roleRow(role, 'Rolle entziehen'))}</ul>}
            {available.length > 0 && (
              <>
                <h3>Weitere Rollen</h3>
                <ul>{available.map((role) => roleRow(role, 'Rolle hinzufügen'))}</ul>
              </>
            )}
          </section>
        </Card>
        <Card>
          <section aria-label="Effektive Rechte">
            <h2>Effektive Rechte</h2>
            <EffectivePermissions permissions={permissions ?? []} />
          </section>
        </Card>
        <Card>
          <section aria-label="Einzelrechte">
            <h2>Einzelrechte</h2>
            <p>Einzelrechte gelten zusätzlich zu den Rollen oder entziehen ein Recht trotz Rolle. Konten mit der Rolle Schuladmin oder Schüler/in haben keine.</p>
            <table>
              <thead>
                <tr>
                  <th scope="col">Recht</th>
                  <th scope="col">Herkunft</th>
                  <th scope="col">Aktion</th>
                </tr>
              </thead>
              <tbody>{(permissionActions ?? []).map(permissionRow)}</tbody>
            </table>
          </section>
        </Card>
        </>
      )}
    </main>
  );
}
