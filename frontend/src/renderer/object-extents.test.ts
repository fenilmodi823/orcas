import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_RADIUS_KM } from './object-extents.js';
import { PLACEHOLDER_RADIUS_KM as fromPoints } from './points/points-attributes.js';

describe('PLACEHOLDER_RADIUS_KM', () => {
  it('is 10 metres, expressed in km', () => {
    expect(PLACEHOLDER_RADIUS_KM).toBe(0.01);
  });

  // The whole point of this module: one definition, not three. If a future
  // edit re-declares it anywhere, this stops being referentially identical.
  it('is the same value the Tier 0 attribute packer uses', () => {
    expect(fromPoints).toBe(PLACEHOLDER_RADIUS_KM);
  });
});
