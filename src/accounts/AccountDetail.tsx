import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button, Card, ConfirmDialog } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { SYNC_PENDING_LABEL, statusLabel } from '../account/status';
import type { AccountAccess, AccountAction, PermissionAction, RoleAction } from './access';
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
const TOTP_RESET_DONE_NOTICE = 'TOTP zurückgesetzt. Alle Sitzungen des Kontos sind beendet; die Person muss TOTP neu einrichten.';
const TOTP_RESET_PENDING_NOTICE = 'TOTP zurückgesetzt. Der Anmeldedienst hat das noch nicht bestätigt; bis dahin lehnt die Anwendung jede Anfrage des Kontos ab. Wiederholen Sie den Abgleich im Abschnitt „Konto“.';
const NO_OPEN_CALLS: never[] = [];
const NOT_ALLOWED = 'Diese Aktion ist nicht erlaubt.';
const NO_RIGHT_REASON = 'Dafür fehlt Ihnen das Recht „Rollen vergeben und entziehen“.';
const NO_PERMISSION_RIGHT_REASON = 'Dafür fehlt Ihnen das Recht „Einzelrechte vergeben und entziehen“.';

/** Warum eine Aktion gesperrt ist (Begruendung der API); null, wenn sie erlaubt ist. */
const blockedReason = (action: { allowed: boolean; reason: string | null } | undefined) => (action?.allowed ? null : (action?.reason ?? NOT_ALLOWED));

/** Eine Aktion als Schaltflaeche; gesperrt bleibt sie sichtbar, mit ihrer Begruendung als Beschreibung darunter. */
function ActionButton({ hintId, label, ariaLabel, blocked, busy, onClick }: {
  hintId: string;
  label: string;
  ariaLabel?: string;
  blocked: string | null;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <>
      <Button variant="secondary" disabled={busy || blocked !== null} aria-label={ariaLabel} aria-describedby={blocked ? hintId : undefined} onClick={onClick}>
        {label}
      </Button>
      {blocked && (
        <small id={hintId} style={{ display: 'block' }}>
          {blocked}
        </small>
      )}
    </>
  );
}

/** Eine Aktion im Abschnitt „Konto“: Ueberschrift, Erklaerung und Schaltflaeche mit Begruendung. */
function ActionSection({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </>
  );
}

