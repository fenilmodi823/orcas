import { Color } from 'three';
import { OrbitClass } from '../../data/catalog-types.js';

/**
 * The orbit-class palette (P4.D24), read from styles/tokens.css so the
 * scene and the CSS never drift — the same contract as
 * renderer/scene-colors.ts. The hex fallbacks are each token's own
 * current value, for a headless/JSDOM context with no stylesheet
 * attached; they are not a second source of truth.
 *
 * By ORBIT CLASS, not object type (brief §13.4.1) — a debris object still
 * renders in its own orbit's class colour here. The separate `--debris`
 * grey is for the debris *visibility toggle* (P4.D25, still blocked on
 * the SATCAT ingest), not a recolour of every debris object at rest.
 *
 * Unknown has no token — it falls back to the same neutral grey as
 * `--debris`, the "no clear classification" colour.
 */
const ORBIT_CLASS_VAR: Record<OrbitClass, string> = {
  [OrbitClass.LEO]: '--leo',
  [OrbitClass.MEO]: '--meo',
  [OrbitClass.GEO]: '--geo',
  [OrbitClass.HEO]: '--heo',
  [OrbitClass.Unknown]: '',
};

const ORBIT_CLASS_FALLBACK: Record<OrbitClass, string> = {
  [OrbitClass.LEO]: '#4d9fff',
  [OrbitClass.MEO]: '#3dd68c',
  [OrbitClass.GEO]: '#ffb020',
  [OrbitClass.HEO]: '#b57bff',
  [OrbitClass.Unknown]: '#8a93a6',
};

export function readOrbitClassColor(orbitClass: OrbitClass): Color {
  const name = ORBIT_CLASS_VAR[orbitClass];
  const fromToken = name
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : '';
  return new Color(fromToken || ORBIT_CLASS_FALLBACK[orbitClass]);
}
