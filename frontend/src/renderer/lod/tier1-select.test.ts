import { describe, expect, it } from 'vitest';
import { createTier1Buffer, selectTier1, TIER1_CAP } from './tier1-select.js';
import { apparentPx } from '../points/points-shading.js';
import { PLACEHOLDER_RADIUS_KM } from '../object-extents.js';
import { Flag } from '../../simulation/flags.js';

const PX_PER_RAD = 1188; // 726 px viewport / 35 deg fov — the /points default
const CAM = { x: 0, y: 0, z: 0 };

/** n objects strung along +X, nearest first. */
function ladder(n: number, startKm: number, stepKm: number) {
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) positions[i * 3] = startKm + i * stepKm;
  return { positions, flags: new Uint8Array(n), count: n };
}

function args(l: ReturnType<typeof ladder>) {
  return { ...l, camPosKm: CAM, pixelsPerRadian: PX_PER_RAD, radiusKm: PLACEHOLDER_RADIUS_KM };
}

describe('selectTier1', () => {
  it('selects nothing when every object is below the band', () => {
    const out = createTier1Buffer();
    expect(selectTier1(args(ladder(100, 1000, 10)), out)).toBe(0);
  });

  it('selects an object once it crosses the band lower edge', () => {
    // 3 px at r=0.01, pxPerRad=1188 -> d = 3.96 km. Put one at 2 km.
    const out = createTier1Buffer();
    expect(selectTier1(args(ladder(1, 2, 0)), out)).toBe(1);
    expect(out[0]).toBe(0);
    expect(apparentPx(PLACEHOLDER_RADIUS_KM, 2, PX_PER_RAD)).toBeGreaterThan(3);
  });

  it('never exceeds the cap, even with 50,000 qualifying objects', () => {
    const out = createTier1Buffer();
    const n = selectTier1(args(ladder(50_000, 0.5, 0.00001)), out);
    expect(n).toBe(TIER1_CAP);
  });

  it('keeps the largest when it has to choose', () => {
    const out = createTier1Buffer();
    const n = selectTier1(args(ladder(50_000, 0.5, 0.00001)), out);
    let maxIndex = 0;
    for (let i = 0; i < n; i++) maxIndex = Math.max(maxIndex, out[i]);
    expect(maxIndex).toBeLessThan(25_000); // drawn from the near half, not the tail
  });

  it('skips stale objects - a stale position must not become a mesh', () => {
    const l = ladder(1, 2, 0);
    l.flags[0] = Flag.Stale;
    expect(selectTier1(args(l), createTier1Buffer())).toBe(0);
  });

  it('allocates nothing across 600 calls', () => {
    const l = ladder(5000, 1, 0.001);
    const out = createTier1Buffer();
    for (let i = 0; i < 600; i++) {
      selectTier1({ ...args(l), camPosKm: { x: i * 0.001, y: 0, z: 0 } }, out);
    }
    expect(out.length).toBe(TIER1_CAP);
  });
});
