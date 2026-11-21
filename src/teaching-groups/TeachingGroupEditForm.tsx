import { useCallback, useState, type FormEvent } from 'react';
import { Button, Card, Checkbox, FormField, TextInput } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { useResource } from '../shared/useResource';
import { editableClasses, MAX_NAME_LENGTH, teachingGroupFormProblem, type TeachingGroup, type TeachingGroupChoices } from './teachingGroups';

interface Props {
  apiClient: AxiosInstance;
  group: TeachingGroup;
  busy: boolean;
  onSubmit: (name: string, classIds: string[]) => void;
  onCancel: () => void;
}

/**
 * Formular „Fachgruppe bearbeiten“ (Ticket #65): Bezeichnung und Klassen mit denselben Regeln wie beim Anlegen. Schuljahr und
 * Fach werden nur genannt, nicht angeboten: sie lassen sich nicht aendern. Zur Auswahl stehen die eigenen Klassen der
 * Fachgruppe (auch eine nach dem Verknuepfen archivierte, markiert; sie darf bleiben oder entfernt werden) und die
 * waehlbaren Klassen des Schuljahres von `GET /api/teaching-groups/choices`. Speichern ist erst bei einer Aenderung moeglich.
 * Ob eine Klasse entfernt werden darf, entscheidet die API. Beim Wechsel der Fachgruppe neu mounten (`key`).
 */
export default function TeachingGroupEditForm({ apiClient, group, busy, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(group.name);
  const [classIds, setClassIds] = useState<string[]>(group.classes.map((c) => c.id));

  const fetchChoices = useCallback(
    async () => (await apiClient.get<TeachingGroupChoices>('/api/teaching-groups/choices', { params: { school_year_id: group.school_year.id } })).data,
    [apiClient, group.school_year.id]
  );
  const { data: choices, loadError, reload } = useResource(fetchChoices);

  const classes = choices === null ? [] : editableClasses(group.classes, choices.classes);
  const problem = teachingGroupFormProblem(name, group.subject.id, classIds);
  const originalIds = group.classes.map((c) => c.id);
  const changed = name.trim() !== group.name || classIds.length !== originalIds.length || classIds.some((id) => !originalIds.includes(id));

  const toggleClass = (id: string) => setClassIds((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (choices !== null && problem === undefined && changed) {
      // In der Reihenfolge der Klassen (Stufe, Bezeichnung), nicht des Anklickens.
      onSubmit(name.trim(), classes.map((c) => c.id).filter((id) => classIds.includes(id)));
    }
  };

  return (
    <Card>
      <form aria-label="Fachgruppe bearbeiten" onSubmit={submit}>
        <h2>Fachgruppe {group.name} bearbeiten</h2>
        <FormField label="Bezeichnung" htmlFor="teaching-group-edit-name">
          <TextInput id="teaching-group-edit-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        {loadError && (
          <>
            <p role="alert">Die Auswahl der Klassen konnte nicht geladen werden.</p>
            <Button type="button" variant="secondary" onClick={() => void reload()}>Erneut laden</Button>
          </>
        )}
        {!loadError && choices === null && <p>Auswahl wird geladen …</p>}
        {!loadError && choices !== null && (
          <fieldset>
            <legend>Klassen</legend>
            {classes.map((c) => (
              <Checkbox key={c.id} label={c.archived ? `${c.name} (archiviert)` : c.name} checked={classIds.includes(c.id)} onChange={() => toggleClass(c.id)} />
            ))}
          </fieldset>
        )}
        <p>
          Die Fachgruppe gehört zum Schuljahr {group.school_year.name} und zum Fach {group.subject.code} – {group.subject.name}; beides lässt sich nicht ändern. Die
          Bezeichnung (bis {MAX_NAME_LENGTH} Zeichen) ist im Schuljahr eindeutig, Groß- und Kleinschreibung zählt nicht. Mindestens eine Klasse bleibt.
        </p>
        <p aria-live="polite">{problem !== undefined && <span role="alert">{problem}</span>}</p>
        <Button type="submit" disabled={busy || choices === null || problem !== undefined || !changed}>Speichern</Button>{' '}
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>Abbrechen</Button>
      </form>
    </Card>
  );
}
