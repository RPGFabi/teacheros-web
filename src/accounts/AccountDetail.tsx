import { useCallback, useEffect, useState } from 'react';
import { Button, Card, ConfirmDialog } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { errorCode } from '../api/errors';
import { statusLabel } from '../account/status';
import type { AccountAccess, PermissionAction, RoleAction } from './access';
import EffectivePermissions, { PermissionSources } from './EffectivePermissions';

interface Props {
  apiClient: AxiosInstance;
  accountId: string;
  /** Recht `roles.assign` aus GET /api/me; ohne es sind Vergeben und Entziehen gesperrt (sichtbar, mit Begruendung). */
  canAssign: boolean;
  /** Recht `permissions.assign` aus GET /api/me; ohne es sind Einzelrechte gesperrt (sichtbar, mit Begruendung). */
  canAssignPermissions?: boolean;
  onBack: () => void;
}

/** Verstaendliche Texte fuer die Fehlercodes der API beim Vergeben, Entziehen, Gewaehren und Zuruecksetzen (Rollen wie Einzelrechte). */
const ERROR_TEXT: Record<string, string> = {
  self_escalation: 'Sie können sich selbst keine Rollen oder Einzelrechte geben, entziehen oder zurücksetzen.',
  permission_not_held: 'Sie besitzen nicht alle dafür nötigen Rechte und dürfen deshalb nichts vergeben, entziehen oder zurücksetzen.',
  student_role_exclusive: 'Ein Konto mit der Rolle Schüler/in hat keine weitere Rolle und keine Einzelrechte.',
  admin_overrides_forbidden: 'Konten mit der Rolle Schuladmin haben keine Einzelrechte; Konten mit Einzelrechten können nicht Schuladmin werden. Setzen Sie die Einzelrechte zuerst zurück.',
  last_admin: 'Das ist der letzte aktive Schuladmin. Ernennen Sie zuerst einen weiteren Schuladmin, der sich schon angemeldet hat.',
  unknown_permission: 'Dieses Recht gibt es nicht.',
  role_not_found: 'Diese Rolle gibt es nicht mehr.',
  account_not_found: 'Dieses Konto gibt es nicht mehr.',
  forbidden: 'Dafür fehlt Ihnen das erforderliche Recht.'
};

/** Fehlertexte der Deaktivierung; ersetzen bei gleichem Code die allgemeinen Texte. */
const DEACTIVATE_ERROR_TEXT: Record<string, string> = {
  self_deactivation: 'Sie können sich nicht selbst deaktivieren.',
  account_not_active: 'Nur aktive Konten lassen sich deaktivieren.',
  permission_not_held: 'Sie besitzen nicht alle Rechte dieses Kontos und dürfen es deshalb nicht deaktivieren.'
};

const NO_RIGHT_REASON = 'Dafür fehlt Ihnen das Recht „Rollen vergeben und entziehen“.';
const NO_PERMISSION_RIGHT_REASON = 'Dafür fehlt Ihnen das Recht „Einzelrechte vergeben und entziehen“.';
const SAVE_FAILED = 'Die Änderung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.';
const DEACTIVATE_FAILED = 'Das Konto konnte nicht deaktiviert werden. Bitte versuchen Sie es erneut.';

const PERMISSION_VERBS = {
  grant: { button: 'Gewähren', label: 'Einzelrecht gewähren', done: 'gewährt' },
  withdraw: { button: 'Entziehen', label: 'Einzelrecht entziehen', done: 'entzogen' },
  clear: { button: 'Zurücksetzen', label: 'Einzelrecht zurücksetzen', done: 'zurückgesetzt' }
} as const;

function describeFailure(err: unknown, overrides: Record<string, string> = {}, fallback = SAVE_FAILED): string {
  const code = errorCode(err);
  return (code !== undefined && (overrides[code] ?? ERROR_TEXT[code])) || fallback;
}

