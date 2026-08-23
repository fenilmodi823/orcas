import { useEffect, useRef, type MutableRefObject } from 'react';
import type { ObjectMeta } from '../data/catalog-types.js';
import type { PropagationPool } from '../propagation/worker-pool.js';
import { createEmptyRing, rebuildRing, type KeyframeRing } from './keyframe-ring.js';
import { createFrameState, evaluateFrame, type FrameState } from './frame-state.js';
import { stepClock } from './loop.js';
import { epochMsToTicks } from '../time/clock.js';

// ponytail: fixed window for every object, not per-object chooseStepSeconds
// (brief §A.5) — that needs the active-set/LOD data M1.3's renderer owns.
// Upgrade when this hook gets a real active set to read from.
const WINDOW_MS = 30_000;
const MAX_DT_MS = 100; // brief §A.7 step 0: tab-switch clamp

export interface SimulationLoopHandle {
  readonly frameStateRef: MutableRefObject<FrameState>;
  readonly ringRef: MutableRefObject<KeyframeRing>;
  scrubTo(epochMs: number): void;
}

/**
 * Owns the Tier-3 clock/ring/frame-state and runs the rAF loop (brief
 * §A.7). Never calls `setState` per frame (Rules.md's hard ban) — a
 * caller that needs a live display polls `frameStateRef`/`ringRef` on
 * its own throttled interval, matching `TelemetryReadout`'s existing
 * ≤10Hz pattern elsewhere in this codebase.
 */
export function useSimulationLoop(
  objects: readonly ObjectMeta[],
  pool: PropagationPool,
  playingRef: MutableRefObject<boolean>,
  rateRef: MutableRefObject<number>,
  startEpochMs: number,
): SimulationLoopHandle {
  const frameStateRef = useRef<FrameState>(createFrameState(objects.length));
  const ringRef = useRef<KeyframeRing>(createEmptyRing());
  const clockTicksRef = useRef<number>(epochMsToTicks(startEpochMs));
  const buildingRef = useRef<boolean>(false);
  const lastWallMsRef = useRef<number | null>(null);

  function requestRebuild(epochMs: number) {
    if (buildingRef.current) return;
    buildingRef.current = true;
    void rebuildRing(ringRef.current, pool, objects, epochMs, epochMs + WINDOW_MS).then((result) => {
      ringRef.current = result.ring;
      buildingRef.current = false;
    });
  }

  useEffect(() => {
    requestRebuild(startEpochMs);
    let frameId: number;

    function tick(wallMs: number) {
      const lastWallMs = lastWallMsRef.current;
      lastWallMsRef.current = wallMs;
      const dtMs = lastWallMs === null ? 0 : Math.min(wallMs - lastWallMs, MAX_DT_MS);

      const rate = playingRef.current ? rateRef.current : 0;
      const result = stepClock(clockTicksRef.current, dtMs, rate, ringRef.current);
      clockTicksRef.current = result.clockTicks;
      if (result.needsRebuild) requestRebuild(result.epochMs);

      evaluateFrame(frameStateRef.current, ringRef.current, objects, result.epochMs);
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
    // Runs once per mount: objects/pool are stable for the debug route's
    // lifetime, and re-running this effect on every render would reset
    // the clock — the standard "intentional empty deps" rAF-loop pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    frameStateRef,
    ringRef,
    scrubTo(epochMs: number) {
      clockTicksRef.current = epochMsToTicks(epochMs);
      requestRebuild(epochMs);
    },
  };
}
