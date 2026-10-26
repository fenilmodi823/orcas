import { useState } from 'react';
import type { Conjunction } from '../data/conjunction-client.js';
import type { CatalogProvenance } from '../data/catalog-provenance.js';
import type { NoradId } from '../data/catalog-types.js';
import type { LiveSceneState } from '../renderer/live/use-live-scene.js';
import { useSelectionStore } from '../state/selection-store.js';
import { effectiveRate, useSimulationStore } from '../state/simulation-store.js';
import { ConjunctionWarning } from '../ui/ConjunctionWarning.js';
import { watchTarget } from '../ui/conjunction-warning.js';
import type { ReplayHandle } from '../ui/ReplayControl.js';
import { useConjunctionWarning } from '../ui/use-conjunction-warning.js';
import type { PendingView } from './use-pending-view.js';
import { useSimulationClock } from './use-simulation-clock.js';
import { goThereView, watchView } from './warning-views.js';

interface Props {
  readonly scene: LiveSceneState;
  readonly provenance: CatalogProvenance;
  readonly replay: ReplayHandle;
  readonly requestView: (view: PendingView, replayAtMs: number) => Promise<boolean>;
}

/** Wires the warning to the clock, the selection and the replay. Owns the 4 Hz clock read, so its re-renders stay here. */
export function SimulationWarning({ scene, provenance, replay, requestView }: Props) {
  const simulationMs = useSimulationClock(scene.loop.frameStateRef, provenance.nowMs).getTime();
  const rate = useSimulationStore((s) => (s.playing ? effectiveRate(s) : 0));
  const selectedNorad = useSelectionStore((s) => s.selectedNorad);
  const setWatchPair = useSelectionStore((s) => s.setWatchPair);
  const { view, dismiss } = useConjunctionWarning(selectedNorad, simulationMs, rate);
  const [failed, setFailed] = useState(false);
  const run = view.kind === 'message' || view.kind === 'idle' ? view.run : null;

  const request = (next: PendingView, onFail?: () => void) => {
    if (!run) return;
    void requestView(next, run.windowStartMs).then((ok) => {
      setFailed(!ok);
      if (!ok) onFail?.();
    });
  };
  const watch = (c: Conjunction) => {
    const { follow, counterpart } = watchTarget(c, selectedNorad);
    setWatchPair({ follow: follow.noradId as NoradId, counterpart: counterpart.noradId as NoradId });
    request(watchView(c, selectedNorad), () => setWatchPair(null));
  };

  return (
    <ConjunctionWarning
      view={view}
      simulationMs={simulationMs}
      wallNowMs={provenance.nowMs}
      onWatch={watch}
      onGoThere={() => {
        if (run) request(goThereView(run, rate));
      }}
      onDismiss={dismiss}
      error={failed ? replay.error : null}
    />
  );
}
