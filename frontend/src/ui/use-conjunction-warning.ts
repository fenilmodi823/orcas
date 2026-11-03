import { useEffect, useMemo, useState } from 'react';
import { useWarningStore } from '../state/warning-store.js';
import {
  fetchTopConjunctions, type Conjunction, type ConjunctionReport, type ScreeningRun,
} from '../data/conjunction-client.js';
import { useConjunctions } from './use-conjunctions.js';
import { pickWarning, warningCandidates, warningKey, type WarningPick } from './conjunction-warning.js';

export type WarningView =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'not-screened' }
  | { readonly kind: 'idle'; readonly run: ScreeningRun; readonly selectionCovered: boolean; readonly top: readonly Conjunction[] }
  | { readonly kind: 'message'; readonly run: ScreeningRun; readonly pick: WarningPick };

type TopState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'report'; readonly report: ConjunctionReport };

const EMPTY: readonly Conjunction[] = [];

/**
 * The close-approach warning's state (conjunction-alert spec §3). The top 10
 * are fetched once; the selected object's list comes from the panel's own
 * hook (a second request, served from the backend's 60 s cache — ponytail:
 * share the fetch only if it ever shows in the network panel). Time arrives
 * from the caller's 4 Hz display clock, never per frame.
 */
export function useConjunctionWarning(
  selectedNorad: string | null,
  simulationMs: number,
  rate: number,
): { readonly view: WarningView; readonly dismiss: (key: string) => void } {
  const [top, setTop] = useState<TopState>({ kind: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    fetchTopConjunctions(controller.signal).then(
      (report) => setTop({ kind: 'report', report }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn('[conjunction-warning] top conjunctions unavailable:', error);
        setTop({ kind: 'unavailable' });
      },
    );
    return () => controller.abort();
  }, []);

  const selected = useConjunctions(selectedNorad);
  const topItems = top.kind === 'report' ? top.report.items : EMPTY;
  const selectedItems = selected?.kind === 'report' ? selected.report.items : EMPTY;
  const candidates = useMemo(() => warningCandidates(topItems, selectedItems), [topItems, selectedItems]);

  // Dismissals live in state/, so a replay remount (Watch, Go there) keeps them.
  const dismissed = useWarningStore((s) => s.dismissed);
  const dismiss = useWarningStore((s) => s.dismiss);
  const [shownKey, setShownKey] = useState<string | null>(null);
  const pick = pickWarning({ candidates, nowMs: simulationMs, rate, dismissed, shownKey });
  const pickKey = pick ? warningKey(pick.conjunction) : null;
  // React's "information from previous renders" pattern; settles in one
  // extra render because a due pass never depends on shownKey.
  if (pickKey !== shownKey) setShownKey(pickKey);

  let view: WarningView;
  if (top.kind !== 'report') view = top;
  else if (top.report.run === null) view = { kind: 'not-screened' };
  else if (pick) view = { kind: 'message', run: top.report.run, pick };
  else view = { kind: 'idle', run: top.report.run, selectionCovered: selectedNorad !== null && selected?.kind === 'report', top: top.report.items };
  return { view, dismiss };
}
