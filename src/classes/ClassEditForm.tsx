import { useState, type FormEvent } from 'react';
import { Button, Card, FormField, TextInput } from '@hoelzle/react-ui';
import { classFormProblem, MAX_GRADE_LEVEL, MIN_GRADE_LEVEL, type SchoolClass } from './classes';

interface Props {
  schoolClass: SchoolClass;
  busy: boolean;
  onSubmit: (gradeLevel: number, name: string) => void;
  onCancel: () => void;
}

/**
 * Formular „Klasse bearbeiten“ (Ticket #57): Klassenstufe und Bezeichnung mit denselben Regeln wie beim Anlegen. Das
 * Schuljahr wird nur genannt, nicht angeboten: es laesst sich nicht aendern. Speichern ist erst bei einer Aenderung moeglich.
 * Beim Wechsel der Klasse neu mounten (`key`).
 */
export default function ClassEditForm({ schoolClass, busy, onSubmit, onCancel }: Props) {
  const [gradeLevel, setGradeLevel] = useState(String(schoolClass.grade_level));
  const [name, setName] = useState(schoolClass.name);

  const problem = classFormProblem(gradeLevel, name);
  const changed = gradeLevel !== String(schoolClass.grade_level) || name.trim() !== schoolClass.name;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (problem === undefined && changed) {
      onSubmit(Number(gradeLevel), name.trim());
    }
  };

  return (
    <Card>
      <form aria-label="Klasse bearbeiten" onSubmit={submit}>
        <h2>Klasse {schoolClass.name} bearbeiten</h2>
        <FormField label="Klassenstufe" htmlFor="class-edit-grade-level">
          <TextInput
            id="class-edit-grade-level"
            type="number"
            min={MIN_GRADE_LEVEL}
            max={MAX_GRADE_LEVEL}
            step={1}
            inputMode="numeric"
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
          />
        </FormField>
        <FormField label="Bezeichnung" htmlFor="class-edit-name">
          <TextInput id="class-edit-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <p>Die Klasse gehört zum Schuljahr {schoolClass.school_year.name}; das Schuljahr lässt sich nicht ändern.</p>
        <p aria-live="polite">{problem !== undefined && <span role="alert">{problem}</span>}</p>
        <Button type="submit" disabled={busy || problem !== undefined || !changed}>Speichern</Button>{' '}
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>Abbrechen</Button>
      </form>
    </Card>
  );
}
