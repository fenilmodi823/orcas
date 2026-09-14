import { describe, expect, it } from 'vitest';
import { OrbitClass } from '../../data/catalog-types.js';
import { readOrbitClassColor } from './path-orbit-class-tint.js';

describe('readOrbitClassColor', () => {
  // JSDOM attaches no stylesheet, so every call exercises the fallback path.
  it('returns a distinct Color for each orbit class', () => {
    const seen = new Set(
      [OrbitClass.LEO, OrbitClass.MEO, OrbitClass.GEO, OrbitClass.HEO].map((c) => readOrbitClassColor(c).getHexString()),
    );
    expect(seen.size).toBe(4);
  });

  it('gives Unknown a colour too (never throws, never undefined)', () => {
    const c = readOrbitClassColor(OrbitClass.Unknown);
    expect(c.getHexString()).toMatch(/^[0-9a-f]{6}$/);
  });

  it('matches the --geo token fallback for GEO', () => {
    expect(readOrbitClassColor(OrbitClass.GEO).getHexString()).toBe('ffb020');
  });
});
