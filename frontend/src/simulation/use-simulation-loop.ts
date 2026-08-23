import { useEffect, useRef, type MutableRefObject } from 'react';
import type { ObjectMeta } from '../data/catalog-types.js';
import { createBrowserPropagationPool } from '../propagation/worker-pool.js';
import { createEmptyRing, rebuildRing, type KeyframeRing } from './keyframe-ring.js';
import { createFrameState, evaluateFrame, type FrameState } from './frame-state.js';
import { stepClock } from './loop.js';
import { epochMsToTicks } from '../time/clock.js';

// ponytail: fixed window for every object, not per-object chooseStepSeconds
// (brief §A.5) — that needs the active-set/LOD data M1.3's renderer owns.
// Upgrade when this hook gets a real active set to read from.
const WINDOW_MS = 30_000;
const MAX_DT_MS = 100; // brief §A.7 step 0: tab-switch clamp
const POOL_SIZE = 2;

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
 *
 * The worker pool AND its "is a build in flight" guard are both created
 * fresh inside the mount effect below, as plain local variables — not
 * `useRef`s. That was a real bug caught in Task 8's live-browser
 * verification: React StrictMode's dev-only mount→cleanup→mount replay
 * runs this effect twice. With the pool and guard as module-external
 * refs (shared across both invocations), the throwaway first pass could
 * start a real `buildSegments` call, get its pool terminated by its own
 * cleanup before that call's promise ever settled, and leave the
 * *shared* "building" ref stuck at `true` forever — permanently
 * blocking the second, surviving pass from ever starting a real build
 * (a killed worker's `postMessage` just goes nowhere; termination isn't
 * an error, so nothing ever rejects to clear the guard either).
 * Scoping `pool` and `building` as locals inside the effect means each
 * invocation — including the replay — owns an entirely independent
 * pool and guard; an orphaned pass can't poison the one that survives.
 */
export function useSimulationLoop(
  objects: readonly ObjectMeta[],
  playingRef: MutableRefObject<boolean>,
  rateRef: MutableRefObject<number>,
  startEpochMs: number,
): SimulationLoopHandle {
  const frameStateRef = useRef<FrameState>(createFrameState(objects.length));
  const ringRef = useRef<KeyframeRing>(createEmptyRing());
  const clockTicksRef = useRef<number>(epochMsToTicks(startEpochMs));
  const lastWallMsRef = useRef<number | null>(null);
  // Always points at the current effect instance's own requestRebuild,
  // so scrubTo (called from outside the effect, after mount) reaches
  // whichever pass is actually alive rather than a discarded one.
  const requestRebuildRef = useRef<(epochMs: number) => void>(() => {});

  useEffect(() => {
    const pool = createBrowserPropagationPool(POOL_SIZE);
    let building = false;

    function requestRebuild(epochMs: number) {
      if (building) return;
      building = true;
      void rebuildRing(ringRef.current, pool, objects, epochMs, epochMs + WINDOW_MS).then((result) => {
        ringRef.current = result.ring;
        building = false;
      });
    }
    requestRebuildRef.current = requestRebuild;

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
    return () => {
      cancelAnimationFrame(frameId);
      pool.terminate();
    };
    // Runs once per mount: objects are stable for the debug route's
    // lifetime, and re-running this effect on every render would reset
    // the clock — the standard "intentional empty deps" rAF-loop pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    frameStateRef,
    ringRef,
    scrubTo(epochMs: number) {
      clockTicksRef.current = epochMsToTicks(epochMs);
      requestRebuildRef.current(epochMs);
    },
  };
}
