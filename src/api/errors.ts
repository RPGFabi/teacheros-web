/** Fehlercode der API (`{error, code}`) aus einem fehlgeschlagenen Axios-Aufruf; `undefined` ohne Antwort oder Code. */
export function errorCode(err: unknown): string | undefined {
  const code = (err as { response?: { data?: { code?: unknown } } } | null | undefined)?.response?.data?.code;
  return typeof code === 'string' ? code : undefined;
}
