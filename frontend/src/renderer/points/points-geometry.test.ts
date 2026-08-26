import { describe, expect, it } from 'vitest';
import { Regime, type ObjectMeta } from '../../data/catalog-types.js';
import { createPointsGeometry } from './points-geometry.js';
import { FLAG_VISIBLE, PLACEHOLDER_RADIUS_KM } from './points-attributes.js';

function fakeObjects(count: number): ObjectMeta[] {
  return Array.from({ length: count }, (_, i) => ({
    norad: String(i) as ObjectMeta['norad'],
    name: `obj-${i}`,
    objectId: `obj-${i}`,
    type: 0,
    regime: Regime.LEO,
    isActive: true,
    sourceType: 'live',
    epochMs: 0,
    record: {} as ObjectMeta['record'],
  }));
}

describe('createPointsGeometry', () => {
  it('wraps the given positions buffer BY REFERENCE, not a copy — the zero-allocation contract', () => {
    const positions = new Float32Array(3 * 5);
    const geometry = createPointsGeometry(fakeObjects(5), positions);
    expect(geometry.getAttribute('position').array).toBe(positions);
  });

  it('creates one entry per object for every static attribute', () => {
    const geometry = createPointsGeometry(fakeObjects(7), new Float32Array(3 * 7));
    expect(geometry.getAttribute('aEntityId').count).toBe(7);
    expect(geometry.getAttribute('aRegime').count).toBe(7);
    expect(geometry.getAttribute('aRadius').count).toBe(7);
    expect(geometry.getAttribute('aFlags').count).toBe(7);
  });

  it('every object starts visible with the placeholder radius', () => {
    const geometry = createPointsGeometry(fakeObjects(2), new Float32Array(3 * 2));
    const radius = geometry.getAttribute('aRadius').array as Float32Array;
    const flags = geometry.getAttribute('aFlags').array as Float32Array;
    // Float32Array stores Math.fround(x), not x itself.
    const expectedRadius = Math.fround(PLACEHOLDER_RADIUS_KM);
    expect(Array.from(radius)).toEqual([expectedRadius, expectedRadius]);
    expect(Array.from(flags)).toEqual([FLAG_VISIBLE, FLAG_VISIBLE]);
  });
});
