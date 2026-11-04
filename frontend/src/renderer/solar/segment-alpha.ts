// frontend/src/renderer/solar/segment-alpha.ts
import type { InterleavedBufferAttribute } from 'three';
import type { LineGeometry } from 'three-stdlib';
import { SEGMENT_HIDDEN, SEGMENT_PREDICTED } from './spacecraft-trail.js';

/**
 * Dashes and breaks as per-segment alpha on a `createFatLine` line. three-stdlib lays the colours out as one
 * interleaved buffer, 8 floats per segment (RGBA of its start, RGBA of its end), so a segment's alphas are at
 * `i * 8 + 3` and `i * 8 + 7`. A hidden segment is 0 at both ends; a predicted one alternates dash and gap, each
 * `dashSegments` long (the gap where `floor(i / dashSegments)` is odd); otherwise it runs from `alphaAt(i)` to
 * `alphaAt(i + 1)`. Segments from `count - 1` on are 0, so a shorter path never shows stale ones.
 */
export function writeSegmentAlpha(
  geometry: LineGeometry,
  kinds: Uint8Array,
  count: number,
  alphaAt: (point: number) => number,
  dashSegments = 1,
): void {
  const data = (geometry.getAttribute('instanceColorStart') as InterleavedBufferAttribute).data;
  const array = data.array as Float32Array;
  for (let i = 0, n = array.length / 8; i < n; i++) {
    const kind = kinds[i];
    const off = i >= count - 1 || kind === SEGMENT_HIDDEN || (kind === SEGMENT_PREDICTED && Math.floor(i / dashSegments) % 2 === 1);
    array[i * 8 + 3] = off ? 0 : alphaAt(i);
    array[i * 8 + 7] = off ? 0 : alphaAt(i + 1);
  }
  data.needsUpdate = true;
}
