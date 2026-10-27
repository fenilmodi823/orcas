import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { FrameState } from '../../simulation/frame-state.js';
import { createRig } from './camera-rig.js';
import { buildFlightEndpoints } from './flight-setup.js';
import type { FlightEndpoint } from './flight-path.js';

const frame: FrameState = {
  epochMs: 1_000_000,
  count: 1,
  generation: 0,
  positions: new Float32Array([7000, 0, 0]),
  velocities: new Float32Array([0, 7.6, 0]),
  flags: new Uint8Array(1),
};

const endpoint = (): FlightEndpoint => ({ dir: new Vector3(), radiusKm: 0, pivotKm: new Vector3(), refUp: new Vector3() });

function arrivalRadiusKm(radiusKm?: number): number {
  const to = endpoint();
  buildFlightEndpoints({
    rig: createRig(),
    refUp: new Vector3(0, 0, 1),
    toEarth: false,
    frame,
    targetIndex: 0,
    preFocusDir: new Vector3(1, 0, 0),
    preFocusRadiusKm: 20_000,
    radiusKm,
    from: endpoint(),
    to,
  });
  return to.radiusKm;
}

describe('buildFlightEndpoints arrival distance', () => {
  it('uses the framing of the object by default', () => {
    expect(arrivalRadiusKm()).toBeLessThan(1);
  });

  it('uses radiusKm when given, in place of the framing', () => {
    expect(arrivalRadiusKm(100)).toBe(100);
  });
});