/** Die Aktionen am Konto, die vor dem Ausfuehren einen Bestaetigungsdialog zeigen. */
type Confirmable = 'deactivate' | 'revoke' | 'resetTotp';

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
 * TOTP zuruecksetzen (Ticket #49): „TOTP zurücksetzen …“ mit Bestaetigungsdialog im Abschnitt „Konto“ (Aktion `reset_totp`, auch bei deaktivierten
 * Konten; gesperrt sichtbar mit Begruendung); der Dialog nennt, dass die Person TOTP neu einrichten muss. Ob TOTP eingerichtet ist, zeigt die Ansicht nicht.
 * Die drei Aktionen mit Bestaetigung teilen sich einen Dialog (`confirming`); Schaltflaeche und Begruendung zeigt `ActionButton`.
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
  const [confirming, setConfirming] = useState<Confirmable | null>(null);

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
    return perform('deactivate', () => post('deactivate'), (data) => (data.account.open_calls?.length ? `Konto deaktiviert. ${SYNC_PENDING_NOTICE}` : 'Konto deaktiviert.'));
  }

  function revokeSessions() {
    return perform(
      'revoke',
      () => post('revoke-sessions'),
      (data) => (data.account.open_calls?.some((call) => call.operation === 'revoke_sessions') ? REVOCATION_PENDING_NOTICE : 'Alle Sitzungen beendet.')
    );
  }

  function resetTotp() {
    return perform(
      'resetTotp',
      () => post('reset-totp'),
      (data) => (data.account.open_calls?.some((call) => call.operation === 'reset_totp') ? TOTP_RESET_PENDING_NOTICE : TOTP_RESET_DONE_NOTICE)
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
    const blocked = !canAssign ? NO_RIGHT_REASON : blockedReason(role);
    return (
      <li key={role.role_id}>
        <strong>{role.role_name}</strong>{' '}
        <ActionButton
          hintId={`role-hint-${role.role_id}`}
          label={role.action === 'assign' ? 'Hinzufügen' : 'Entziehen'}
          ariaLabel={`${label}: ${role.role_name}`}
          blocked={blocked}
          busy={busy}
          onClick={() => void change(role)}
        />
      </li>
    );
  };

  const action = (name: AccountAction['action']) => access.account_actions.find((a) => a.action === name);
  const deactivation = action('deactivate');
  const revocation = action('revoke_sessions');
  const totpReset = action('reset_totp');
  const reactivation = action('reactivate');
  const openCalls = access.account.open_calls ?? NO_OPEN_CALLS;
  const resyncAction = openCalls.length > 0 ? action('resync_login') : undefined;
  const accountName = access.account.email ?? access.account.login_name;

  // Die Bestaetigungsdialoge der drei Aktionen; `run` laeuft nach dem Bestaetigen.
  const dialogs: Record<Confirmable, { title: string; description: string; confirmText: string; run: () => Promise<void> }> = {
    deactivate: {
      title: `Konto „${accountName}“ deaktivieren?`,
      description: 'Die Person kann sich nicht mehr anmelden, laufende Sitzungen enden sofort. Konto, Rollen und Daten bleiben erhalten; die Verwaltung kann das Konto später reaktivieren.',
      confirmText: 'Deaktivieren',
      run: deactivate
    },
    revoke: {
      title: `Sitzungen von „${accountName}“ beenden?`,
      description: 'Alle Sitzungen des Kontos enden sofort, auch auf anderen Geräten. Das Konto bleibt aktiv, Rollen und Daten bleiben erhalten; die Person muss sich neu anmelden.',
      confirmText: 'Sitzungen beenden',
      run: revokeSessions
    },
    resetTotp: {
      title: `TOTP von „${accountName}“ zurücksetzen?`,
      description: 'Die Person muss TOTP neu einrichten.',
      confirmText: 'TOTP zurücksetzen',
      run: resetTotp
    }
  };
  const dialog = confirming ? dialogs[confirming] : null;

  const permissionRow = (item: PermissionAction) => {
    const row = permissions?.find((p) => p.key === item.permission);
    const blocked = !canAssignPermissions ? NO_PERMISSION_RIGHT_REASON : blockedReason(item);
    const verb = PERMISSION_VERBS[item.action];
    return (
      <tr key={item.permission}>
        <th scope="row">{item.name}</th>
        <td>
          <PermissionSources sources={row?.sources ?? []} />
        </td>
        <td>
          <ActionButton
            hintId={`permission-hint-${item.permission}`}
            label={verb.button}
            ariaLabel={`${verb.label}: ${item.name}`}
            blocked={blocked}
            busy={busy}
            onClick={() => void changePermission(item)}
          />
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
          <ActionButton hintId="deactivate-hint" label="Deaktivieren …" blocked={blockedReason(deactivation)} busy={busy} onClick={() => setConfirming('deactivate')} />
          {revocation && (
            <ActionSection
              title="Sitzungen beenden"
              text="Beendet alle Sitzungen des Kontos auf allen Geräten, etwa nach einem Geräteverlust. Das Konto bleibt aktiv; die Person meldet sich danach neu an."
            >
              <ActionButton hintId="revoke-hint" label="Sitzungen beenden …" blocked={blockedReason(revocation)} busy={busy} onClick={() => setConfirming('revoke')} />
            </ActionSection>
          )}
          {totpReset && (
            <ActionSection
              title="TOTP zurücksetzen"
              text="Setzt den zweiten Faktor (TOTP) des Kontos zurück, etwa wenn Gerät und Recovery-Codes verloren sind. Alle Sitzungen enden; die Person muss TOTP danach neu einrichten."
            >
              <ActionButton hintId="reset-totp-hint" label="TOTP zurücksetzen …" blocked={blockedReason(totpReset)} busy={busy} onClick={() => setConfirming('resetTotp')} />
            </ActionSection>
          )}
          {reactivation && (
            <ActionSection title="Konto reaktivieren" text="Die Person kann sich danach wieder anmelden. Frühere Sitzungen bleiben beendet: Die Person muss sich danach neu anmelden.">
              <ActionButton hintId="reactivate-hint" label="Reaktivieren" blocked={blockedReason(reactivation)} busy={busy} onClick={() => void reactivate()} />
            </ActionSection>
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
              <ActionButton hintId="resync-hint" label="Abgleich wiederholen" blocked={blockedReason(resyncAction)} busy={busy} onClick={() => void resync()} />
            </>
          )}
        </section>
      </Card>
      <ConfirmDialog
        open={dialog !== null}
        title={dialog?.title ?? ''}
        description={dialog?.description ?? ''}
        confirmText={dialog?.confirmText ?? ''}
        variant="danger"
        onConfirm={() => {
          setConfirming(null);
          void dialog?.run();
        }}
        onCancel={() => setConfirming(null)}
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
