import { describeFailure, type FailureTexts } from '../api/errors';

/**
 * Schuleinstellung laut `GET /api/school-settings` (Ticket #66, Glossar: Schuleinstellung): ein ganzzahliger Wert, den die
 * Schule fuer ihre ganze Schulinstanz festlegt, gleich fuer alle Schuljahre. Standard und zulaessiger Bereich liefert die API.
 */
export interface SchoolSetting {
  key: string;
  value: number;
  default: number;
  min: number;
  max: number;
}

/** Anzeigename der Einstellungen, die die Seite kennt; eine unbekannte Einstellung der API zeigt die Seite mit ihrem Schluessel. */
export const SETTING_LABELS: Record<string, string> = {
  max_teachers_per_subject_group: 'Lehrkräfte je Fachgruppe',
  max_class_leaders_per_class: 'Klassenleitungen je Klasse'
};

/** Erklaerung, was die Einstellung begrenzt. */
export const SETTING_DESCRIPTIONS: Record<string, string> = {
  max_teachers_per_subject_group: 'Wie viele Lehrkräfte eine Fachgruppe höchstens zugleich hat.',
  max_class_leaders_per_class: 'Wie viele Klassenleitungen eine Klasse höchstens zugleich hat.'
};

/** Hinweis zur Eingabe oder `undefined`, wenn sie passt: eine ganze Zahl im Bereich der Einstellung. Die API bleibt massgeblich. */
export function settingProblem(setting: SchoolSetting, typed: string): string | undefined {
  const trimmed = typed.trim();
  const value = Number(trimmed);
  if (!/^-?\d+$/.test(trimmed) || value < setting.min || value > setting.max) {
    return `Bitte eine ganze Zahl von ${setting.min} bis ${setting.max} angeben.`;
  }
  return undefined;
}

type SaveAction = 'save';

const FAILURE_TEXTS: FailureTexts<SaveAction> = {
  codes: {
    forbidden: 'Dafür fehlt Ihnen das Recht „Schuleinstellungen verwalten“.',
    invalid_request: 'Bitte geben Sie ganze Zahlen im jeweils erlaubten Bereich an.',
    school_settings_busy: 'Die Schuleinstellungen werden gerade geändert. Bitte versuchen Sie es gleich noch einmal.'
  },
  fallback: { save: 'Die Schuleinstellungen konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.' }
};

/** Text zu einer abgelehnten Anfrage auf Schuleinstellungen. */
export function describeSchoolSettingsFailure(err: unknown): string {
  return describeFailure(err, 'save', FAILURE_TEXTS);
}
