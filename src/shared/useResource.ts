import { useCallback, useEffect, useState } from 'react';

export interface Resource<T, A extends string> {
  /** Die geladenen Daten; `null`, solange noch nichts geladen ist (auch nach einem Ladefehler ohne frueheren Stand). */
  data: T | null;
  loadError: boolean;
  /** Laedt neu und setzt den Ladefehler zurueck. */
  reload: () => Promise<void>;
  /** Laeuft gerade ein Schreibzugriff (`run`)? Die Seite sperrt dann ihre Schaltflaechen. */
  busy: boolean;
  /** Erfolgsmeldung des letzten Schreibzugriffs (`role="status"`). */
  notice: string | null;
  /** Fehlertext des letzten Schreibzugriffs (`role="alert"`). */
  error: string | null;
  /**
   * Fuehrt einen Schreibzugriff aus: raeumt alte Meldungen weg, meldet bei Erfolg den Text, den `write` liefert, sonst den
   * Fehlertext der Aktion und laedt danach immer neu (die Liste kann sich inzwischen geaendert haben). Liefert, ob er gelang.
   */
  run: (action: A, write: () => Promise<string>) => Promise<boolean>;
  clearMessages: () => void;
}

/**
 * Das Muster der Listenseiten: laden, Ladefehler mit „Erneut laden“, Schreibzugriffe mit busy, Erfolgsmeldung und Fehlertext.
 * `fetch` muss stabil sein (per `useCallback`); aendert sich seine Identitaet, wird neu geladen. `describeFailure` uebersetzt
 * den Fehler eines Schreibzugriffs (`describe…Failure` der Seite); eine Seite, die nur liest, braucht ihn nicht.
 */
export function useResource<T, A extends string = string>(
  fetch: () => Promise<T>,
  describeFailure: (err: unknown, action: A) => string = () => 'Die Aktion ist fehlgeschlagen. Bitte versuchen Sie es erneut.'
): Resource<T, A> {
  const [data, setData] = useState<T | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoadError(false);
    try {
      setData(await fetch());
    } catch {
      setLoadError(true);
    }
  }, [fetch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const clearMessages = useCallback(() => {
    setNotice(null);
    setError(null);
  }, []);

  const run = async (action: A, write: () => Promise<string>): Promise<boolean> => {
    setBusy(true);
    clearMessages();
    let ok = false;
    try {
      setNotice(await write());
      ok = true;
    } catch (err) {
      setError(describeFailure(err, action));
    } finally {
      setBusy(false);
    }
    await reload();
    return ok;
  };

  return { data, loadError, reload, busy, notice, error, run, clearMessages };
}
