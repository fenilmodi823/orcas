import { Color } from 'three';
import { Regime } from '../../data/catalog-types.js';

/**
 * The orbit-class palette (P4.D24), read from styles/tokens.css so the
 * scene and the CSS never drift — the same contract as
 * renderer/scene-colors.ts. The hex fallbacks are each token's own
 * current value, for a headless/JSDOM context with no stylesheet
 * attached; they are not a second source of truth.
 *
 * ⚠️ Today `--leo` === `--orca-cyan` (#00e5ff), so a LEO path and the
 * selected-object accent are the same colour. M1.7c updates the token to
 * a distinct azure; this module then follows with no change here.
 *
 * Unknown has no token — it gets a neutral grey until M1.7c's legend
 * work defines the debris/unknown colour properly.
 */
const REGIME_VAR: Record<Regime, string> = {
  [Regime.LEO]: '--leo',
  [Regime.MEO]: '--meo',
  [Regime.GEO]: '--geo',
  [Regime.HEO]: '--heo',
  [Regime.Unknown]: '',
};

const REGIME_FALLBACK: Record<Regime, string> = {
  [Regime.LEO]: '#00e5ff',
  [Regime.MEO]: '#a78bfa',
  [Regime.GEO]: '#ffb020',
  [Regime.HEO]: '#ff7ab6',
  [Regime.Unknown]: '#8a94a6',
};

export function readRegimeColor(regime: Regime): Color {
  const name = REGIME_VAR[regime];
  const fromToken = name
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : '';
  return new Color(fromToken || REGIME_FALLBACK[regime]);
}
