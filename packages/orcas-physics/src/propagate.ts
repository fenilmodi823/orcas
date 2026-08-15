import { propagate as sgp4Propagate, type SatRec } from 'satellite.js';
import type { SatState } from './types.js';

export class PropagationFailedError extends Error {
  constructor(noradId: string, at: Date) {
    super(`SGP4 propagation failed for ${noradId} at ${at.toISOString()}`);
    this.name = 'PropagationFailedError';
  }
}

/**
 * Propagate a SatRec to a given time.
 * Input: SatRec (built from OMM), JS Date (UTC).
 * Output: ECI position (km) and velocity (km/s) at that time.
 *
 * satellite.js v7 returns `null` on failure (decayed orbit, bad elements) —
 * v6 code returned `{position: false, velocity: false}` instead. Never
 * silently render a garbage position; callers must handle the throw.
 */
export function propagate(satrec: SatRec, at: Date, noradId: string): SatState {
  const result = sgp4Propagate(satrec, at);
  if (!result || !result.position || !result.velocity) {
    throw new PropagationFailedError(noradId, at);
  }
  return {
    positionEciKm: result.position,
    velocityEciKmS: result.velocity,
    at,
  };
}
