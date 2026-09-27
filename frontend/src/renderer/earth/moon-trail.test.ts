import { describe, expect, it } from 'vitest';
import { moonPositionJ2000Km } from '@orcas/physics';
import { MOON_TRAIL_SAMPLES, writeMoonTrail } from './moon-trail.js';

const NOW = Date.parse('2026-09-26T18:00:00Z');

function trail() {
  const positions = new Float32Array(MOON_TRAIL_SAMPLES * 3);
  const colours = new Float32Array(MOON_TRAIL_SAMPLES * 4);
  writeMoonTrail(NOW, { r: 1, g: 1, b: 1 }, positions, colours);
  return { positions, colours };
}

describe('writeMoonTrail', () => {
  it('ends exactly at the Moon', () => {
    const { positions } = trail();
    const moon = moonPositionJ2000Km(new Date(NOW));
    const i = (MOON_TRAIL_SAMPLES - 1) * 3;
    expect(positions[i]).toBeCloseTo(moon.x, -1);
    expect(positions[i + 1]).toBeCloseTo(moon.y, -1);
    expect(positions[i + 2]).toBeCloseTo(moon.z, -1);
  });

  it('closes nearly on itself after one sidereal month', () => {
    const { positions } = trail();
    const last = (MOON_TRAIL_SAMPLES - 1) * 3;
    const gap = Math.hypot(positions[0] - positions[last], positions[1] - positions[last + 1], positions[2] - positions[last + 2]);
    // Perturbations and apsidal motion stop it closing exactly; ~10% of the
    // radius is the order the real orbit misses by in a month.
    expect(gap).toBeLessThan(40_000);
  });

  it('stays at lunar distance throughout', () => {
    const { positions } = trail();
    for (let i = 0; i < MOON_TRAIL_SAMPLES; i++) {
      const r = Math.hypot(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      expect(r).toBeGreaterThan(356_000);
      expect(r).toBeLessThan(407_000);
    }
  });

  it('fades toward the oldest end', () => {
    const { colours } = trail();
    expect(colours[3]).toBeLessThan(colours[(MOON_TRAIL_SAMPLES - 1) * 4 + 3]);
  });
});
