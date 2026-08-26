/**
 * The Tier 0 apparent-size/brightness law (brief §B.3). Mirrors exactly
 * what the vertex shader in TierZeroPoints.tsx computes in GLSL — this
 * function exists so the formula is unit-testable without a GPU
 * (M1.3-Explained.md §6.2's convention) and so the /points debug route
 * can show an "expected" value per cross-checked object.
 *
 * All distances/radii in km. `pixelsPerRadian` is screen pixels per
 * radian of vertical field of view at the current viewport height.
 */
export function computePointShading(
  radiusKm: number,
  distanceKm: number,
  pixelsPerRadian: number,
  minPointPx: number,
  baseBrightness: number,
  floorBrightness: number,
): { drawPx: number; brightness: number } {
  const truePx = (radiusKm * pixelsPerRadian) / distanceKm;
  const drawPx = Math.max(truePx, minPointPx);
  const areaRatio = Math.min(1, (truePx * truePx) / (drawPx * drawPx));
  const brightness = Math.max(baseBrightness * areaRatio, floorBrightness);
  return { drawPx, brightness };
}
