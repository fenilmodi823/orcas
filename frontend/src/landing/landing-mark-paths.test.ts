import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BODY_D, MARK_HOLES, RING_D } from './landing-mark-paths';

// jsdom rewrites import.meta.url to http://, so resolve from the working dir (frontend/).
const svg = readFileSync(
  resolve(process.cwd(), '../design/brand/orcas-mark.svg'),
  'utf8',
);

/** The `d` of the path with this id in the master mark. */
function dOf(id: string): string | undefined {
  return new RegExp(String.raw`<path[^>]*\bid="${id}"[^>]*\bd="([^"]*)"`).exec(svg)?.[1];
}

describe('design/brand/orcas-mark.svg', () => {
  it('has the body, every hole and the ring, same as landing-mark-paths.ts', () => {
    expect(dOf('mark-body')).toBe(BODY_D);
    MARK_HOLES.forEach((d, i) => expect(dOf(`mark-hole-${i + 1}`)).toBe(d));
    expect(dOf('mark-ring')).toBe(RING_D);
  });
});