/**
 * Detailansicht eines Kontos (Ticket #34): Rollen einzeln hinzufuegen und entziehen, effektive Rechte mit Herkunft.
 * Welche Aktion erlaubt ist, entscheidet die API (`role_actions`); nicht erlaubte Aktionen bleiben sichtbar und
 * deaktiviert, mit Begruendung. Jede Antwort der API ist die neue Sicht; nach einem Fehler wird sie neu geladen.
 * Einzelrechte (Ticket #36) folgen demselben Muster ueber `permission_actions`: ein Abschnitt mit allen Katalogrechten,
 * je Recht die eine moegliche Aktion (gewaehren, entziehen, zuruecksetzen). Der letzte aktive Schuladmin (Ticket #35,
 * `last_admin`) kommt als gesperrte Aktion mit Begruendung in `role_actions`.
 * Konto deaktivieren (Ticket #41): „Deaktivieren …“ mit Bestaetigungsdialog; ob die Aktion erlaubt ist, sagt die API in
 * `account_actions` (auch das Recht `accounts.deactivate` und die Regeln), sonst bleibt sie gesperrt sichtbar.
 */
export default function AccountDetail({ apiClient, accountId, canAssign, canAssignPermissions = false, onBack }: Props) {
  const [access, setAccess] = useState<AccountAccess | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeactivation, setConfirmingDeactivation] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setAccess((await apiClient.get<AccountAccess>(`/api/accounts/${accountId}/access`)).data);
    } catch (err) {
      setLoadError(errorCode(err) === 'account_not_found' ? ERROR_TEXT.account_not_found : 'Das Konto konnte nicht geladen werden.');
    }
  }, [apiClient, accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(role: RoleAction) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const assigning = role.action === 'assign';
      const { data } = assigning
        ? await apiClient.post<AccountAccess>(`/api/accounts/${accountId}/roles`, { role_id: role.role_id })
        : await apiClient.post<AccountAccess>(`/api/accounts/${accountId}/roles/${role.role_id}/revoke`);
      setAccess(data);
      setNotice(assigning ? `Rolle ${role.role_name} vergeben.` : `Rolle ${role.role_name} entzogen.`);
    } catch (err) {
      setError(describeFailure(err));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function changePermission(item: PermissionAction) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const { data } = await apiClient.post<AccountAccess>(`/api/accounts/${accountId}/permissions/${item.action}`, { permission: item.permission });
      setAccess(data);
      setNotice(`Einzelrecht „${item.name}“ ${PERMISSION_VERBS[item.action].done}.`);
    } catch (err) {
      setError(describeFailure(err));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setConfirmingDeactivation(false);
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      setAccess((await apiClient.post<AccountAccess>(`/api/accounts/${accountId}/deactivate`)).data);
      setNotice('Konto deaktiviert.');
    } catch (err) {
      setError(describeFailure(err, DEACTIVATE_ERROR_TEXT, DEACTIVATE_FAILED));
      await load();
    } finally {
      setBusy(false);
    }
  }

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

  const held = access.role_actions.filter((a) => a.action === 'revoke');
  const available = access.role_actions.filter((a) => a.action === 'assign');

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
  const accountName = access.account.email ?? access.account.login_name;

  const permissionRow = (item: PermissionAction) => {
    const row = access.permissions.find((p) => p.key === item.permission);
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
        Anmeldename {access.account.login_name} · {statusLabel(access.account.status, access.account.inactive_since)} · Erfordert MFA:{' '}
        {access.account.mfa_required ? 'Ja' : 'Nein'}
      </p>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <Card>
        <section aria-label="Konto">
          <h2>Konto</h2>
          <p>Eine Deaktivierung sperrt das Konto sofort. Rollen und Rechte bleiben erhalten.</p>
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
          <EffectivePermissions permissions={access.permissions} />
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
            <tbody>{access.permission_actions.map(permissionRow)}</tbody>
          </table>
        </section>
      </Card>
    </main>
  );
}
