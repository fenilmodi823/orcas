import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Mesh, PerspectiveCamera, SphereGeometry, Vector3 } from 'three';
import { iauBodyAxesJ2000 } from '@orcas/physics';
import { parsePlanetEphemeris } from '../../data/planet-ephemeris.js';
import { createPlanetBodies } from './planet-bodies.js';
import { PLANETS } from './planets.js';

const file = readFileSync(resolve(process.cwd(), 'public/ephemeris/planets-de421.bin'));
const ephemeris = parsePlanetEphemeris(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
const AT_MS = Date.UTC(2026, 9, 6, 12);

describe('planet orientation (S5b)', () => {
  // The baked maps put east longitude 0 at u = 0.5 and +90° at u = 0.75, north up, as the Earth's do.
  // On three's unit sphere those are the vertices (1, 0, 0) and (0, 0, −1), and the pole is (0, 1, 0).
  it('puts each map’s prime meridian, east and pole on the IAU body frame, at the IAU radii', () => {
    const bodies = createPlanetBodies();
    const camera = new PerspectiveCamera(35, 1.6, 1, 1e10); // at the Earth: every disc under a pixel, so no map loads
    bodies.update(AT_MS, ephemeris, camera, { cssWidth: 1440, cssHeight: 900, dpr: 1 });
    const spheres = bodies.group.children.filter((c): c is Mesh => c instanceof Mesh && c.geometry instanceof SphereGeometry);
    const drawn = PLANETS.filter((p) => p.name !== 'Earth');
    expect(spheres).toHaveLength(drawn.length);

    drawn.forEach((planet, k) => {
      const mesh = spheres[k];
      const centre = bodies.planetKm[PLANETS.indexOf(planet)];
      const axes = iauBodyAxesJ2000(planet.bodyNaifId, new Date(AT_MS));
      if (!mesh || !centre || !axes) throw new Error(planet.name);
      const local = (x: number, y: number, z: number) => new Vector3(x, y, z).applyMatrix4(mesh.matrix).sub(centre);
      const meridian = local(1, 0, 0);
      const east = local(0, 0, -1);
      const north = local(0, 1, 0);
      expect(meridian.length()).toBeCloseTo(planet.equatorialRadiusKm, 3);
      expect(north.length()).toBeCloseTo(planet.polarRadiusKm, 3);
      expect(meridian.normalize().dot(new Vector3(axes.x.x, axes.x.y, axes.x.z))).toBeCloseTo(1, 9);
      expect(east.normalize().dot(new Vector3(axes.y.x, axes.y.y, axes.y.z))).toBeCloseTo(1, 9);
      expect(north.normalize().dot(new Vector3(axes.z.x, axes.z.y, axes.z.z))).toBeCloseTo(1, 9);
    });
    bodies.dispose();
  });
});
