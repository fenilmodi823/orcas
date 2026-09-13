import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { detectDeviceTier } from '../device/device-tier.js';
import { createGpuTimer, createWebgl2QueryContext, type GpuTimer } from '../perf/gpu-timer.js';

const FRAME_BUDGET_MS = 1000 / 60;

export interface PerfRefs {
  readonly frameMsRef: MutableRefObject<number>;
  readonly drawCallsRef: MutableRefObject<number>;
  readonly trianglesRef: MutableRefObject<number>;
  /** JS-side time NOT spent submitting the render call — camera math, geometry
   * uploads, everything else this frame's other useFrame callbacks did. */
  readonly jsMsRef: MutableRefObject<number>;
  /** Actual GPU execution time for the frame's draw calls (RA-9/Q9.2), via
   * EXT_disjoint_timer_query_webgl2. -1 when the extension is unsupported —
   * PerfHud shows "n/a" rather than a misleading zero. Arrives a frame or
   * two late (GPU queries are async); that lag is invisible on a debug HUD. */
  readonly gpuMsRef: MutableRefObject<number>;
}

/**
 * M1.8 (Phase-4-Engineering-Brief §G.8) — frame time, draw calls, triangles,
 * plus the CPU/GPU split Q9.2 asked for before GPU-side Hermite is built.
 * Runs inside the Canvas (needs useThree/useFrame): reads three.js's own
 * `renderer.info.render` (reset automatically before every `render()` call,
 * so it always reflects exactly the frame just drawn) and R3F's own
 * per-tick `delta`, writing everything into refs for PerfHud to display
 * outside the Canvas. Never touches React state — Rules.md bans per-frame
 * setState.
 *
 * ⚠️ Claims R3F's render priority (the third `useFrame` argument) to
 * bracket the actual `gl.render()` call with the GPU timer query and a
 * `performance.now()` pair — R3F only auto-renders when nothing else has
 * claimed priority, so this probe must call `gl.render()` itself once it
 * does. Only mounted when `?perf=1` is set (PointsDebug.tsx), so normal
 * play never takes this path.
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
export function PerfProbe({ frameMsRef, drawCallsRef, trianglesRef, jsMsRef, gpuMsRef }: PerfRefs) {
  const { gl, scene, camera } = useThree();
  const gpuTimerRef = useRef<GpuTimer | null>(null);
  const gpuSupportedRef = useRef(true);

  useEffect(() => {
    const ctx = createWebgl2QueryContext(gl.getContext() as WebGL2RenderingContext);
    gpuSupportedRef.current = ctx !== null;
    gpuTimerRef.current = ctx ? createGpuTimer(ctx) : null;
    if (!ctx) gpuMsRef.current = -1;
  }, [gl, gpuMsRef]);

  useFrame((_state, delta) => {
    const jsStart = performance.now();
    gpuTimerRef.current?.begin();
    gl.render(scene, camera);
    gpuTimerRef.current?.end();
    const renderCallMs = performance.now() - jsStart;
    const frameMs = delta * 1000;
    // "JS" here means everything OTHER than submitting this render call —
    // the other useFrame callbacks (camera math, geometry uploads, SGP4
    // eval) that ran earlier this frame. Q9.2 wants this compared against
    // gpuMsRef, not against renderCallMs itself (submission is normally a
    // small fraction of either).
    jsMsRef.current = Math.max(0, frameMs - renderCallMs);

    frameMsRef.current = frameMs;
    drawCallsRef.current = gl.info.render.calls;
    trianglesRef.current = gl.info.render.triangles;

    const gpuSample = gpuTimerRef.current?.poll();
    if (gpuSample != null) gpuMsRef.current = gpuSample;
    else if (!gpuSupportedRef.current) gpuMsRef.current = -1;
  }, 1);

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
export function PerfHud({ frameMsRef, drawCallsRef, trianglesRef, jsMsRef, gpuMsRef }: PerfRefs) {
  const nodeRef = useRef<HTMLParagraphElement>(null);
  const [tier] = useState(detectDeviceTier);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const node = nodeRef.current;
      if (node) {
        const frameMs = frameMsRef.current;
        const gpuMs = gpuMsRef.current;
        const gpuText = gpuMs < 0 ? 'n/a' : `${gpuMs.toFixed(1)} ms`;
        node.textContent = `frame ${frameMs.toFixed(1)} ms (budget ${FRAME_BUDGET_MS.toFixed(1)}) · js ${jsMsRef.current.toFixed(1)} ms · gpu ${gpuText} · draws ${drawCallsRef.current} · tris ${trianglesRef.current.toLocaleString()} · tier ${tier}`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frameMsRef, drawCallsRef, trianglesRef, jsMsRef, gpuMsRef, tier]);

  return <p ref={nodeRef} className="points-debug__count" />;
}
