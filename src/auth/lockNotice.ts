import { errorCode, errorReason } from '../api/errors';

/** Texte laut ADR 0002 B2 (Nachtrag Klaerung zu Ticket #12). */
const LOCKED_BY_ADMINISTRATION = 'Ihr Konto wurde von der Verwaltung gesperrt. Bitte wenden Sie sich an Ihre Schule.';
const LOCKED = 'Ihr Konto ist gesperrt.';

/** Hinweis zum Sperrgrund; nur `admin_locked` kennt eine Handlungsanweisung, jeder andere oder fehlende Grund bleibt allgemein. */
export function lockNotice(reason: string | null | undefined): string {
  return reason === 'admin_locked' ? LOCKED_BY_ADMINISTRATION : LOCKED;
}

/** Sperrhinweis fuer eine Fehlerantwort des Anmeldedienstes (`code: account_disabled`); `undefined`, wenn der Fehler keine Sperre meldet. */
export function loginLockNotice(err: unknown): string | undefined {
  return errorCode(err) === 'account_disabled' ? lockNotice(errorReason(err)) : undefined;
}
