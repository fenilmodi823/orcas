import { describe, expect, it } from 'vitest';
import { Regime, type ObjectMeta } from '../../data/catalog-types.js';
import { packIdBytes, TIER_POINT } from './points-pick-id.js';
import {
  INITIAL_HOVER_DEBOUNCE_STATE,
  INITIAL_HOVER_TRACKING,
  advanceHover,
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

describe('advanceHover', () => {
  const a = '90000' as ObjectMeta['norad'];

  it('promotes a hit that resolved on ONE frame then went idle — the async-readback case (M1.5 Task 10 bug)', () => {
    // The GPU pick resolves on only ~1 frame in N; every other frame the
    // poll is idle. Feeding those idle frames' "nothing" straight into
    // debounceHover reset its counter every frame, so the 2-frame debounce
    // could never elapse and hover never appeared.
    let t = advanceHover(a, INITIAL_HOVER_TRACKING); // frame 1: resolved -> hit a
    expect(t.debounce.value).toBeNull(); // debounce frame 1, not promoted yet
    t = advanceHover(undefined, t); // frame 2: idle poll — a is HELD, debounce advances
    expect(t.debounce.value).toBe(a); // promoted despite the idle poll
  });

  it('holds the promoted value across a long run of idle frames (stationary cursor)', () => {
    let t = advanceHover(a, INITIAL_HOVER_TRACKING);
    t = advanceHover(undefined, t); // promoted
    for (let i = 0; i < 20; i++) t = advanceHover(undefined, t);
    expect(t.debounce.value).toBe(a);
    expect(t.lastResolved).toBe(a);
  });

  it('clears the hover only once a pick actually resolves to an empty window', () => {
    let t = advanceHover(a, INITIAL_HOVER_TRACKING);
    t = advanceHover(undefined, t); // promoted
    t = advanceHover(undefined, t); // idle — still there
    expect(t.debounce.value).toBe(a);
    t = advanceHover(null, t); // resolved: window empty -> clear immediately
    expect(t.debounce.value).toBeNull();
    expect(t.lastResolved).toBeNull();
  });
});
