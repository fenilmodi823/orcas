/** The satellites' extent: the GEO ring, km. */
export const SATELLITE_LAYER_RADIUS_KM = 42_164;
/** The Moon trail's extent: the Moon's mean distance, km. */
export const MOON_LAYER_RADIUS_KM = 384_400;

/** B.21: the satellite layers start to fade at ~2 × 10⁶ km, where the GEO ring is ~1.2° across. */
const FADE_START_RAD = SATELLITE_LAYER_RADIUS_KM / 2e6;
/** ...and are gone this many times further out. */
const FADE_SPAN = 4;

/**
 * Opacity, 0–1, for an Earth-centred layer of radius `layerRadiusKm` seen from
 * `camDistKm` from the Earth's centre. A layer fades as it shrinks toward the
 * Earth's pixel: fully drawn until it subtends `FADE_START_RAD`, gone `FADE_SPAN`
 * times further out, linear in log distance between (S4, B.21). One rule for
 * every such layer, so the Moon trail outlasts the satellites by exactly its size.
 */
export function layerFade(layerRadiusKm: number, camDistKm: number): number {
  const startKm = layerRadiusKm / FADE_START_RAD;
  const t = Math.log(camDistKm / startKm) / Math.log(FADE_SPAN);
  return Math.min(1, Math.max(0, 1 - t));
}
