import { useCallback, useId, useState, type FormEvent } from 'react';
import { Button, Card, FormField, TextInput } from '@hoelzle/react-ui';
import type { AxiosInstance } from 'axios';
import { useResource } from '../shared/useResource';
import { SETTING_DESCRIPTIONS, SETTING_LABELS, describeSchoolSettingsFailure, settingProblem, type SchoolSetting } from './schoolSettings';

interface Props {
  apiClient: AxiosInstance;
}

/**
 * Seite „Schuleinstellungen“ (Ticket #66): die Werte, die die Schule fuer ihre ganze Schulinstanz festlegt (Lehrkraefte je
 * Fachgruppe, Klassenleitungen je Klasse). Der Menuepunkt erscheint nur mit `school_settings.manage`; dasselbe Recht gilt
 * fuer Lesen und Aendern. Standard und Bereich kommen aus der API, die Seite prueft nur vorab; die API bleibt massgeblich.
 */
export default function SchoolSettingsPage({ apiClient }: Props) {
  const fetchSettings = useCallback(async () => (await apiClient.get<{ school_settings: SchoolSetting[] }>('/api/school-settings')).data.school_settings, [apiClient]);
  const { data: settings, loadError, reload, busy, notice, error, run } = useResource<SchoolSetting[], 'save'>(fetchSettings, describeSchoolSettingsFailure);

  const save = (changes: Record<string, number>) =>
    run('save', async () => {
      await apiClient.post('/api/school-settings/update', changes);
      return 'Schuleinstellungen gespeichert.';
    });

  return (
    <main className="content">
      <h1>Schuleinstellungen</h1>
      <p>
        Diese Werte gelten für die ganze Schule und alle Schuljahre. Wird ein Wert verschärft, gilt er nur für neue Zuordnungen:
        Bestehende Zuordnungen bleiben unberührt.
      </p>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {loadError && (
        <Card>
          <p role="alert">Die Schuleinstellungen konnten nicht geladen werden.</p>
          <Button variant="secondary" onClick={() => void reload()}>Erneut laden</Button>
        </Card>
      )}
      {!loadError && settings === null && <p>Schuleinstellungen werden geladen …</p>}
      {!loadError && settings !== null && <SettingsForm settings={settings} busy={busy} onSave={save} />}
    </main>
  );
}

interface FormProps {
  settings: SchoolSetting[];
  busy: boolean;
  /** Liefert true, wenn die API die Werte angenommen hat; bei einer Ablehnung bleiben die Eingaben stehen. */
  onSave: (changes: Record<string, number>) => Promise<boolean>;
}

/** Ein Eingabefeld je Einstellung; geschickt werden nur die geaenderten Werte. */
function SettingsForm({ settings, busy, onSave }: FormProps) {
  const id = useId();
  // Eingaben je Schluessel; ohne Eintrag gilt der gespeicherte Wert. Nach einem Speichern laedt die Seite neu und der
  // Eintrag stimmt wieder mit dem gespeicherten Wert ueberein.
  const [typed, setTyped] = useState<Record<string, string>>({});

  const current = (setting: SchoolSetting) => typed[setting.key] ?? String(setting.value);
  const problems = settings.map((s) => ({ setting: s, problem: settingProblem(s, current(s)) }));
  const changes = Object.fromEntries(
    settings.filter((s) => settingProblem(s, current(s)) === undefined && Number(current(s)) !== s.value).map((s) => [s.key, Number(current(s))])
  );
  const hasProblem = problems.some((p) => p.problem !== undefined);
  const canSave = !busy && !hasProblem && Object.keys(changes).length > 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (canSave) {
      await onSave(changes);
    }
  };

  return (
    <Card>
      <form aria-label="Schuleinstellungen" onSubmit={(event) => void submit(event)}>
        {problems.map(({ setting, problem }) => (
          <div key={setting.key}>
            <FormField label={SETTING_LABELS[setting.key] ?? setting.key} htmlFor={`${id}-${setting.key}`}>
              <TextInput
                id={`${id}-${setting.key}`}
                type="number"
                inputMode="numeric"
                min={setting.min}
                max={setting.max}
                hasError={problem !== undefined}
                value={current(setting)}
                onChange={(e) => setTyped((previous) => ({ ...previous, [setting.key]: e.target.value }))}
              />
            </FormField>
            <p>
              {SETTING_DESCRIPTIONS[setting.key] ?? ''} (Standard {setting.default}, erlaubt {setting.min} bis {setting.max})
            </p>
            {problem !== undefined && <p role="alert">{problem}</p>}
          </div>
        ))}
        <Button type="submit" disabled={!canSave}>Speichern</Button>
      </form>
    </Card>
  );
}
