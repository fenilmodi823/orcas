import { describe, expect, it } from 'vitest';
import { createSatelliteProxyGeometry } from './satellite-proxy.js';

describe('createSatelliteProxyGeometry', () => {
  // The proxy is drawn at TIER1_PROXY_SCALE_KM, and the LOD band decides
  // promotion from that same assumed extent. A vertex outside the unit
  // sphere would render the object bigger than the maths claimed.
  it('fits inside the unit sphere the LOD band assumes', () => {
    const g = createSatelliteProxyGeometry();
    const p = g.getAttribute('position');
    let maxSq = 0;
    for (let i = 0; i < p.count; i++) {
      maxSq = Math.max(maxSq, p.getX(i) ** 2 + p.getY(i) ** 2 + p.getZ(i) ** 2);
    }
    expect(Math.sqrt(maxSq)).toBeLessThanOrEqual(1);
    g.dispose();
  });

  // The whole point of replacing the regular octahedron: nadir has to be
  // visible. A shape symmetric about the nadir axis cannot show it.
  it('is asymmetric along the nadir axis, so which end faces Earth is visible', () => {
    const g = createSatelliteProxyGeometry();
    const p = g.getAttribute('position');
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < p.count; i++) {
      minY = Math.min(minY, p.getY(i));
      maxY = Math.max(maxY, p.getY(i));
    }
    expect(maxY).toBeGreaterThan(Math.abs(minY) * 1.2);
    g.dispose();
  });

  it('stays cheap enough for the 2,000-instance cap', () => {
    const g = createSatelliteProxyGeometry();
    expect(g.getAttribute('position').count / 3).toBeLessThanOrEqual(64);
    g.dispose();
  });
});
