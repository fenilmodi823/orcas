import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

const FRAME_BUDGET_MS = 1000 / 60;

export interface PerfRefs {
  readonly frameMsRef: MutableRefObject<number>;
  readonly drawCallsRef: MutableRefObject<number>;
  readonly trianglesRef: MutableRefObject<number>;
}

/**
 * M1.8 (Phase-4-Engineering-Brief §G.8) — lean v1: frame time, draw calls,
 * triangles only. Runs inside the Canvas (needs useThree/useFrame): reads
 * three.js's own `renderer.info.render` (reset automatically before every
 * `render()` call, so it always reflects exactly the frame just drawn)
 * and R3F's own per-tick `delta`, writing both into refs for PerfHud to
 * display outside the Canvas. Never touches React state — Rules.md bans
 * per-frame setState.
 *
 * GPU texture memory (also in §G.8's mockup) is deliberately not here yet:
 * three.js's `info.memory` only counts textures, not bytes, and /points
 * doesn't load any textures today (Earth is a flat-colour material — the
 * KTX2 pipeline is P2, still deferred). Nothing real to measure until
 * then. The eval/camera/vis/upload/pick per-phase breakdown, segment
 * status, and snapshot staleness rows are also deferred — building them
 * means threading performance.now() timers through the camera
 * controller, picking, and every render component, a much larger change
 * than this HUD; add them if a specific optimization needs that detail.
 */
export function PerfProbe({ frameMsRef, drawCallsRef, trianglesRef }: PerfRefs) {
  const { gl } = useThree();
  useFrame((_state, delta) => {
    frameMsRef.current = delta * 1000;
    drawCallsRef.current = gl.info.render.calls;
    trianglesRef.current = gl.info.render.triangles;
  });
  return null;
}

/**
 * Mirrors PerfProbe's refs into a DOM readout via its own rAF loop — same
 * contract Tier1Readout uses, for the same reason (a state-driven readout
 * would need to poll on an interval, and Rules.md bans per-frame setState
 * outright). Rendered as one more line inside the existing debug panel
 * (next to Tier1Readout) rather than its own floating overlay: every
 * screen corner is already claimed by another panel, and a standalone
 * overlay's real reason to exist — working on the future minimal-chrome
 * /simulation route, where this debug panel won't be mounted — doesn't
 * apply until that route exists (M1.9).
 */
export function PerfHud({ frameMsRef, drawCallsRef, trianglesRef }: PerfRefs) {
  const nodeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const node = nodeRef.current;
      if (node) {
        const frameMs = frameMsRef.current;
        node.textContent = `frame ${frameMs.toFixed(1)} ms (budget ${FRAME_BUDGET_MS.toFixed(1)}) · draws ${drawCallsRef.current} · tris ${trianglesRef.current.toLocaleString()}`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frameMsRef, drawCallsRef, trianglesRef]);

  return <p ref={nodeRef} className="points-debug__count" />;
}
