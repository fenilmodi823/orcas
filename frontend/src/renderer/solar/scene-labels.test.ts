import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import type { Occluder } from '../earth/body-label-layout.js';
import type { MoonBodies } from './moon-bodies.js';
import { MOONS } from './moons.js';
import type { PlanetBodies } from './planet-bodies.js';
import { PLANETS } from './planets.js';
import type { SpacecraftBodies } from './spacecraft-bodies.js';
import { SPACECRAFT } from './spacecraft.js';
import { createSceneLabelWriter } from './scene-labels.js';

const JUPITER = PLANETS.findIndex((p) => p.name === 'Jupiter');
const IO = MOONS.findIndex((m) => m.id === 'io');
// Jupiter well away from the scene's origin: the label pass also tests every label against the Earth there.
const J = new Vector3(6e8, 0, 0);

function scene(ioOffsetKm: Vector3, cameraOffsetKm: Vector3, craftOffsetKm: Vector3 | null = null) {
  const ioKm = J.clone().add(ioOffsetKm);
  const cameraKm = J.clone().add(cameraOffsetKm);
  const planetKm = PLANETS.map((_, i) => (i === JUPITER ? J.clone() : new Vector3(1e12, 0, 0)));
  const jupiter: Occluder = { centreKm: planetKm[JUPITER]!, radiusKm: 69_911 };
  const planets = { placed: true, planetKm, occluders: [jupiter] } as unknown as PlanetBodies;
  const moonKm = MOONS.map((_, i) => (i === IO ? ioKm : new Vector3()));
  const occluderOf = MOONS.map((_, i) => ({ centreKm: moonKm[i]!, radiusKm: 1821.5 }));
  const moons = {
    moonKm,
    drawn: MOONS.map((_, i) => i === IO),
    fade: MOONS.map((_, i) => (i === IO ? 1 : 0)),
    occluderOf,
    occluders: [occluderOf[IO]!],
  } as unknown as MoonBodies;
  const camera = new PerspectiveCamera(35, 1440 / 900, 1, 1e12);
  camera.position.copy(cameraKm);
  camera.lookAt(J);
  camera.updateMatrixWorld();
  // Spacecraft 0 is drawn at `craftOffsetKm` from Jupiter when given; the rest are not drawn.
  const craft = {
    scKm: SPACECRAFT.map((_, i) => (i === 0 && craftOffsetKm ? J.clone().add(craftOffsetKm) : new Vector3())),
    drawn: SPACECRAFT.map((_, i) => i === 0 && craftOffsetKm !== null),
  } as unknown as SpacecraftBodies;
  const writer = createSceneLabelWriter(planets, moons, craft);
  writer.write(new Date(Date.UTC(2026, 9, 12)), camera, 1440, 900, new Vector3(-1.5e8, 0, 0), new Vector3(1e12, 1e12, 0));
  return writer.labels;
}

describe('moon labels (S6b)', () => {
  it('show beside their planet, and give way to it where they crowd', () => {
    expect(scene(new Vector3(0, 421_700, 0), new Vector3(0, 0, 3e6)).moons[IO]?.visible).toBe(true);
    const far = scene(new Vector3(0, 421_700, 0), new Vector3(0, 0, 3e8)); // Io 2 px from Jupiter: within 60
    expect(far.planets[JUPITER]?.visible).toBe(true);
    expect(far.moons[IO]?.visible).toBe(false);
  });

  it('hide behind their planet', () => {
    expect(scene(new Vector3(0, 0, -421_700), new Vector3(0, 0, 3e6)).moons[IO]?.visible).toBe(false);
  });

  it('stay hidden for a moon that is not drawn', () => {
    const labels = scene(new Vector3(0, 421_700, 0), new Vector3(0, 0, 3e6));
    expect(labels.moons.filter((l) => l.visible)).toHaveLength(1);
  });
});

describe('spacecraft labels (S6c1)', () => {
  const cam = new Vector3(0, 0, 3e6);
  it('show where nothing crowds them', () => {
    const l = scene(new Vector3(0, 421_700, 0), cam, new Vector3(0, -900_000, 0));
    expect(l.spacecraft[0]?.visible).toBe(true);
    expect(l.spacecraft.filter((s) => s.visible)).toHaveLength(1);
  });

  it('give way to a moon where they overlap', () => {
    const l = scene(new Vector3(0, 421_700, 0), cam, new Vector3(0, 421_700, 1));
    expect(l.moons[IO]?.visible).toBe(true);
    expect(l.spacecraft[0]?.visible).toBe(false);
  });

  it('hide behind a planet, being a point', () => {
    expect(scene(new Vector3(0, 421_700, 0), cam, new Vector3(0, 0, -421_700)).spacecraft[0]?.visible).toBe(false);
  });

  it('stay hidden when not drawn', () => {
    expect(scene(new Vector3(0, 421_700, 0), cam).spacecraft.every((s) => !s.visible)).toBe(true);
  });
});
