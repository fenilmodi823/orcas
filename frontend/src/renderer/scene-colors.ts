import { Color } from 'three';

/**
 * The `--orca-cyan` design token as a `three` Color. Lives here rather
 * than inside TierZeroPoints.tsx because Tier 0 and Tier 1 must tint from
 * the same token — a second reader is how a palette drifts, and Rules.md
 * bans colour literals outside styles/tokens.css.
 *
 * The `#00E5FF` fallback covers a headless/JSDOM context where no
 * stylesheet is attached; it is the token's own value, not a second
 * source of truth.
 */
export function readCyanToken(): Color {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--orca-cyan').trim();
  return new Color(hex || '#00E5FF');
}
