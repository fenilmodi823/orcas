const R_EARTH_A_KM = 6378.137;
const R_GEO_KM = 42164;
const NEAR_FLOOR_KM = 0.001; // 1 m
const FAR_MULT = 2.2;
/** Lunar apogee (~406,700 km) plus the Moon's radius, rounded up (M1.11). */
const MOON_REACH_KM = 410_000;

/**
 * Per-frame near/far for a SINGLE render pass — the reduction of brief §C.7.
 *
 * §C.7 has three variants: reversed-Z single-pass, a 3-band multi-camera
 * fallback, and a per-frame MID-band formula whose near term is
 * `max(nearFloor, (dCam − R_earth)·0.5)`. That MID-band term assumes the
 * focused object is drawn in a SEPARATE NEAR band; without the band split
 * it would clip a satellite the camera is 0.45 km from. M1.6 is single
 * pass, so the near plane is driven purely by the nearest thing actually
 * being rendered. The full banded / reversed-Z pipeline is deferred with
 * the rest of §C.7 — at /points scale the only depth-adjacent pair is
 * Earth (far) vs. points / the focused object (near), which never z-fight.
 *
 *   near = max(1 m, 0.5 · nearest rendered surface)
 *   far  = max((camDist + R_earth, R_GEO) · 2.2,  camDist + Moon reach)
 *
 * The Moon term (M1.11) makes far ~10x larger, which costs almost nothing:
 * depth precision is set by near, and the Canvas uses a reversed float depth
 * buffer where the hardware supports it (P7.D2).
 *
 * Recompute every frame AFTER the camera is final and BEFORE anything is
 * uploaded. Never recompute it after picking — a mismatch between the pick
 * pass's projection and the render pass's projection produces off-by-a-few-
 * pixels hover errors that are maddening to track down (brief §C.7).
 */
export function computeNearFarKm(
  nearestRenderedSurfaceKm: number,
  camDistToEarthCentreKm: number,
): { nearKm: number; farKm: number } {
  const nearKm = Math.max(NEAR_FLOOR_KM, 0.5 * nearestRenderedSurfaceKm);
  const farKm = Math.max(
    Math.max(camDistToEarthCentreKm + R_EARTH_A_KM, R_GEO_KM) * FAR_MULT,
    camDistToEarthCentreKm + MOON_REACH_KM,
  );
  return { nearKm, farKm };
}
