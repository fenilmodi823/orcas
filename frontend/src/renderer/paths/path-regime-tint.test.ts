import { describe, expect, it } from 'vitest';
import { Regime } from '../../data/catalog-types.js';
import { readRegimeColor } from './path-regime-tint.js';

describe('readRegimeColor', () => {
  // JSDOM attaches no stylesheet, so every call exercises the fallback path.
  it('returns a distinct Color for each orbital regime', () => {
    const seen = new Set(
      [Regime.LEO, Regime.MEO, Regime.GEO, Regime.HEO].map((r) => readRegimeColor(r).getHexString()),
    );
    expect(seen.size).toBe(4);
  });

  it('gives Unknown a colour too (never throws, never undefined)', () => {
    const c = readRegimeColor(Regime.Unknown);
    expect(c.getHexString()).toMatch(/^[0-9a-f]{6}$/);
  });

  it('matches the --geo token fallback for GEO', () => {
    expect(readRegimeColor(Regime.GEO).getHexString()).toBe('ffb020');
  });
});
