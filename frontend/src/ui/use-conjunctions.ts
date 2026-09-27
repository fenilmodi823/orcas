import { useEffect, useState } from 'react';
import { fetchConjunctions } from '../data/conjunction-client.js';
import type { ConjunctionView } from './conjunction-detail.js';

/**
 * The selected object's conjunctions from the latest screening run, fetched
 * once per selection. Null when nothing is selected. A failed fetch becomes
 * `unavailable` — the panel says so; the scene never waits on it.
 */
export function useConjunctions(noradId: string | null): ConjunctionView | null {
  const [state, setState] = useState<{ noradId: string; view: ConjunctionView } | null>(null);

  useEffect(() => {
    if (noradId === null) return;
    const controller = new AbortController();
    fetchConjunctions(noradId, controller.signal).then(
      (report) => setState({ noradId, view: { kind: 'report', report } }),
      (error: unknown) => {
        if (controller.signal.aborted) return; // a newer selection superseded this one
        console.warn('[conjunctions] unavailable:', error);
        setState({ noradId, view: { kind: 'unavailable' } });
      },
    );
    return () => controller.abort();
  }, [noradId]);

  if (noradId === null) return null;
  return state?.noradId === noradId ? state.view : { kind: 'loading' };
}
