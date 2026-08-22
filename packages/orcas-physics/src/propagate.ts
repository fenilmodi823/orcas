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
 *
 * The community decay check (`communityDecayCheckEnabled`, satellite.js
 * 7.1.0+) is enabled: SGP4's drag model squares its shrinkage factor
 * (`tempa`), so once `tempa` goes negative the orbit is fictional but
 * `error` still reads 0 — a plausible-looking position for an object that
 * has actually re-entered. This is a visualisation platform: a decayed
 * object rendered at a fake altitude is worse than a missing one. See
 * ORCAS Vault Phase-4 Engineering Brief Part 3.4, milestone M0.3.
 */
export function propagate(satrec: SatRec, at: Date, noradId: string): SatState {
  const result = sgp4Propagate(satrec, at, { communityDecayCheckEnabled: true });
  if (!result || !result.position || !result.velocity) {
    throw new PropagationFailedError(noradId, at);
  }
  // satellite.js's own truthiness check above does not catch every
  // failure mode: a malformed satrec (e.g. an unparseable EPOCH — see
  // satrec-from-omm.ts's normalizeEpochToZ) can produce a truthy
  // position/velocity object whose components are NaN, which silently
  // poisons every consumer instead of throwing. Found live-verifying
  // M1.1's debug route against a real record. Reject it here, at the
  // one place every caller goes through.
  const { position, velocity } = result;
  const allFinite = [position.x, position.y, position.z, velocity.x, velocity.y, velocity.z].every(
    Number.isFinite,
  );
  if (!allFinite) {
    throw new PropagationFailedError(noradId, at);
  }
  return {
    positionEciKm: result.position,
    velocityEciKmS: result.velocity,
    at,
  };
}
