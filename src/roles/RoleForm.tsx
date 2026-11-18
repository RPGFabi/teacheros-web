import { useId, useState, type FormEvent } from 'react';
import { Button, Card, Checkbox, FormField, TextInput } from '@hoelzle/react-ui';
import { groupCatalog, type CatalogEntry, type RoleRow } from './roles';

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
  /** Effektive Rechte des angemeldeten Kontos (P2: nur diese lassen sich hinzufuegen). */
  heldPermissions: string[];
  busy: boolean;
  onSubmit: (payload: RolePayload) => void;
  onCancel: () => void;
}

/**
 * Formular zum Anlegen und Bearbeiten einer Rolle (Ticket #33): Name, Beschreibung, Rechte als gruppierte
 * Checkboxen aus dem Katalog, „Erfordert MFA“. Nicht erlaubte Eingaben bleiben sichtbar, aber deaktiviert, mit Begruendung;
 * die API prueft alles noch einmal.
 */
export default function RoleForm({ role, catalog, heldPermissions, busy, onSubmit, onCancel }: Props) {
  const ids = useId();
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? []);
  const [requiresMfa, setRequiresMfa] = useState(role?.requires_mfa ?? true);

  const mfaFixed = role !== null && role.protection !== 'custom';
  const original = role?.permissions ?? [];
  const title = role ? `Rolle bearbeiten: ${role.name}` : 'Rolle anlegen';
  const catalogMissing = catalog.length === 0;

  const toggle = (key: string) => setSelected((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() === '' ? null : description.trim(),
      permissions: catalog.filter((entry) => selected.includes(entry.key)).map((entry) => entry.key),
      ...(!mfaFixed && { requires_mfa: requiresMfa })
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
                // Abwaehlen geht immer; neu setzen nur mit eigenem Besitz des Rechts (P2).
                const locked = !heldPermissions.includes(entry.key) && !original.includes(entry.key);
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
                    {locked && <small id={reasonId}>Sie besitzen dieses Recht nicht und können es daher nicht vergeben.</small>}
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
            disabled={mfaFixed}
            aria-describedby={mfaFixed ? `${ids}-mfa-reason` : undefined}
            onChange={() => setRequiresMfa((value) => !value)}
          />
          {mfaFixed && <small id={`${ids}-mfa-reason`}>Bei Standardrollen fest vorgegeben.</small>}
        </div>
        <p>
          <Button type="submit" disabled={busy || catalogMissing || name.trim() === ''}>{role ? 'Speichern' : 'Anlegen'}</Button>{' '}
          <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>Abbrechen</Button>
        </p>
      </form>
    </Card>
  );
}
