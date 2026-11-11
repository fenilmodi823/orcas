import { describe, expect, it } from 'vitest';
import { objectMetaLine, spacecraftMetaLine } from './object-meta.js';

describe('meta lines are phrases (Stage B §4.3)', () => {
  it('names a satellite by class and NORAD id', () => {
    expect(objectMetaLine('leo', '25544')).toBe('LEO satellite, NORAD 25544');
  });
  it('does not call debris a satellite', () => {
    expect(objectMetaLine('debris', '25544')).toBe('Debris, NORAD 25544');
  });
  it('keeps a six-digit id as text', () => {
    expect(objectMetaLine('geo', '100123')).toBe('GEO satellite, NORAD 100123');
  });
  it('names a spacecraft by its data span', () => {
    expect(spacecraftMetaLine(1977, 2053)).toBe('Spacecraft, data 1977 to 2053');
  });
});
