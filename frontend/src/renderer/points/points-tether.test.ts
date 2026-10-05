import { describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { writeTetherPosition } from './points-tether.js';
import type { ObjectTetherHandle } from '../../ui/ObjectTether.js';

function handle() {
  const tether = { setPosition: vi.fn(), setVisible: vi.fn(), setAltitude: vi.fn<(altitudeKm: number) => void>() };
  return tether satisfies ObjectTetherHandle;
}

describe('writeTetherPosition', () => {
  it("writes the object's live altitude, not the one it had when selected", () => {
    // 400 km above the equator (WGS84 equatorial radius 6378.137 km).
    const positions = new Float32Array([0, 0, 0, 6778.137, 0, 0]);
    const camera = new PerspectiveCamera(35, 1, 1, 1e6);
    camera.position.set(50_000, 0, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const tether = handle();

    writeTetherPosition(tether, 1, positions, camera, 800, 600, new Vector3());
    expect(tether.setAltitude).toHaveBeenCalledTimes(1);
    expect(tether.setAltitude.mock.calls[0][0]).toBeCloseTo(400, 1);

    positions[3] = 6878.137; // the clock moved on; the object climbed 100 km
    writeTetherPosition(tether, 1, positions, camera, 800, 600, new Vector3());
    expect(tether.setAltitude.mock.calls[1][0]).toBeCloseTo(500, 1);
  });

  it('leaves the altitude alone while hidden', () => {
    const tether = handle();
    writeTetherPosition(tether, -1, new Float32Array(3), new PerspectiveCamera(), 800, 600, new Vector3());
    expect(tether.setAltitude).not.toHaveBeenCalled();
  });
});
