import { describe, expect, it } from 'vitest';
import { encodeSimulationCoordinate, parseSimulationCoordinate } from './url-state.js';

describe('encodeSimulationCoordinate / parseSimulationCoordinate', () => {
  it('round-trips a coordinate through URLSearchParams — brief §E.5: "a shareable permalink"', () => {
    const coordinate = { snapshotVersion: 7, epochTicks: -123456 };
    const encoded = encodeSimulationCoordinate(new URLSearchParams(), coordinate);
    expect(parseSimulationCoordinate(encoded)).toEqual(coordinate);
  });

  it('preserves unrelated params already present', () => {
    const existing = new URLSearchParams('foo=bar');
    const encoded = encodeSimulationCoordinate(existing, { snapshotVersion: 1, epochTicks: 0 });
    expect(encoded.get('foo')).toBe('bar');
  });

  it('returns null when either param is missing', () => {
    expect(parseSimulationCoordinate(new URLSearchParams('sv=1'))).toBeNull();
    expect(parseSimulationCoordinate(new URLSearchParams('t=1'))).toBeNull();
    expect(parseSimulationCoordinate(new URLSearchParams(''))).toBeNull();
  });

  it('returns null for malformed (non-integer) values — reject at validation, never coerce', () => {
    expect(parseSimulationCoordinate(new URLSearchParams('sv=abc&t=1'))).toBeNull();
    expect(parseSimulationCoordinate(new URLSearchParams('sv=1&t=1.5'))).toBeNull();
  });
});
