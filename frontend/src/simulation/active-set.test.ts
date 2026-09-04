import { describe, expect, it } from 'vitest';
import { ACTIVE_SET_CAP, buildActiveSet, createActiveSetBuffer } from './active-set.js';

describe('buildActiveSet', () => {
  it('is empty when nothing is selected, hovered or promoted', () => {
    const out = createActiveSetBuffer();
    expect(buildActiveSet({ tier1: new Uint32Array(0), tier1Count: 0,
      selectedIndex: -1, hoveredIndex: -1 }, out)).toBe(0);
  });

  it('includes the selected and hovered objects', () => {
    const out = createActiveSetBuffer();
    const n = buildActiveSet({ tier1: new Uint32Array(0), tier1Count: 0,
      selectedIndex: 7, hoveredIndex: 12 }, out);
    expect(n).toBe(2);
    expect([...out.slice(0, n)].sort((a, b) => a - b)).toEqual([7, 12]);
  });

  it('is a union, not a concatenation - a selected Tier 1 member appears once', () => {
    const out = createActiveSetBuffer();
    const n = buildActiveSet({ tier1: Uint32Array.from([3, 4, 5]), tier1Count: 3,
      selectedIndex: 4, hoveredIndex: 5 }, out);
    expect(n).toBe(3);
    expect([...out.slice(0, n)].sort((a, b) => a - b)).toEqual([3, 4, 5]);
  });

  it('honours tier1Count rather than the buffer length', () => {
    const tier1 = new Uint32Array(2048);
    tier1[0] = 11;
    tier1[1] = 22;
    const out = createActiveSetBuffer();
    const n = buildActiveSet({ tier1, tier1Count: 2, selectedIndex: -1, hoveredIndex: -1 }, out);
    expect(n).toBe(2);
  });

  it('caps at 2048 - brief §G.6', () => {
    const tier1 = new Uint32Array(5000);
    for (let i = 0; i < 5000; i++) tier1[i] = i;
    const out = createActiveSetBuffer();
    const n = buildActiveSet({ tier1, tier1Count: 5000, selectedIndex: -1, hoveredIndex: -1 }, out);
    expect(n).toBe(ACTIVE_SET_CAP);
  });

  it('keeps selection even when Tier 1 fills the cap - identity outranks proximity', () => {
    const tier1 = new Uint32Array(5000);
    for (let i = 0; i < 5000; i++) tier1[i] = i;
    const out = createActiveSetBuffer();
    const n = buildActiveSet({ tier1, tier1Count: 5000, selectedIndex: 4999, hoveredIndex: -1 }, out);
    expect([...out.slice(0, n)]).toContain(4999);
  });

  it('includes featured objects (identity before proximity: before tier1)', () => {
    const out = createActiveSetBuffer();
    const n = buildActiveSet(
      {
        tier1: Uint32Array.from([1, 2]),
        tier1Count: 2,
        selectedIndex: -1,
        hoveredIndex: -1,
        featured: Uint32Array.from([9, 10]),
        featuredCount: 2,
      },
      out,
    );
    expect(n).toBe(4);
    expect([...out.slice(0, n)].sort((a, b) => a - b)).toEqual([1, 2, 9, 10]);
  });

  it('works with no featured objects at all (the argument is optional)', () => {
    const out = createActiveSetBuffer();
    const n = buildActiveSet({ tier1: new Uint32Array(0), tier1Count: 0, selectedIndex: 3, hoveredIndex: -1 }, out);
    expect(n).toBe(1);
  });

  it('a small cap (the trail-set use case) still keeps identity first', () => {
    const out = new Uint32Array(2); // e.g. a 64-cap trail set, shrunk for the test
    const n = buildActiveSet(
      {
        tier1: Uint32Array.from([1, 2, 3]),
        tier1Count: 3,
        selectedIndex: 99,
        hoveredIndex: -1,
        featured: Uint32Array.from([50, 51]),
        featuredCount: 2,
      },
      out,
    );
    expect(n).toBe(2);
    expect([...out.slice(0, n)]).toEqual([99, 50]); // selected, then the first featured — tier1 never gets in
  });

  it('allocates nothing across 600 builds', () => {
    const out = createActiveSetBuffer();
    const tier1 = Uint32Array.from([1, 2, 3]);
    for (let i = 0; i < 600; i++) {
      buildActiveSet({ tier1, tier1Count: 3, selectedIndex: i % 50, hoveredIndex: -1 }, out);
    }
    expect(out.length).toBe(ACTIVE_SET_CAP);
  });
});
