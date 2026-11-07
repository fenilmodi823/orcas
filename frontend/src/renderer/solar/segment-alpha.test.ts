// frontend/src/renderer/solar/segment-alpha.test.ts
import type { InterleavedBufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { createFatLine } from './orbit-line.js';
import { writeSegmentAlpha } from './segment-alpha.js';
import { SEGMENT_FLOWN, SEGMENT_HIDDEN, SEGMENT_PREDICTED } from './spacecraft-trail.js';

function alphas(kinds: number[], dashSegments?: number, count = kinds.length + 1) {
  const line = createFatLine(kinds.length + 1, new Float32Array((kinds.length + 1) * 4).fill(1), 1, 2);
  const data = (line.geometry.getAttribute('instanceColorStart') as InterleavedBufferAttribute).data;
  const before = data.version;
  writeSegmentAlpha(line.geometry, Uint8Array.from(kinds), count, (p) => p / 4, dashSegments);
  expect(data.version).toBeGreaterThan(before);
  return kinds.map((_, i) => [data.array[i * 8 + 3], data.array[i * 8 + 7]]);
}

describe('writeSegmentAlpha', () => {
  it('writes solid, dashed and hidden segments', () => {
    expect(alphas([SEGMENT_FLOWN, SEGMENT_PREDICTED, SEGMENT_PREDICTED, SEGMENT_HIDDEN])).toEqual([[0, 0.25], [0, 0], [0.5, 0.75], [0, 0]]);
  });
  it('makes a dash and a gap each dashSegments long', () => {
    const p = SEGMENT_PREDICTED;
    expect(alphas([p, p, p, p, p, p], 2)).toEqual([[0, 0.25], [0.25, 0.5], [0, 0], [0, 0], [1, 1.25], [1.25, 1.5]]);
  });
  it('clears the segments a shorter path no longer reaches', () => {
    expect(alphas([SEGMENT_FLOWN, SEGMENT_FLOWN, SEGMENT_FLOWN], 1, 2)).toEqual([[0, 0.25], [0, 0], [0, 0]]);
  });
});
