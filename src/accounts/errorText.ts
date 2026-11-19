import { errorCode } from '../api/errors';

/**
 * Welche Aktion der Kontodetailansicht scheiterte; davon haengen nur wenige Texte ab (Review #12: eine Tabelle statt je
 * Aktion eine eigene).
 */
export type Flow = 'assign' | 'deactivate' | 'reactivate' | 'revoke' | 'resync';

interface FlowText {
  /** Wenn die Aktion mit einem Code scheitert, den die Tabelle nicht kennt. */
  fallback: string;
  /** `permission_not_held` (P2) heisst je Aktion etwas anderes. */
  permissionNotHeld: string;
  /** `account_not_active` heisst je Aktion etwas anderes; fehlt der Text, gilt der allgemeine. */
  notActive?: string;
  /** Was nach einem Fehler des Anmeldedienstes unveraendert bleibt (Satzanfang ohne Punkt), falls die Aktion ihn aufruft. */
  unchanged?: string;
}

const FLOWS: Record<Flow, FlowText> = {
  assign: {
    fallback: 'Die Änderung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.',
    permissionNotHeld: 'Sie besitzen nicht alle dafür nötigen Rechte und dürfen deshalb nichts vergeben, entziehen oder zurücksetzen.'
  },
  deactivate: {
    fallback: 'Das Konto konnte nicht deaktiviert werden. Bitte versuchen Sie es erneut.',
    permissionNotHeld: 'Sie besitzen nicht alle Rechte dieses Kontos und dürfen es deshalb nicht deaktivieren.',
    notActive: 'Nur aktive Konten lassen sich deaktivieren.'
  },
  revoke: {
    fallback: 'Die Sitzungen konnten nicht beendet werden. Bitte versuchen Sie es erneut.',
    permissionNotHeld: 'Sie besitzen nicht alle Rechte dieses Kontos und dürfen deshalb seine Sitzungen nicht beenden.',
    notActive: 'Nur bei aktiven Konten lassen sich die Sitzungen beenden.'
  },
  reactivate: {
    fallback: 'Das Konto konnte nicht reaktiviert werden. Bitte versuchen Sie es erneut.',
    permissionNotHeld: 'Sie besitzen nicht alle Rechte dieses Kontos und dürfen es deshalb nicht reaktivieren.',
    unchanged: 'Das Konto bleibt deaktiviert'
  },
  resync: {
    fallback: 'Der Abgleich konnte nicht wiederholt werden. Bitte versuchen Sie es erneut.',
    permissionNotHeld: 'Sie besitzen nicht alle dafür nötigen Rechte.',
    unchanged: 'Der Abgleich bleibt offen'
  }
};

const AUTH_SERVICE_UNKNOWN_ACCOUNT = 'Der Anmeldedienst kennt dieses Konto nicht.';

/** Texte, die nicht von der Aktion abhaengen (Fehlercodes der API, `{error, code}`). */
const ERROR_TEXT: Record<string, string> = {
  self_escalation: 'Sie können sich selbst keine Rollen oder Einzelrechte geben, entziehen oder zurücksetzen.',
  student_role_exclusive: 'Ein Konto mit der Rolle Schüler/in hat keine weitere Rolle und keine Einzelrechte.',
  admin_overrides_forbidden: 'Konten mit der Rolle Schuladmin haben keine Einzelrechte; Konten mit Einzelrechten können nicht Schuladmin werden. Setzen Sie die Einzelrechte zuerst zurück.',
  last_admin: 'Das ist der letzte aktive Schuladmin. Ernennen Sie zuerst einen weiteren Schuladmin, der sich schon angemeldet hat.',
  unknown_permission: 'Dieses Recht gibt es nicht.',
  role_not_found: 'Diese Rolle gibt es nicht mehr.',
  account_not_found: 'Dieses Konto gibt es nicht mehr.',
  forbidden: 'Dafür fehlt Ihnen das erforderliche Recht.',
  self_deactivation: 'Sie können sich nicht selbst deaktivieren.',
  self_revocation: 'Die eigenen Sitzungen beenden Sie unter „Mein Konto“.',
  self_reactivation: 'Sie können sich nicht selbst reaktivieren.',
  account_not_inactive: 'Nur deaktivierte Konten lassen sich reaktivieren.',
  self_deleted: 'Die Person hat ihr Konto selbst gelöscht. Das lässt sich nicht rückgängig machen; das Konto bleibt deaktiviert.',
  email_unconfirmed: 'Die E-Mail-Adresse der Person ist noch nicht bestätigt. Das Konto bleibt deaktiviert.',
  sync_not_pending: 'Es ist kein Abgleich mehr offen.'
};

/** Verstaendlicher Text zu einem fehlgeschlagenen Aufruf der API; unbekannte oder fehlende Codes ergeben den allgemeinen Text der Aktion. */
export function describeFailure(err: unknown, flow: Flow): string {
  const code = errorCode(err);
  const text = FLOWS[flow];
  switch (code) {
    case 'permission_not_held':
      return text.permissionNotHeld;
    case 'account_not_active':
      return text.notActive ?? text.fallback;
    case 'auth_unavailable':
      return text.unchanged
        ? `Der Anmeldedienst ist gerade nicht erreichbar. ${text.unchanged}; bitte versuchen Sie es später noch einmal.`
        : 'Der Anmeldedienst ist gerade nicht erreichbar. Bitte versuchen Sie es später noch einmal.';
    case 'user_not_found':
      return `${AUTH_SERVICE_UNKNOWN_ACCOUNT}${text.unchanged ? ` ${text.unchanged}.` : ''}`;
    default:
      return (code !== undefined && ERROR_TEXT[code]) || text.fallback;
  }
}

/**
 * Was ein offener Aufruf bedeutet (Tickets #47, #48), je `operation`. Ein neuer Aufruf (Zuruecksetzung, #49) traegt hier
 * seinen Satz ein; bis dahin nennt die Ansicht ihn allgemein mit dem Namen.
 */
const OPEN_CALL_TEXT: Record<string, string> = {
  disable_login: 'Das Konto ist hier deaktiviert und kann sich nicht mehr anmelden. Dem Anmeldedienst ist die Deaktivierung aber noch nicht gemeldet.',
  revoke_sessions: 'Alle Sitzungen des Kontos sind hier beendet. Dem Anmeldedienst ist das aber noch nicht gemeldet; bis dahin lehnt die Anwendung jede Anfrage des Kontos ab.'
};

export function openCallText(operation: string): string {
  return OPEN_CALL_TEXT[operation] ?? `Ein Aufruf an den Anmeldedienst (${operation}) ist noch offen.`;
}

/** Was die fachliche Ablehnung des Anmeldedienstes bei einem offenen Aufruf bedeutet (`open_calls[].rejection_code`); andere Codes erscheinen allgemein. */
export function syncRejectionText(code: string): string {
  return code === 'user_not_found' ? AUTH_SERVICE_UNKNOWN_ACCOUNT : `Der Anmeldedienst hat den Abgleich abgelehnt (${code}).`;
}

/** Text, wenn die Lesesicht eines Kontos nicht geladen werden konnte. */
export function loadFailureText(err: unknown): string {
  return errorCode(err) === 'account_not_found' ? ERROR_TEXT.account_not_found : 'Das Konto konnte nicht geladen werden.';
}
