import { useCallback, useEffect, useState } from 'react';
import { Button, Card } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { statusLabel } from '../account/status';
import type { AccountAccess, RoleAction } from './access';
import EffectivePermissions from './EffectivePermissions';

interface Props {
  apiClient: AxiosInstance;
  accountId: string;
  /** Recht `roles.assign` aus GET /api/me; ohne es sind Vergeben und Entziehen gesperrt (sichtbar, mit Begruendung). */
  canAssign: boolean;
  onBack: () => void;
}

/** Verstaendliche Texte fuer die Fehlercodes der API beim Vergeben und Entziehen. */
const ERROR_TEXT: Record<string, string> = {
  self_escalation: 'Sie können sich selbst keine Rolle geben.',
  permission_not_held: 'Sie besitzen nicht alle Rechte dieser Rolle und dürfen sie deshalb weder vergeben noch entziehen.',
  student_role_exclusive: 'Ein Konto mit der Rolle Schüler/in hat keine weitere Rolle und keine Einzelrechte.',
  admin_overrides_forbidden: 'Konten mit Einzelrechten können nicht Schuladmin werden. Setzen Sie die Einzelrechte zuerst zurück.',
  last_admin: 'Das ist der letzte aktive Schuladmin. Ernennen Sie zuerst einen weiteren Schuladmin, der sich schon angemeldet hat.',
  role_not_found: 'Diese Rolle gibt es nicht mehr.',
  account_not_found: 'Dieses Konto gibt es nicht mehr.',
  forbidden: 'Dafür fehlt Ihnen die Berechtigung.'
};

const NO_RIGHT_REASON = 'Dafür fehlt Ihnen das Recht „Rollen vergeben und entziehen“.';

function describeFailure(err: unknown): string {
  const code = (err as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
  return (typeof code === 'string' && ERROR_TEXT[code]) || 'Die Änderung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.';
}

/**
 * Detailansicht eines Kontos (Ticket #34): Rollen einzeln hinzufuegen und entziehen, effektive Rechte mit Herkunft.
 * Welche Aktion erlaubt ist, entscheidet die API (`role_actions`); nicht erlaubte Aktionen bleiben sichtbar und
 * deaktiviert, mit Begruendung. Jede Antwort der API ist die neue Sicht; nach einem Fehler wird sie neu geladen.
 * Andockpunkte: #35 (letzter Admin, `last_admin`) kommt als `code` in `role_actions`, #36 (Einzelrechte) ueber
 * `renderActions` von {@link EffectivePermissions} und einen eigenen Abschnitt unter den Rechten.
 */
export default function AccountDetail({ apiClient, accountId, canAssign, onBack }: Props) {
  const [access, setAccess] = useState<AccountAccess | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setAccess((await apiClient.get<AccountAccess>(`/api/accounts/${accountId}/access`)).data);
    } catch (err) {
      const code = (err as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
      setLoadError(code === 'account_not_found' ? ERROR_TEXT.account_not_found : 'Das Konto konnte nicht geladen werden.');
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

  return (
    <main className="content">
      <p>{back}</p>
      <h1>{access.account.email ?? access.account.login_name}</h1>
      <p>
        Anmeldename {access.account.login_name} · {statusLabel(access.account.status)} · Mehrfaktor-Anmeldung{' '}
        {access.account.mfa_required ? 'erforderlich' : 'nicht erforderlich'}
      </p>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
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
    </main>
  );
}
