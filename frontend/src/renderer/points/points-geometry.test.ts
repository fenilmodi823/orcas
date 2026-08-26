import { describe, expect, it } from 'vitest';
import type { BufferAttribute } from 'three';
import { Regime, type ObjectMeta } from '../../data/catalog-types.js';
import { createPointsGeometry, updateFlagsAttribute } from './points-geometry.js';
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
    const geometry = createPointsGeometry(fakeObjects(5), positions, new Uint8Array(5), new Set());
    expect(geometry.getAttribute('position').array).toBe(positions);
  });

  it('creates one entry per object for every static attribute', () => {
    const geometry = createPointsGeometry(
      fakeObjects(7),
      new Float32Array(3 * 7),
      new Uint8Array(7),
      new Set(),
    );
    expect(geometry.getAttribute('aEntityId').count).toBe(7);
    expect(geometry.getAttribute('aRegime').count).toBe(7);
    expect(geometry.getAttribute('aRadius').count).toBe(7);
    expect(geometry.getAttribute('aFlags').count).toBe(7);
  });

  it('every object starts visible with the placeholder radius, when no filter is active', () => {
    const geometry = createPointsGeometry(
      fakeObjects(2),
      new Float32Array(3 * 2),
      new Uint8Array(2),
      new Set(),
    );
    const radius = geometry.getAttribute('aRadius').array as Float32Array;
    const flags = geometry.getAttribute('aFlags').array as Float32Array;
    // Float32Array stores Math.fround(x), not x itself.
    const expectedRadius = Math.fround(PLACEHOLDER_RADIUS_KM);
    expect(Array.from(radius)).toEqual([expectedRadius, expectedRadius]);
    expect(Array.from(flags)).toEqual([FLAG_VISIBLE, FLAG_VISIBLE]);
  });
});

describe('createPointsGeometry — aStale attribute', () => {
  it('wraps the given staleFlags buffer BY REFERENCE, not a copy', () => {
    const staleFlags = new Uint8Array(5);
    const geometry = createPointsGeometry(fakeObjects(5), new Float32Array(3 * 5), staleFlags, new Set());
    expect(geometry.getAttribute('aStale').array).toBe(staleFlags);
  });
});

describe('createPointsGeometry — real filter-driven aFlags', () => {
  it('builds aFlags from the classifier and active filters, not an always-visible placeholder', () => {
    const objects = fakeObjects(2); // both Regime.LEO per the existing fakeObjects helper
    const geometry = createPointsGeometry(objects, new Float32Array(3 * 2), new Uint8Array(2), new Set(['meo']));
    // Neither object is MEO, and the filter set is non-empty -> both hidden.
    expect(Array.from(geometry.getAttribute('aFlags').array as Float32Array)).toEqual([0, 0]);
  });
});

describe('updateFlagsAttribute', () => {
  it('rewrites aFlags in place and flags it for re-upload, without touching other attributes\' arrays', () => {
    const objects = fakeObjects(2);
    const positions = new Float32Array(3 * 2);
    const staleFlags = new Uint8Array(2);
    const geometry = createPointsGeometry(objects, positions, staleFlags, new Set());

    const positionArrayBefore = geometry.getAttribute('position').array;
    const aRadiusArrayBefore = geometry.getAttribute('aRadius').array;
    // `needsUpdate` is a write-only accessor on THREE.BufferAttribute (no
    // getter — setting it just bumps `.version` internally), so the only
    // way to observe "was this flagged for re-upload" is to watch
    // `.version` increment.
    const versionBefore = (geometry.getAttribute('aFlags') as BufferAttribute).version;

    updateFlagsAttribute(geometry, objects, new Set(['meo']));

    expect(geometry.getAttribute('position').array).toBe(positionArrayBefore); // untouched
    expect(geometry.getAttribute('aRadius').array).toBe(aRadiusArrayBefore); // untouched
    expect(Array.from(geometry.getAttribute('aFlags').array as Float32Array)).toEqual([0, 0]); // both LEO, filtered to MEO-only
    expect((geometry.getAttribute('aFlags') as BufferAttribute).version).toBeGreaterThan(versionBefore);
  });
});
