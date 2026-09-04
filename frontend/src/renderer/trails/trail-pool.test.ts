import { describe, expect, it } from 'vitest';
import { reconcilePool, type PoolSlot } from './trail-pool.js';

function slots(occupants: (string | null)[]): PoolSlot[] {
  return occupants.map((occupantNorad) => ({ occupantNorad }));
}

describe('reconcilePool', () => {
  it('assigns new occupants to free slots, lowest index first', () => {
    const result = reconcilePool(slots([null, null, null]), ['a', 'b']);
    expect(result).toEqual(['a', 'b', null]);
  });

  it('keeps an existing occupant in its own slot rather than moving it', () => {
    const result = reconcilePool(slots(['a', null, 'b']), ['a', 'b']);
    expect(result).toEqual(['a', null, 'b']);
  });

  it('frees a slot whose occupant left the focus set', () => {
    const result = reconcilePool(slots(['a', 'b']), ['a']);
    expect(result).toEqual(['a', null]);
  });

  it('a departed occupant frees its slot for a new one, same frame', () => {
    const result = reconcilePool(slots(['a', 'b']), ['c']);
    // Both 'a' and 'b' left; 'c' claims the lowest-indexed free slot.
    expect(result).toEqual(['c', null]);
  });

  it('an empty focus set frees every slot', () => {
    const result = reconcilePool(slots(['a', 'b', 'c']), []);
    expect(result).toEqual([null, null, null]);
  });

  it('never assigns the same norad to two slots', () => {
    const result = reconcilePool(slots([null, null, null, null]), ['a', 'b', 'c']);
    const assigned = result.filter((n): n is string => n !== null);
    expect(new Set(assigned).size).toBe(assigned.length);
    expect(assigned.sort()).toEqual(['a', 'b', 'c']);
  });

  it('drops norads beyond pool capacity rather than crashing', () => {
    const result = reconcilePool(slots([null, null]), ['a', 'b', 'c']);
    expect(result.filter((n) => n !== null)).toHaveLength(2);
  });

  it('is idempotent when nothing changed', () => {
    const before = slots(['a', 'b', null]);
    const result = reconcilePool(before, ['a', 'b']);
    expect(result).toEqual(['a', 'b', null]);
  });
});
