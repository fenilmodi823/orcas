import { describe, expect, it } from 'vitest';
import { Color, Vector3, Vector4 } from 'three';
import { createPlanetMaterial, MAX_SHADOW_MOONS } from './planet-materials.js';
import { MOONS } from './moons.js';
import { PLANETS } from './planets.js';
import { writeMoonShadows } from './moon-shadows.js';

describe("the moons' shadows on their planet (S6b2)", () => {
  const jupiter = PLANETS.findIndex((p) => p.name === 'Jupiter');
  const materials = PLANETS.map((p) => (p.name === 'Earth' ? null : createPlanetMaterial(new Color())));
  const planetKm = PLANETS.map((_, i) => new Vector3(i * 1e8, 0, 0));
  const moonKm = MOONS.map((_, i) => new Vector3(i * 1e8 + 1000 * i, 7, -3));

  it('gives each planet its drawn moons, centred on the planet, each the disc of its silhouette seen from it', () => {
    const drawn = MOONS.map((m) => m.system === 'jupiter' && m.id !== 'europa');
    writeMoonShadows(materials, planetKm, moonKm, drawn);
    const u = materials[jupiter]!.uniforms;
    expect(u.uMoonCount!.value).toBe(3);
    const io = MOONS.findIndex((m) => m.id === 'io');
    const [, b, c] = MOONS[io]!.radiiKm;
    const first = (u.uMoons!.value as Vector4[])[0]!;
    expect(first.x).toBe(moonKm[io]!.x - planetKm[jupiter]!.x);
    expect([first.y, first.z]).toEqual([7, -3]);
    expect(first.w).toBeCloseTo(Math.sqrt(b * c), 9); // synchronous: the long axis points at the planet
    expect(materials.filter((_, i) => i !== jupiter).every((m) => !m || m.uniforms.uMoonCount!.value === 0)).toBe(true);
  });

  it("has room for the largest system's moons", () => {
    const most = Math.max(...PLANETS.map((p) => MOONS.filter((m) => m.system === p.name.toLowerCase()).length));
    expect(most).toBe(7); // Saturn's
    expect(MAX_SHADOW_MOONS).toBeGreaterThanOrEqual(most);
  });
});
