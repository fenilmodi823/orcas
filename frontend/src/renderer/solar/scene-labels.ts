import { Vector3, type Camera } from 'three';
import { MOON_RADIUS_KM, SUN_RADIUS_KM } from '@orcas/physics';
import type { BodyScreenPosition } from '../earth/body-screen.js';
import { layoutBodyLabels, type BodyLabelInput, type Occluder } from '../earth/body-label-layout.js';
import { LAGRANGE_LABELS, writeLagrangeLabels } from '../earth/lagrange-labels.js';
import type { MoonBodies } from './moon-bodies.js';
import { MOONS } from './moons.js';
import { EARTH_NAIF_ID, PLANETS } from './planets.js';
import type { PlanetBodies } from './planet-bodies.js';

const hidden = (): BodyScreenPosition => ({ xPx: 0, yPx: 0, visible: false });

interface SceneLabels {
  readonly sun: BodyScreenPosition;
  readonly moon: BodyScreenPosition;
  /** In `PLANETS` order. */
  readonly planets: readonly BodyScreenPosition[];
  readonly moons: readonly BodyScreenPosition[]; // in MOONS order
  /** In `LAGRANGE_LABELS` order. */
  readonly lagrange: readonly BodyScreenPosition[];
}

export interface SceneLabelWriter {
  readonly labels: SceneLabels;
  /** Every body that hides a label or bounds the near plane: the Sun, the planets once placed, the Moon. */
  readonly occluders: readonly Occluder[];
  write(at: Date, camera: Camera, cssWidth: number, cssHeight: number, sunKm: Vector3, moonKm: Vector3): void;
}

/**
 * One pass over every body label, NASA Eyes' way (Reference §4.2, S4): each is
 * hidden behind any body, and the weightier wins where two overlap. Weight:
 * the Sun, the planets nearest the camera first, the Moon, the major moons
 * nearest first, then the Lagrange points. `planets` may not be placed yet (the ephemeris is still
 * loading); their labels stay hidden until it is.
 */
export function createSceneLabelWriter(planets: PlanetBodies, moons: MoonBodies): SceneLabelWriter {
  const labels = {
    sun: hidden(),
    moon: hidden(),
    planets: PLANETS.map(hidden),
    moons: MOONS.map(hidden),
    lagrange: LAGRANGE_LABELS.map(hidden),
  };
  const sunOccluder: Occluder = { centreKm: new Vector3(), radiusKm: SUN_RADIUS_KM };
  const moonOccluder: Occluder = { centreKm: new Vector3(), radiusKm: MOON_RADIUS_KM };
  const occluders: Occluder[] = [];
  const order = PLANETS.map((_, i) => i);
  const distanceKm = new Float64Array(PLANETS.length);
  const moonOrder = MOONS.map((_, i) => i);
  const moonDistanceKm = new Float64Array(MOONS.length);

  return {
    labels,
    occluders,
    write(at, camera, cssWidth, cssHeight, sunKm, moonKm) {
      sunOccluder.centreKm.copy(sunKm); // the Sun the scene draws, even before the planets are placed
      moonOccluder.centreKm.copy(moonKm);
      occluders.length = 0;
      occluders.push(sunOccluder, moonOccluder);
      if (planets.placed) occluders.push(...planets.occluders);
      occluders.push(...moons.occluders);

      const inputs: BodyLabelInput[] = [{ pointKm: sunOccluder.centreKm, self: sunOccluder }];
      const outs: BodyScreenPosition[] = [labels.sun];
      if (planets.placed) {
        PLANETS.forEach((_, i) => (distanceKm[i] = camera.position.distanceTo(planets.planetKm[i] ?? camera.position)));
        order.sort((a, b) => (distanceKm[a] ?? 0) - (distanceKm[b] ?? 0));
        for (const i of order) {
          const isEarth = PLANETS[i]?.naifId === EARTH_NAIF_ID;
          const pointKm = planets.planetKm[i];
          const out = labels.planets[i];
          if (!pointKm || !out) continue;
          inputs.push({ pointKm, isEarth, self: isEarth ? null : (occluders.find((o) => o.centreKm === pointKm) ?? null) });
          outs.push(out);
        }
      } else {
        for (const out of labels.planets) out.visible = false;
      }
      inputs.push({ pointKm: moonOccluder.centreKm, self: moonOccluder });
      outs.push(labels.moon);
      // The major moons after every planet (NASA's weight), nearest the camera first (S6b).
      MOONS.forEach((_, i) => (moonDistanceKm[i] = moons.drawn[i] ? camera.position.distanceTo(moons.moonKm[i] ?? camera.position) : Infinity));
      moonOrder.sort((a, b) => (moonDistanceKm[a] ?? 0) - (moonDistanceKm[b] ?? 0));
      for (const i of moonOrder) {
        const out = labels.moons[i];
        const pointKm = moons.moonKm[i];
        if (!out || !pointKm) continue;
        if (!moons.drawn[i]) {
          out.visible = false;
          continue;
        }
        inputs.push({ pointKm, self: moons.occluderOf[i] ?? null });
        outs.push(out);
      }

      layoutBodyLabels(camera, cssWidth, cssHeight, inputs, occluders, outs);
      writeLagrangeLabels(at, camera, cssWidth, cssHeight, occluders, outs, labels.lagrange);
    },
  };
}
