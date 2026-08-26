import { describe, expect, it } from 'vitest';
import { Regime, type ObjectMeta } from '../../data/catalog-types.js';
import { packIdBytes, TIER_POINT } from './points-pick-id.js';
import {
  INITIAL_HOVER_DEBOUNCE_STATE,
  debounceHover,
  findBestPixel,
  resolveEntityIndexToNorad,
} from './points-pick-resolve.js';

function fakeObjects(count: number): ObjectMeta[] {
  return Array.from({ length: count }, (_, i) => ({
    norad: String(90000 + i) as ObjectMeta['norad'],
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

describe('findBestPixel', () => {
  it('returns null when every pixel in the window is "nothing"', () => {
    const pixels = new Uint8Array(5 * 5 * 4); // all zero
    expect(findBestPixel(pixels, 5)).toBeNull();
  });

  it('finds the one real hit among an otherwise-empty window', () => {
    const pixels = new Uint8Array(5 * 5 * 4);
    const hit = packIdBytes(7, TIER_POINT);
    const hitOffset = 12 * 4; // pixel index 12 = the window's centre in a 5x5 grid
    pixels.set(hit, hitOffset);
    expect(findBestPixel(pixels, 5)).toBe(hitOffset);
  });

  it('prefers the hit nearest the window centre when more than one pixel has a value (brief §D.2 "forgiveness")', () => {
    const pixels = new Uint8Array(5 * 5 * 4);
    pixels.set(packIdBytes(1, TIER_POINT), 0 * 4); // corner, far from centre
    pixels.set(packIdBytes(2, TIER_POINT), 12 * 4); // exact centre
    expect(findBestPixel(pixels, 5)).toBe(12 * 4);
  });
});

describe('resolveEntityIndexToNorad', () => {
  it("maps a valid index to that object's NORAD id", () => {
    const objects = fakeObjects(5);
    expect(resolveEntityIndexToNorad(3, objects)).toBe('90003');
  });

  it('returns null for an out-of-range index (a stale pick after a snapshot shrank)', () => {
    const objects = fakeObjects(5);
    expect(resolveEntityIndexToNorad(99, objects)).toBeNull();
  });
});

describe('debounceHover', () => {
  it('does not promote a new candidate until it has been seen for 2 consecutive frames (brief §D.4)', () => {
    const norad = '90000' as ObjectMeta['norad'];
    let state = debounceHover(norad, INITIAL_HOVER_DEBOUNCE_STATE);
    expect(state.value).toBeNull(); // frame 1: not promoted yet
    state = debounceHover(norad, state);
    expect(state.value).toBe(norad); // frame 2: promoted
  });

  it('resets the debounce counter the moment a third, different candidate arrives mid-debounce', () => {
    const a = '90000' as ObjectMeta['norad'];
    const b = '90001' as ObjectMeta['norad'];
    const c = '90002' as ObjectMeta['norad'];
    let state = debounceHover(a, INITIAL_HOVER_DEBOUNCE_STATE);
    state = debounceHover(a, state); // a promoted (value = a)
    state = debounceHover(b, state); // candidate changes to b, pending count = 1
    expect(state.value).toBe(a); // still showing a — b not promoted yet
    expect(state.sameCandidateFrameCount).toBe(1);
    state = debounceHover(c, state); // a THIRD candidate arrives before b was promoted
    expect(state.value).toBe(a); // still a
    expect(state.sameCandidateFrameCount).toBe(1); // restarted for c, not incremented to 2
  });

  it('promotes b after b has genuinely been the candidate for 2 consecutive frames', () => {
    const a = '90000' as ObjectMeta['norad'];
    const b = '90001' as ObjectMeta['norad'];
    let state = debounceHover(a, INITIAL_HOVER_DEBOUNCE_STATE);
    state = debounceHover(a, state); // a promoted
    state = debounceHover(b, state); // b candidate, frame 1
    state = debounceHover(b, state); // b candidate, frame 2 -> promoted
    expect(state.value).toBe(b);
  });

  it('clears immediately when the candidate becomes null (no debounce on clearing)', () => {
    const a = '90000' as ObjectMeta['norad'];
    let state = debounceHover(a, INITIAL_HOVER_DEBOUNCE_STATE);
    state = debounceHover(a, state);
    state = debounceHover(null, state);
    expect(state.value).toBeNull();
  });
});
