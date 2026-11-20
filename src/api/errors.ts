/** Fehlercode der API (`{error, code}`) aus einem fehlgeschlagenen Axios-Aufruf; `undefined` ohne Antwort oder Code. */
export function errorCode(err: unknown): string | undefined {
  const code = (err as { response?: { data?: { code?: unknown } } } | null | undefined)?.response?.data?.code;
  return typeof code === 'string' ? code : undefined;
}

/** Grund (`reason`) einer Fehlerantwort, etwa bei `account_inactive` / `account_disabled`; `undefined` ohne Antwort oder Grund. */
export function errorReason(err: unknown): string | undefined {
  const reason = (err as { response?: { data?: { reason?: unknown } } } | null | undefined)?.response?.data?.reason;
  return typeof reason === 'string' ? reason : undefined;
}

/** Texte einer Fehlerbehandlung: je Fehlercode der API und, wenn kein Code passt, je Aktion ein allgemeiner Text. */
export interface FailureTexts<A extends string> {
  codes: Record<string, string>;
  fallback: Record<A, string>;
  /**
   * Bei einem unbekannten Code mit diesem HTTP-Status zeigt die Seite die Meldung der API selbst (der Einwand eines
   * anderen Moduls kommt mit eigenem Code und deutscher Meldung).
   */
  showApiMessageOnStatus?: number;
}

/**
 * Verstaendlicher Text zu einer abgelehnten Anfrage: der Text zum Fehlercode, sonst auf Wunsch die Meldung der API, sonst der
 * allgemeine Text der Aktion. Das eine Muster hinter den `describe…Failure` der Seiten.
 */
export function describeFailure<A extends string>(err: unknown, action: A, texts: FailureTexts<A>): string {
  const code = errorCode(err);
  if (code !== undefined && Object.prototype.hasOwnProperty.call(texts.codes, code)) {
    return texts.codes[code];
  }
  if (texts.showApiMessageOnStatus !== undefined) {
    const response = (err as { response?: { status?: unknown; data?: { error?: unknown } } } | null | undefined)?.response;
    if (response?.status === texts.showApiMessageOnStatus && typeof response.data?.error === 'string' && response.data.error !== '') {
      return response.data.error;
    }
  }
  return texts.fallback[action];
}
