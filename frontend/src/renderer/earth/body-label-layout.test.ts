import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { layoutBodyLabels, type Occluder } from './body-label-layout.js';

const screen = () => ({ xPx: 0, yPx: 0, visible: false });

function cameraAt(position: Vector3, target: Vector3): PerspectiveCamera {
  const camera = new PerspectiveCamera(35, 2, 1, 1e12);
  camera.position.copy(position);
  camera.up.set(0, 0, 1);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return camera;
}

describe('layoutBodyLabels (S4)', () => {
  const jupiter: Occluder = { centreKm: new Vector3(7.8e8, 0, 0), radiusKm: 69_911 };
  const saturn: Occluder = { centreKm: new Vector3(1.4e9, 0, 0), radiusKm: 58_232 };
  const camera = cameraAt(new Vector3(1e6, 0, 0), jupiter.centreKm); // beyond the Earth, which would hide everything

  it('hides a label behind Jupiter, and shows it once it clears the disc', () => {
    const out = [screen()];
    layoutBodyLabels(camera, 800, 400, [{ pointKm: saturn.centreKm, self: saturn }], [jupiter, saturn], out);
    expect(out[0]?.visible).toBe(false);

    const aside = { centreKm: new Vector3(1.4e9, 1e6, 0), radiusKm: saturn.radiusKm };
    layoutBodyLabels(camera, 800, 400, [{ pointKm: aside.centreKm, self: aside }], [jupiter, aside], out);
    expect(out[0]?.visible).toBe(true);
  });

  it("never hides a body's label behind its own sphere", () => {
    const out = [screen()];
    layoutBodyLabels(camera, 800, 400, [{ pointKm: jupiter.centreKm, self: jupiter }], [jupiter], out);
    expect(out[0]?.visible).toBe(true);
    expect(out[0]?.xPx).toBeCloseTo(400, 3);
  });

  it("shows the Earth's label from afar, never hidden by the Earth itself, and hides it close up", () => {
    const earthPoint = new Vector3(0, 0, 0);
    const out = [screen()];
    layoutBodyLabels(cameraAt(new Vector3(1e7, 0, 0), earthPoint), 800, 400, [{ pointKm: earthPoint, self: null, isEarth: true }], [], out);
    expect(out[0]?.visible).toBe(true);
    // At GEO the Earth fills much of the view: the focused body's label goes (NASA Eyes §4.2).
    layoutBodyLabels(cameraAt(new Vector3(42_164, 0, 0), earthPoint), 800, 400, [{ pointKm: earthPoint, self: null, isEarth: true }], [], out);
    expect(out[0]?.visible).toBe(false);
  });

  it('lets an earlier label win where two would overlap, unless the earlier one is hidden', () => {
    const near = new Vector3(7.8e8, 0, 3e5); // a few pixels above Jupiter's centre
    const inputs = [
      { pointKm: jupiter.centreKm, self: jupiter },
      { pointKm: near, self: null },
    ];
    const out = [screen(), screen()];
    layoutBodyLabels(camera, 800, 400, inputs, [jupiter], out);
    expect(out.map((o) => o.visible)).toEqual([true, false]);

    // The same two, with Jupiter's label now behind a body: the second shows.
    const blocker: Occluder = { centreKm: new Vector3(3e8, 0, 0), radiusKm: 1e6 };
    layoutBodyLabels(camera, 800, 400, [inputs[0]!, { pointKm: new Vector3(7.8e8, 0, 1.2e7), self: null }], [jupiter, blocker], out);
    expect(out.map((o) => o.visible)).toEqual([false, true]);
  });
});
