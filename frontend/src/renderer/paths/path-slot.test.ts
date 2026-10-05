import { describe, expect, it } from 'vitest';
import { FEATURED_LINE_WIDTH_PX, featuredLineWidthPx } from './path-slot.js';

describe('featuredLineWidthPx', () => {
  it('thickens a featured path while its object is hovered, as NASA Eyes does', () => {
    // NASA: 1.2 px, 2 px on hover (Reference - NASA Eyes §4.3).
    expect(featuredLineWidthPx(false)).toBe(FEATURED_LINE_WIDTH_PX);
    expect(featuredLineWidthPx(true)).toBeGreaterThan(FEATURED_LINE_WIDTH_PX);
  });
});
