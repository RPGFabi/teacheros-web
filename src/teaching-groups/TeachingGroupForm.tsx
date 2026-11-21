import { useCallback, useState, type FormEvent } from 'react';
import { Button, Card, Checkbox, FormField, Select, TextInput } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { useResource } from '../shared/useResource';
import { describeTeachingGroupFailure, MAX_NAME_LENGTH, teachingGroupFormProblem, type TeachingGroup, type TeachingGroupAction, type TeachingGroupChoices } from './teachingGroups';

interface Props {
  apiClient: AxiosInstance;
  schoolYear: { id: string; name: string };
  /** Wird nach jedem Anlegen aufgerufen, auch nach einem Fehler: die Liste der Fachgruppen laedt dann neu. */
  onChanged: () => void | Promise<void>;
}

/**
 * Formular „Fachgruppe anlegen“ (Ticket #64): Bezeichnung, Fach (nur waehlbare) und eine oder mehrere Klassen des gewaehlten
 * Schuljahres (nur waehlbare, also nicht archivierte). Die Auswahl kommt von `GET /api/teaching-groups/choices`. Nach dem
 * Anlegen bleiben Fach und Klassen stehen, nur die Bezeichnung wird geleert: meist folgen weitere Fachgruppen desselben
 * Faches und derselben Klassen (AES 1, AES 2, ...).
 */
export default function TeachingGroupForm({ apiClient, schoolYear, onChanged }: Props) {
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classIds, setClassIds] = useState<string[]>([]);

  const fetchChoices = useCallback(
    async () => (await apiClient.get<TeachingGroupChoices>('/api/teaching-groups/choices', { params: { school_year_id: schoolYear.id } })).data,
    [apiClient, schoolYear.id]
  );
  const { data: choices, loadError, reload, busy, notice, error, run } = useResource<TeachingGroupChoices, TeachingGroupAction>(fetchChoices, describeTeachingGroupFailure);

  const problem = teachingGroupFormProblem(name, subjectId, classIds);
  // Ein Hinweis erscheint erst, wenn schon etwas eingegeben ist; ein leeres Formular ist nur gesperrt.
  const hint = name !== '' || subjectId !== '' || classIds.length > 0 ? problem : undefined;

  const toggleClass = (id: string) => setClassIds((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (problem !== undefined) {
      return;
    }
    // In der Reihenfolge der Auswahl der API, nicht des Anklickens.
    const orderedClassIds = (choices?.classes ?? []).map((c) => c.id).filter((id) => classIds.includes(id));
    const ok = await run('create', async () => {
      const { data } = await apiClient.post<{ teaching_group: TeachingGroup }>('/api/teaching-groups', {
        school_year_id: schoolYear.id,
        subject_id: subjectId,
        name: name.trim(),
        class_ids: orderedClassIds
      });
      return `Fachgruppe ${data.teaching_group.name} angelegt.`;
    });
    await onChanged();
    if (ok) {
      setName('');
    }
  };

  return (
    <>
      <Card>
        <form aria-label="Fachgruppe anlegen" onSubmit={(event) => void submit(event)}>
          <h2>Fachgruppe anlegen</h2>
          <FormField label="Bezeichnung" htmlFor="teaching-group-name">
            <TextInput id="teaching-group-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. AES 1" />
          </FormField>
          {loadError && (
            <>
              <p role="alert">Die Auswahl für Fach und Klassen konnte nicht geladen werden.</p>
              <Button variant="secondary" onClick={() => void reload()}>Erneut laden</Button>
            </>
          )}
          {!loadError && choices === null && <p>Auswahl wird geladen …</p>}
          {!loadError && choices !== null && (
            <>
              {choices.subjects.length === 0 ? (
                <p>Es gibt noch kein wählbares Fach. Legen Sie zuerst ein Fach an.</p>
              ) : (
                <FormField label="Fach" htmlFor="teaching-group-subject">
                  <Select
                    id="teaching-group-subject"
                    value={subjectId}
                    placeholder="Fach wählen"
                    options={choices.subjects.map((s) => ({ value: s.id, label: `${s.code} – ${s.name}` }))}
                    onChange={(e) => setSubjectId(e.target.value)}
                  />
                </FormField>
              )}
              {choices.classes.length === 0 ? (
                <p>In diesem Schuljahr gibt es noch keine wählbare Klasse. Legen Sie zuerst eine Klasse an.</p>
              ) : (
                <fieldset>
                  <legend>Klassen</legend>
                  {choices.classes.map((c) => (
                    <Checkbox key={c.id} label={c.name} checked={classIds.includes(c.id)} onChange={() => toggleClass(c.id)} />
                  ))}
                </fieldset>
              )}
            </>
          )}
          <p>
            Die Fachgruppe gehört zum Schuljahr {schoolYear.name} und lässt sich nicht in ein anderes verschieben; sie hat ein Fach und mindestens eine Klasse dieses
            Schuljahres. Die Bezeichnung (bis {MAX_NAME_LENGTH} Zeichen) ist im Schuljahr eindeutig, Groß- und Kleinschreibung zählt nicht.
          </p>
          <p aria-live="polite">{hint !== undefined && <span role="alert">{hint}</span>}</p>
          <Button type="submit" disabled={busy || choices === null || problem !== undefined}>Anlegen</Button>
        </form>
      </Card>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
