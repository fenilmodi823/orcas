import { Color } from 'three';
import { Regime } from '../../data/catalog-types.js';

/**
 * The orbit-regime palette (P4.D24), read from styles/tokens.css so the
 * scene and the CSS never drift — the same contract as
 * renderer/scene-colors.ts. The hex fallbacks are each token's own
 * current value, for a headless/JSDOM context with no stylesheet
 * attached; they are not a second source of truth.
 *
 * By REGIME, not object type (brief §13.4.1) — a debris object still
 * renders in its own orbit's regime colour here. The separate `--debris`
 * grey is for the debris *visibility toggle* (P4.D25, still blocked on
 * the SATCAT ingest), not a recolour of every debris object at rest.
 *
 * Unknown has no token — it falls back to the same neutral grey as
 * `--debris`, the "no clear classification" colour.
 */
const REGIME_VAR: Record<Regime, string> = {
  [Regime.LEO]: '--leo',
  [Regime.MEO]: '--meo',
  [Regime.GEO]: '--geo',
  [Regime.HEO]: '--heo',
  [Regime.Unknown]: '',
};

const REGIME_FALLBACK: Record<Regime, string> = {
  [Regime.LEO]: '#4d9fff',
  [Regime.MEO]: '#3dd68c',
  [Regime.GEO]: '#ffb020',
  [Regime.HEO]: '#b57bff',
  [Regime.Unknown]: '#8a93a6',
};

export function readRegimeColor(regime: Regime): Color {
  const name = REGIME_VAR[regime];
  const fromToken = name
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : '';
  return new Color(fromToken || REGIME_FALLBACK[regime]);
}
