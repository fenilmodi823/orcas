import { describe, expect, it } from 'vitest';
import { POINTS_VERTEX_SHADER, PICK_LAYER } from './points-shader-core.js';

describe('POINTS_VERTEX_SHADER', () => {
  it('declares and writes vEntityId, so the pick fragment shader can read it', () => {
    expect(POINTS_VERTEX_SHADER).toContain('varying float vEntityId;');
    expect(POINTS_VERTEX_SHADER).toContain('vEntityId = aEntityId;');
  });

  it('is a single non-empty string (sanity check against an empty extraction mistake)', () => {
    expect(typeof POINTS_VERTEX_SHADER).toBe('string');
    expect(POINTS_VERTEX_SHADER.length).toBeGreaterThan(100);
  });
});

describe('PICK_LAYER', () => {
  it('is a layer index other than the default layer 0', () => {
    expect(PICK_LAYER).toBeGreaterThan(0);
  });
});
