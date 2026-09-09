/**
 * GPU device-tier detection for M1.8 performance hardening (brief §G.1).
 *
 * Nothing consumes this yet — a later task wires it into the renderer's
 * quality ladder. `classifyRenderer` is the pure, testable core;
 * `detectDeviceTier` is the DOM-touching, once-per-session entry point.
 */

export type DeviceTier = 'A' | 'B' | 'C';

/**
 * Discrete desktop GPUs. Checked before Tier B and before the default so
 * `radeon rx` claims Tier A ahead of any bare `radeon` reading (there is no
 * bare-`radeon` rule today, but the ordering keeps that safe by construction).
 *
 * Intel Arc is deliberately absent: no substring reliably matches a real Arc
 * renderer string, and §G.1's Tier A anchors are Nvidia/AMD discrete only.
 * Arc falls through to Tier C (the safe default) until real hardware is
 * available to write a tested pattern against.
 */
const TIER_A_PATTERNS = [
  'nvidia',
  'geforce',
  'rtx',
  'gtx',
  'radeon rx',
  'radeon pro',
  'radeon(tm) rx',
];

/** Apple Silicon only, by explicit generation. */
const TIER_B_PATTERNS = ['apple m1', 'apple m2', 'apple m3', 'apple m4'];

/**
 * Classify a GPU from its `WEBGL_debug_renderer_info` UNMASKED_RENDERER string
 * (brief §G.1). Pure, case-insensitive substring match. Anything not clearly A
 * or B is C — the brief says develop on Tier C, and an unknown integrated part
 * is far more likely to be C than A.
 *
 * ponytail: UNMASKED_RENDERER string match only. §G.1 also names "a 200 ms
 * boot benchmark" — not built here. Add it only if the string heuristic proves
 * too coarse in practice (a real GPU landing in the wrong tier); a benchmark
 * costs a boot-time frame hitch and needs calibration against real hardware.
 */
export function classifyRenderer(unmaskedRenderer: string): DeviceTier {
  const s = unmaskedRenderer.toLowerCase();
  if (TIER_A_PATTERNS.some((p) => s.includes(p))) return 'A';
  if (TIER_B_PATTERNS.some((p) => s.includes(p))) return 'B';
  // `apple` + `gpu` catches `Apple M2 GPU`-style strings that name no
  // explicit generation. Apple only — never a generic "GPU" match.
  if (s.includes('apple') && s.includes('gpu')) return 'B';
  return 'C';
}

const OVERRIDE_TIERS: readonly DeviceTier[] = ['A', 'B', 'C'];

/** `?tier=A|B|C` (any case) — same boot-flag pattern as `?perf=1`. */
function readTierOverride(): DeviceTier | undefined {
  try {
    const raw = new URLSearchParams(window.location.search).get('tier');
    const upper = raw?.toUpperCase();
    return OVERRIDE_TIERS.find((t) => t === upper);
  } catch {
    return undefined;
  }
}

/**
 * Spin up a throwaway WebGL2 context, read UNMASKED_RENDERER, classify it.
 * No context, no debug-renderer extension, an unreadable string, or any thrown
 * error (a locked-down browser can throw) → 'C' (brief §G.1).
 */
function probeGpuTier(): DeviceTier {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'C';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return 'C';
    const renderer: unknown = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    const tier =
      typeof renderer === 'string' && renderer.length > 0
        ? classifyRenderer(renderer)
        : 'C';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return tier;
  } catch {
    return 'C';
  }
}

let cached: DeviceTier | undefined;

/**
 * The device tier for this session. `?tier=` overrides the heuristic. The GPU
 * string is read and classified at most once per session — the result is
 * memoised at module level.
 */
export function detectDeviceTier(): DeviceTier {
  if (cached === undefined) {
    cached = readTierOverride() ?? probeGpuTier();
  }
  return cached;
}
