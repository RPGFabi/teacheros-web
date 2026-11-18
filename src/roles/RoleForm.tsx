import { useId, useState, type FormEvent } from 'react';
import { Button, Card, Checkbox, FormField, TextInput } from '@hoelzle/react-ui';
import { blockedReason, groupCatalog, type CatalogEntry, type Outcome, type PermissionGrant, type RoleRow } from './roles';

export interface RolePayload {
  name: string;
  description: string | null;
  permissions: string[];
  /** Fehlt bei Standardrollen: ihr MFA-Merkmal ist fest. */
  requires_mfa?: boolean;
}

interface Props {
  /** `null` = neue Rolle anlegen. */
  role: RoleRow | null;
  catalog: CatalogEntry[];
  /** Aus der API (`permission_actions` der Rolle bzw. von `create`): je Recht, ob der Betrachter es hinzufuegen darf. */
  permissionActions: PermissionGrant[];
  /** Aus der API (Aktion `set_mfa`): ob das MFA-Merkmal aenderbar ist; `null` bei einer neuen Rolle (immer aenderbar). */
  mfaAction: Outcome | null;
  busy: boolean;
  onSubmit: (payload: RolePayload) => void;
  onCancel: () => void;
}

/**
 * Formular zum Anlegen und Bearbeiten einer Rolle (Ticket #33): Name, Beschreibung, Rechte als gruppierte
 * Checkboxen aus dem Katalog, „Erfordert MFA“. Was nicht erlaubt ist, bleibt sichtbar, aber deaktiviert, mit der
 * Begruendung der API; entschieden wird dort, hier wird nichts nachgerechnet.
 */
export default function RoleForm({ role, catalog, permissionActions, mfaAction, busy, onSubmit, onCancel }: Props) {
  const ids = useId();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const [requiresMfa, setRequiresMfa] = useState(role?.requires_mfa ?? true);

  const mfaReason = mfaAction === null ? null : blockedReason(mfaAction);
  const title = role ? `Rolle bearbeiten: ${role.name}` : 'Rolle anlegen';
  const catalogMissing = catalog.length === 0;

  const toggle = (key: string) => setSelected((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() === '' ? null : description.trim(),
      permissions: catalog.filter((entry) => selected.includes(entry.key)).map((entry) => entry.key),
      ...(mfaReason === null && { requires_mfa: requiresMfa })
    });
  };

  return (
    <Card>
      <form aria-label={role ? 'Rolle bearbeiten' : 'Rolle anlegen'} onSubmit={submit}>
        <h2>{title}</h2>
        <FormField label="Name" htmlFor={`${ids}-name`}>
          <TextInput id={`${ids}-name`} autoComplete="off" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Beschreibung" htmlFor={`${ids}-description`}>
          <TextInput id={`${ids}-description`} autoComplete="off" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
        <fieldset>
          <legend>Rechte</legend>
          {catalogMissing && <p role="alert">Der Rechte-Katalog konnte nicht geladen werden. Bitte laden Sie die Seite neu.</p>}
          {groupCatalog(catalog).map(({ group, entries }) => (
            <fieldset key={group}>
              <legend>{group}</legend>
              {entries.map((entry) => {
                // Abwaehlen geht immer; fuer ein noch fehlendes Recht sagt die API, ob es hinzugefuegt werden darf.
                const reason = blockedReason(permissionActions.find((p) => p.permission === entry.key) ?? { allowed: true, code: null, reason: null });
                const locked = reason !== null && !selected.includes(entry.key);
                const reasonId = `${ids}-${entry.key}-reason`;
                return (
                  <div key={entry.key}>
                    <Checkbox
                      label={entry.name}
                      checked={selected.includes(entry.key)}
                      disabled={locked}
                      aria-describedby={locked ? reasonId : undefined}
                      onChange={() => toggle(entry.key)}
                    />
                    {locked && <small id={reasonId}>{reason}</small>}
                  </div>
                );
              })}
            </fieldset>
          ))}
        </fieldset>
        <div>
          <Checkbox
            label="Erfordert MFA"
            checked={requiresMfa}
            disabled={mfaReason !== null}
            aria-describedby={mfaReason !== null ? `${ids}-mfa-reason` : undefined}
            onChange={() => setRequiresMfa((value) => !value)}
          />
          {mfaReason !== null && <small id={`${ids}-mfa-reason`}>{mfaReason}</small>}
        </div>
        <p>
          <Button type="submit" disabled={busy || catalogMissing || name.trim() === ''}>{role ? 'Speichern' : 'Anlegen'}</Button>{' '}
          <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>Abbrechen</Button>
        </p>
      </form>
    </Card>
  );
}
