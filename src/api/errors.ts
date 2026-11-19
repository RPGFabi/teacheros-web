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
