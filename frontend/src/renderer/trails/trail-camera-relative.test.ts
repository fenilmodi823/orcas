import { describe, expect, it } from 'vitest';
import { subtractCameraOffset } from './trail-camera-relative.js';

describe('subtractCameraOffset', () => {
  it('subtracts the camera position from every xyz triple', () => {
    const positions = new Float32Array([10, 20, 30, 40, 50, 60]);
    subtractCameraOffset(positions, 2, 1, 2, 3);
    expect(Array.from(positions)).toEqual([9, 18, 27, 39, 48, 57]);
  });

  it('only touches the first `count` triples, leaving the rest untouched', () => {
    const positions = new Float32Array([10, 20, 30, 999, 999, 999]);
    subtractCameraOffset(positions, 1, 1, 1, 1);
    expect(Array.from(positions)).toEqual([9, 19, 29, 999, 999, 999]);
  });

  it('is a no-op for count 0', () => {
    const positions = new Float32Array([10, 20, 30]);
    subtractCameraOffset(positions, 0, 5, 5, 5);
    expect(Array.from(positions)).toEqual([10, 20, 30]);
  });
});
