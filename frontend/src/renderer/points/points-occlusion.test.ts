import { describe, expect, it } from 'vitest';
import { WGS84_A_KM, WGS84_B_KM } from '@orcas/physics';
import { computeOcclusionFade, isOccludedByEarthRaySphere } from './points-occlusion.js';

const EARTH_RADII = { x: WGS84_A_KM, y: WGS84_A_KM, z: WGS84_B_KM };
const MEAN_RADIUS_KM = (WGS84_A_KM * 2 + WGS84_B_KM) / 3;

function pointOnSphere(radiusKm: number, azimuthRad: number, elevationRad = 0) {
  return {
    x: radiusKm * Math.cos(elevationRad) * Math.cos(azimuthRad),
    y: radiusKm * Math.cos(elevationRad) * Math.sin(azimuthRad),
    z: radiusKm * Math.sin(elevationRad),
  };
}

describe('computeOcclusionFade vs isOccludedByEarthRaySphere — independent cross-check', () => {
  it('agree at 24 camera azimuths, each checked against an object on the opposite and same side', () => {
    const cameraAltitudeKm = 60_000; // matches PointsDebug.tsx's CAMERA_DISTANCE_KM
    const objectAltitudeKm = 6771; // LEO shell, ~400km up

    for (let i = 0; i < 24; i++) {
      const az = (i / 24) * 2 * Math.PI;
      const camera = pointOnSphere(cameraAltitudeKm, az);

      // Same side as the camera: never occluded.
      const nearObject = pointOnSphere(objectAltitudeKm, az);
      const nearFade = computeOcclusionFade(camera, nearObject, EARTH_RADII);
      const nearRaySphere = isOccludedByEarthRaySphere(camera, nearObject, MEAN_RADIUS_KM);
      expect(nearRaySphere).toBe(false);
      expect(nearFade).toBeGreaterThan(0.9); // fully visible, well outside the fade band

      // Opposite side from the camera: behind Earth, both methods agree.
      const farObject = pointOnSphere(objectAltitudeKm, az + Math.PI);
      const farFade = computeOcclusionFade(camera, farObject, EARTH_RADII);
      const farRaySphere = isOccludedByEarthRaySphere(camera, farObject, MEAN_RADIUS_KM);
      expect(farRaySphere).toBe(true);
      expect(farFade).toBeCloseTo(0.06, 2); // the brief's deliberate residual
    }
  });

  it('never fades below the deliberate 6% residual, however deep behind Earth the object is', () => {
    const camera = { x: 60_000, y: 0, z: 0 };
    const deeplyOccluded = { x: -60_000, y: 0, z: 0 }; // straight behind, far side
    const fade = computeOcclusionFade(camera, deeplyOccluded, EARTH_RADII);
    expect(fade).toBeGreaterThanOrEqual(0.06);
  });

  it('never exceeds full brightness for a clearly visible object', () => {
    const camera = { x: 60_000, y: 0, z: 0 };
    const clearlyVisible = { x: 6771, y: 0, z: 0 }; // same side, LEO altitude
    const fade = computeOcclusionFade(camera, clearlyVisible, EARTH_RADII);
    expect(fade).toBeLessThanOrEqual(1.0);
  });

  it('the fade band has no discontinuity: sampling closest-approach ratios either side of 0.995-1.02 shows a continuous, monotonic rise', () => {
    // Directly exercise the smoothstep band by walking a grazing object
    // from just inside the limb to just outside it.
    const camera = { x: 60_000, y: 0, z: 0 };
    const samples: number[] = [];
    for (let grazeKm = -50; grazeKm <= 200; grazeKm += 5) {
      // An object at Earth's radius plus grazeKm, offset perpendicular to
      // the camera direction so the closest-approach point sits near the limb.
      const object = { x: 0, y: WGS84_A_KM + grazeKm, z: 0 };
      samples.push(computeOcclusionFade(camera, object, EARTH_RADII));
    }
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1] - 1e-9); // monotonic non-decreasing
      expect(samples[i] - samples[i - 1]).toBeLessThan(0.5); // no jump
    }
  });
});
