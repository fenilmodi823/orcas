// frontend/src/renderer/solar/spacecraft-trail-cache.ts
import { Vector3 } from 'three';
import type { HorizonsManifest } from '../../data/horizons-manifest.js';
import { SPACECRAFT_TRAIL_SAMPLES } from './spacecraft-trail.js';
import { CENTRE_BODY } from './spacecraft.js';
import { centreGeocentricKm } from './system-centres.js';
import type { PlanetEphemeris } from '../../data/planet-ephemeris.js';

/** One spacecraft's last resampled trail (centre-relative ICRF km, oldest first) and what it was sampled for. */
export interface TrailCache {
  readonly trailKm: Float64Array;
  readonly kinds: Uint8Array;
  valid: boolean;
  epochMs: number; // UTC ms
  centre: number; // NAIF id
  lengthS: number; // trail length, s
  manifest: HorizonsManifest | null;
  extentKm: number; // farthest point from the centre, km
}

export const createTrailCache = (): TrailCache => ({
  trailKm: new Float64Array(SPACECRAFT_TRAIL_SAMPLES * 3),
  kinds: new Uint8Array(SPACECRAFT_TRAIL_SAMPLES - 1),
  valid: false,
  epochMs: 0,
  centre: -1,
  lengthS: 0,
  manifest: null,
  extentKm: 0,
});

/** Whether the cached trail is stale: no trail, another centre or manifest, or the clock moved a quarter sample (either way). */
export function needsResample(c: TrailCache, centre: number, manifest: HorizonsManifest, epochMs: number): boolean {
  return (
    !c.valid ||
    c.centre !== centre ||
    c.manifest !== manifest ||
    Math.abs(epochMs - c.epochMs) >= (0.25 * c.lengthS * 1000) / (SPACECRAFT_TRAIL_SAMPLES - 1)
  );
}

interface CentreSlot {
  id: number;
  ok: boolean;
  readonly v: Vector3;
}

/** Each centre placed at most once a frame: geocentric km, filled lazily, reset with `reset()`; allocation-free. */
export function createCentreCache() {
  const slots: CentreSlot[] = Object.keys(CENTRE_BODY).map(() => ({ id: -1, ok: false, v: new Vector3() }));
  let count = 0;
  return {
    reset: () => {
      count = 0;
    },
    /** The centre's geocentric place at `epochMs` (valid until the next `reset`), or null if it cannot be placed. */
    get(centre: number, epochMs: number, planets: PlanetEphemeris | null): Vector3 | null {
      for (let i = 0; i < count; i++) {
        const s = slots[i]!;
        if (s.id === centre) return s.ok ? s.v : null;
      }
      const s = slots[count];
      if (!s) return centreGeocentricKm(centre, epochMs, planets, new Vector3()); // unreachable: every centre has a slot
      count += 1;
      s.id = centre;
      s.ok = centreGeocentricKm(centre, epochMs, planets, s.v) !== null;
      return s.ok ? s.v : null;
    },
  };
}
