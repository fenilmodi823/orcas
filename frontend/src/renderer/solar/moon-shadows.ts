import type { ShaderMaterial, Vector3, Vector4 } from 'three';
import { MOONS } from './moons.js';
import { PLANETS } from './planets.js';

/**
 * The moons' shadows on their planet (S6b2): each planet's shader gets its drawn moons, as offsets from its
 * centre in km (scene frame) and a radius. All 19 are synchronous, their long axis toward the planet, so each
 * is the disc of the silhouette the planet sees, √(b·c). Inputs in `PLANETS` and `MOONS` order; geocentric km.
 */
export function writeMoonShadows(
  materials: readonly (ShaderMaterial | null)[],
  planetKm: readonly Vector3[],
  moonKm: readonly Vector3[],
  drawn: readonly boolean[],
): void {
  PLANETS.forEach((planet, p) => {
    const u = materials[p]?.uniforms;
    const at = planetKm[p];
    if (!u || !at) return;
    const slots = u.uMoons?.value as Vector4[];
    let n = 0;
    MOONS.forEach((m, i) => {
      const km = moonKm[i];
      const slot = slots[n];
      if (!drawn[i] || !km || !slot || m.system !== planet.name.toLowerCase()) return;
      slot.set(km.x - at.x, km.y - at.y, km.z - at.z, Math.sqrt(m.radiiKm[1] * m.radiiKm[2]));
      n += 1;
    });
    u.uMoonCount!.value = n;
  });
}
