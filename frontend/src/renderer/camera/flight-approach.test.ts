import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { FlightController } from './flight-controller.js';
import type { FlightEndpoint } from './flight-path.js';

/**
 * The M1.7a review's headline complaint, pinned as a property.
 *
 * "When I click a satellite the camera tries to do the smooth transition but
 * fails. The satellite appears at the end suddenly, not smoothly."
 *
 * That was never about easing. The camera was aiming at where the object
 * WOULD be — via a fixed-point arrival solve whose duration is floored at
 * 1.2 s, a floor that never expires — so it flew to a rendezvous point ~9 km
 * ahead of a LEO object and only met it at the instant object mode took
 * over. Measured live: 7.85 km (1.5 px, invisible) held for 1.7 s, then a
 * snap to 82 m.
 *
 * These tests watch the only quantity that decides whether anything is on
 * screen: the distance from the camera to where the object ACTUALLY IS.
 */

const OBJECT_SPEED_KM_S = 7.66; // a real LEO speed — the whole problem scales with it
const START_EPOCH_MS = 1_770_000_000_000;
const ARRIVAL_RADIUS_KM = 0.0825; // object-mode framing distance for a 10 m proxy
const START_RADIUS_KM = 42164; // R_GEO, the default free-orbit view

/** Object at 7,000 km, moving along +Y at a real orbital speed. */
function objectPositionAt(epochMs: number, out: Vector3): Vector3 {
  const dtSec = (epochMs - START_EPOCH_MS) / 1000;
  return out.set(7000, OBJECT_SPEED_KM_S * dtSec, 0);
}

function endpoints(): { from: FlightEndpoint; to: FlightEndpoint } {
  const objectNow = objectPositionAt(START_EPOCH_MS, new Vector3());
  return {
    from: {
      dir: new Vector3(1, 0, 0),
      radiusKm: START_RADIUS_KM,
      pivotKm: new Vector3(0, 0, 0),
      refUp: new Vector3(0, 0, 1),
    },
    to: {
      dir: new Vector3(0, 0, 1),
      radiusKm: ARRIVAL_RADIUS_KM,
      pivotKm: objectNow.clone(),
      refUp: objectNow.clone().normalize(),
    },
  };
}

/** Fly the whole thing at 60 Hz, recording camera-to-object distance. */
function flyAndTrace(): { distances: number[]; done: boolean } {
  const { from, to } = endpoints();
  const controller = new FlightController();
  controller.begin({
    from,
    to,
    camDist0Km: START_RADIUS_KM,
    camDist1Km: 7000,
    targetIndex: 0,
    durationSec: 2.4,
  });

  const dt = 1 / 60;
  const distances: number[] = [];
  const objectNow = new Vector3();
  let epochMs = START_EPOCH_MS;
  let done = false;

  for (let i = 0; i < 200 && !done; i++) {
    epochMs += dt * 1000;
    const tick = controller.tick(dt, epochMs, (t, out) => objectPositionAt(t, out));
    if (!tick) break;
    objectPositionAt(epochMs, objectNow);
    distances.push(tick.sample.positionKm.distanceTo(objectNow));
    done = tick.done;
  }
  return { distances, done };
}

describe('a fly-to closes on the object, not on a point ahead of it', () => {
  const { distances, done } = flyAndTrace();

  it('completes', () => {
    expect(done).toBe(true);
    expect(distances.length).toBeGreaterThan(60);
  });

  it('ends alongside the object at the framing distance', () => {
    expect(distances[distances.length - 1]).toBeCloseTo(ARRIVAL_RADIUS_KM, 2);
  });

  // The defect, stated directly: the camera used to hold ~7.85 km — far
  // outside the ~4 km at which a 10 m object first reaches 3 px — for most
  // of the flight, then close it in a single frame.
  it('never parks outside visible range and then snaps in', () => {
    const visibleFrom = distances.findIndex((d) => d <= 4);
    expect(visibleFrom).toBeGreaterThanOrEqual(0);
    // Once inside 4 km there must be real frames left to watch, not one.
    expect(distances.length - visibleFrom).toBeGreaterThan(30);
  });

  // Restricted to the visible part on purpose. Earlier than that the arc
  // swell is deliberately lifting the camera over the limb (§C.8), which can
  // and should increase the distance for a while — at 0.03 px nobody sees it.
  it('closes monotonically once the object is visible — no plateau, no backing away', () => {
    for (let i = 1; i < distances.length; i++) {
      if (distances[i - 1] > 12) continue;
      expect(distances[i]).toBeLessThanOrEqual(distances[i - 1] * 1.001);
    }
  });

  /**
   * The one that would have caught this on the first day. Apparent size goes
   * as 1/distance, so a single frame that halves the distance doubles the
   * object. Measured before the fix, the last step was effectively infinite
   * (7.84 km → 0.0825 km); with the smoothDamp lag still in it was 27x.
   */
  it('never more than doubles the object in one frame once it is visible', () => {
    let worst = 1;
    for (let i = 1; i < distances.length; i++) {
      // From the point the object is a pixel across — below that nobody can
      // see the jump anyway.
      if (distances[i - 1] <= 12) worst = Math.max(worst, distances[i - 1] / distances[i]);
    }
    expect(worst).toBeLessThan(2);
  });
});
