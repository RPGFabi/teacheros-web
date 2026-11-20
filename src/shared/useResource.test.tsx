import { useCallback } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useResource } from './useResource';

const describeFailure = (err: unknown, action: 'save' | 'drop') => `${action} fehlgeschlagen: ${(err as Error).message}`;

/** Eine Ladefunktion mit stabiler Identitaet je Eingabe, wie sie die Seiten per useCallback bauen. */
function useLoader(q: string) {
  return useCallback(() => Promise.resolve([q]), [q]);
}

describe('useResource', () => {
  it('laedt beim Einhaengen und liefert die Daten', async () => {
    const fetch = vi.fn().mockResolvedValue(['a', 'b']);
    const { result } = renderHook(() => useResource(fetch, describeFailure));

    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data).toEqual(['a', 'b']));
    expect(result.current.loadError).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('meldet einen Ladefehler und laedt mit reload erneut', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('weg')).mockResolvedValue(['a']);
    const { result } = renderHook(() => useResource(fetch, describeFailure));

    await waitFor(() => expect(result.current.loadError).toBe(true));
    expect(result.current.data).toBeNull();

    await act(() => result.current.reload());

    expect(result.current.loadError).toBe(false);
    expect(result.current.data).toEqual(['a']);
  });

  it('laedt neu, wenn sich die Ladefunktion aendert', async () => {
    const { result, rerender } = renderHook(({ q }) => useResource(useLoader(q), describeFailure), { initialProps: { q: 'x' } });
    await waitFor(() => expect(result.current.data).toEqual(['x']));

    rerender({ q: 'y' });

    await waitFor(() => expect(result.current.data).toEqual(['y']));
  });

  it('run: meldet den Erfolg, laedt neu und liefert true', async () => {
    let value = 'alt';
    const { result } = renderHook(() => useResource(() => Promise.resolve(value), describeFailure));
    await waitFor(() => expect(result.current.data).toBe('alt'));

    let ok = false;
    await act(async () => {
      ok = await result.current.run('save', async () => {
        value = 'neu';
        return 'Gespeichert.';
      });
    });

    expect(ok).toBe(true);
    expect(result.current.notice).toBe('Gespeichert.');
    expect(result.current.error).toBeNull();
    expect(result.current.busy).toBe(false);
    expect(result.current.data).toBe('neu');
  });

  it('run: uebersetzt den Fehler mit der Aktion, laedt trotzdem neu und liefert false', async () => {
    const fetch = vi.fn().mockResolvedValue('stand');
    const { result } = renderHook(() => useResource(fetch, describeFailure));
    await waitFor(() => expect(result.current.data).toBe('stand'));

    let ok = true;
    await act(async () => {
      ok = await result.current.run('drop', () => Promise.reject(new Error('nein')));
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('drop fehlgeschlagen: nein');
    expect(result.current.notice).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('run: ist waehrenddessen busy und raeumt alte Meldungen weg', async () => {
    const { result } = renderHook(() => useResource(() => Promise.resolve(1), describeFailure));
    await waitFor(() => expect(result.current.data).toBe(1));
    await act(() => result.current.run('save', async () => 'Erste Meldung.'));
    expect(result.current.notice).toBe('Erste Meldung.');

    let release: () => void = () => undefined;
    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.run(
        'save',
        () =>
          new Promise<string>((resolve) => {
            release = () => resolve('Zweite Meldung.');
          })
      );
    });

    await waitFor(() => expect(result.current.busy).toBe(true));
    expect(result.current.notice).toBeNull();
    await act(async () => {
      release();
      await pending;
    });
    expect(result.current.busy).toBe(false);
    expect(result.current.notice).toBe('Zweite Meldung.');
  });

  it('clearMessages raeumt Meldung und Fehler weg', async () => {
    const { result } = renderHook(() => useResource(() => Promise.resolve(1), describeFailure));
    await waitFor(() => expect(result.current.data).toBe(1));
    await act(() => result.current.run('drop', () => Promise.reject(new Error('x'))));
    expect(result.current.error).not.toBeNull();

    act(() => result.current.clearMessages());

    expect(result.current.error).toBeNull();
    expect(result.current.notice).toBeNull();
  });
});
