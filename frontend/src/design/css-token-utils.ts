/**
 * Reads the RGB channels out of tokens.css's own --glass-fill at runtime, so
 * the live control strip can vary alpha without duplicating the token's
 * colour as a literal (tokens.css is settled this phase — Rules.md hard ban
 * on colour literals still applies to this route's own code).
 */
export function readGlassFillRgb(): readonly [number, number, number] {
  if (typeof window === 'undefined') return [12, 20, 34];
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--glass-fill').trim();
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(raw);
  if (!match) return [12, 20, 34];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
