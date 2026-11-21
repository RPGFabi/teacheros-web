import { useState, type FormEvent } from 'react';
import { Button, Card, FormField, TextInput } from '@hoelzle/react-ui';
import { subjectNameProblem, type Subject } from './subjects';

interface Props {
  subject: Subject;
  busy: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

/**
 * Formular „Fach bearbeiten“ (Ticket #63): nur die Bezeichnung, mit denselben Regeln wie beim Anlegen. Das Kuerzel wird nur
 * genannt, nicht angeboten: es laesst sich nicht aendern. Speichern ist erst bei einer Aenderung moeglich. Beim Wechsel des
 * Faches neu mounten (`key`).
 */
export default function SubjectEditForm({ subject, busy, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(subject.name);

  const problem = subjectNameProblem(name);
  const changed = name.trim() !== subject.name;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (problem === undefined && changed) {
      onSubmit(name.trim());
    }
  };

  return (
    <Card>
      <form aria-label="Fach bearbeiten" onSubmit={submit}>
        <h2>Fach {subject.code} bearbeiten</h2>
        <FormField label="Bezeichnung" htmlFor="subject-edit-name">
          <TextInput id="subject-edit-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <p>Das Kürzel {subject.code} lässt sich nicht ändern.</p>
        <p aria-live="polite">{problem !== undefined && <span role="alert">{problem}</span>}</p>
        <Button type="submit" disabled={busy || problem !== undefined || !changed}>Speichern</Button>{' '}
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>Abbrechen</Button>
      </form>
    </Card>
  );
}
