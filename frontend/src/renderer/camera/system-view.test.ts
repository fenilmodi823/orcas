import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { SYSTEM_MIN_DISTANCE_KM, systemViewOffsetKm, type SystemViewInput } from './system-view.js';

const NORTH = new Vector3(0, 0, 1);
const tanV = Math.tan((17.5 * Math.PI) / 180);
const tanH = tanV * 1.6;
const sinH = Math.sin(Math.atan(tanH));
const input = (members: SystemViewInput['members'], minDistanceKm: number, cameraOffsetKm = new Vector3(1e7, 0, 0)): SystemViewInput => ({
  cameraOffsetKm,
  planeNormal: NORTH,
  members,
  fovVerticalDeg: 35,
  aspect: 1.6,
  minDistanceKm,
});

describe("NASA Eyes' System view (S6b, `_goToSystem`)", () => {
  it("never comes nearer than NASA's minimum: Jupiter's four moons fit well inside 7,157,638 km", () => {
    const out = systemViewOffsetKm(
      input([{ offsetKm: new Vector3(), radiusKm: 71_492 }, { offsetKm: new Vector3(0, 1_882_700, 0), radiusKm: 2410.3 }], SYSTEM_MIN_DISTANCE_KM.jupiter ?? 0),
      new Vector3(),
    );
    expect(out.length()).toBeCloseTo(7_157_638, 3);
  });

  it("backs off until every member fits, × 1.3: Iapetus sets Saturn's", () => {
    const out = systemViewOffsetKm(
      input([{ offsetKm: new Vector3(), radiusKm: 141_000 }, { offsetKm: new Vector3(0, 3.5e6, 0), radiusKm: 745.7 }], SYSTEM_MIN_DISTANCE_KM.saturn ?? 0),
      new Vector3(),
    );
    expect(out.length() / (1.3 * (3.5e6 / tanH + 745.7 / sinH))).toBeCloseTo(1, 9);
  });

  it("rises 25° above the plane on the camera's own bearing", () => {
    const out = systemViewOffsetKm(input([{ offsetKm: new Vector3(), radiusKm: 1 }], 1e6, new Vector3(3e6, 4e6, -2e6)), new Vector3());
    expect((Math.asin(out.clone().normalize().dot(NORTH)) * 180) / Math.PI).toBeCloseTo(25, 9);
    expect(Math.atan2(out.y, out.x)).toBeCloseTo(Math.atan2(4e6, 3e6), 9);
  });

  it('needs more distance for a member nearer the camera than for one behind', () => {
    const toward = systemViewOffsetKm(input([{ offsetKm: new Vector3(2e6, 0, 0), radiusKm: 1 }], 0), new Vector3()).length();
    const behind = systemViewOffsetKm(input([{ offsetKm: new Vector3(-2e6, 0, 0), radiusKm: 1 }], 0), new Vector3()).length();
    expect(toward).toBeGreaterThan(behind);
  });

  it('still finds a bearing with the camera straight over the pole', () => {
    const out = systemViewOffsetKm(input([{ offsetKm: new Vector3(), radiusKm: 1 }], 1e6, new Vector3(0, 0, 5e6)), new Vector3());
    expect(Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.z)).toBe(true);
    expect(out.length()).toBeCloseTo(1e6, 3);
  });
});
