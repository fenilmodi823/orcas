import { describe, expect, it } from 'vitest';
import { Flag } from './flags.js';

describe('Flag', () => {
  it('matches the brief §A.3 bit assignment exactly', () => {
    expect(Flag.None).toBe(0);
    expect(Flag.Visible).toBe(1);
    expect(Flag.Occluded).toBe(2);
    expect(Flag.Stale).toBe(4);
    expect(Flag.Selected).toBe(8);
    expect(Flag.Hovered).toBe(16);
    expect(Flag.Featured).toBe(32);
  });

  it('gives every flag a distinct bit, so they compose', () => {
    const all = [Flag.Visible, Flag.Occluded, Flag.Stale, Flag.Selected, Flag.Hovered, Flag.Featured];
    const combined = all.reduce((acc, f) => acc | f, Flag.None as number);
    for (const f of all) expect(combined & f).toBe(f);
    expect(new Set(all).size).toBe(all.length);
  });

  it('fits in the Uint8Array that FrameState.flags uses', () => {
    expect(Flag.Featured).toBeLessThanOrEqual(255);
  });
});
