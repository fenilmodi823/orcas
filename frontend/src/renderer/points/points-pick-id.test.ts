import { describe, expect, it } from 'vitest';
import { TIER_POINT, packIdBytes, unpackIdBytes } from './points-pick-id.js';

describe('packIdBytes / unpackIdBytes round-trip', () => {
  it('round-trips entity index 0 (the first object, not the reserved "nothing" value)', () => {
    const bytes = packIdBytes(0, TIER_POINT);
    const decoded = unpackIdBytes(Uint8Array.from(bytes), 0);
    expect(decoded).toEqual({ entityIndex: 0, tierTag: TIER_POINT });
  });

  it('round-trips a large index (near the full catalogue size)', () => {
    const bytes = packIdBytes(46_249, TIER_POINT);
    const decoded = unpackIdBytes(Uint8Array.from(bytes), 0);
    expect(decoded).toEqual({ entityIndex: 46_249, tierTag: TIER_POINT });
  });

  it('round-trips an index requiring all 24 bits', () => {
    const bytes = packIdBytes(1_000_000, TIER_POINT);
    const decoded = unpackIdBytes(Uint8Array.from(bytes), 0);
    expect(decoded).toEqual({ entityIndex: 1_000_000, tierTag: TIER_POINT });
  });

  it('decodes an all-zero pixel (the reserved "nothing" value) as null', () => {
    const decoded = unpackIdBytes(Uint8Array.from([0, 0, 0, 0]), 0);
    expect(decoded).toBeNull();
  });

  it('reads from a non-zero offset into a larger buffer, for scanning a 5x5 window', () => {
    const nothing = [0, 0, 0, 0];
    const hit = packIdBytes(42, TIER_POINT);
    const buffer = Uint8Array.from([...nothing, ...hit, ...nothing]);
    expect(unpackIdBytes(buffer, 4)).toEqual({ entityIndex: 42, tierTag: TIER_POINT });
    expect(unpackIdBytes(buffer, 0)).toBeNull();
    expect(unpackIdBytes(buffer, 8)).toBeNull();
  });
});
