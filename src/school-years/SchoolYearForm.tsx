import { useId, useState, type FormEvent } from 'react';
import { Button, FormField, TextInput } from '@hoelzle/react-ui';
import { previewName } from './schoolYears';

interface Props {
  /** Name des Formulars (zugleich Ueberschrift): „Schuljahr anlegen“ oder „Schuljahr bearbeiten“. */
  label: string;
  submitText: string;
  initialStart?: string;
  initialEnd?: string;
  busy: boolean;
  /** Leert die Eingaben nach einem gelungenen Abschicken (Anlegen); beim Bearbeiten schliesst die Seite das Formular. */
  clearOnSuccess?: boolean;
  /** Liefert true, wenn die API den Zeitraum angenommen hat; bei einer Ablehnung bleiben die Eingaben stehen. */
  onSubmit: (startsOn: string, endsOn: string) => Promise<boolean>;
  onCancel?: () => void;
}

/** Beginn und Ende eines Schuljahres mit Vorschau der Bezeichnung; Anlegen und Bearbeiten haben dieselben Regeln. */
export default function SchoolYearForm({ label, submitText, initialStart = '', initialEnd = '', busy, clearOnSuccess = false, onSubmit, onCancel }: Props) {
  const id = useId();
  const [startsOn, setStartsOn] = useState(initialStart);
  const [endsOn, setEndsOn] = useState(initialEnd);
  const preview = previewName(startsOn, endsOn);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await onSubmit(startsOn, endsOn);
    if (ok && clearOnSuccess) {
      setStartsOn('');
      setEndsOn('');
    }
  };

  return (
    <form aria-label={label} onSubmit={(event) => void submit(event)}>
      <h2>{label}</h2>
      <FormField label="Beginn" htmlFor={`${id}-start`}>
        <TextInput id={`${id}-start`} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
      </FormField>
      <FormField label="Ende" htmlFor={`${id}-end`}>
        <TextInput id={`${id}-end`} type="date" hasError={preview.problem !== undefined} value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
      </FormField>
      <p>
        Beide Tage gehören zum Schuljahr. Das Ende muss im Kalenderjahr nach dem Beginn liegen; Schuljahre dürfen sich nicht überschneiden, Lücken dazwischen sind erlaubt.
        Die Bezeichnung ergibt sich aus dem Zeitraum.
      </p>
      <p aria-live="polite">
        {preview.name !== undefined && (
          <>
            Bezeichnung: <output>{preview.name}</output>
          </>
        )}
        {preview.problem !== undefined && <span role="alert">{preview.problem}</span>}
      </p>
      <Button type="submit" disabled={busy || preview.name === undefined}>{submitText}</Button>{' '}
      {onCancel && <Button variant="secondary" onClick={onCancel}>Abbrechen</Button>}
    </form>
  );
}
