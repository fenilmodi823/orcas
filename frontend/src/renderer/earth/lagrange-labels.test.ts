import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { MOON_RADIUS_KM, moonPositionJ2000Km } from '@orcas/physics';
import { LAGRANGE_LABELS, writeLagrangeLabels } from './lagrange-labels.js';

const AT = new Date('2026-10-05T08:00:00Z');
const named = (name: string) => LAGRANGE_LABELS.findIndex((l) => l.name === name);

describe('LAGRANGE_LABELS', () => {
  it('marks L1-L3 as saddle points and L4/L5 as stable (RA5.D8)', () => {
    for (const label of LAGRANGE_LABELS) {
      expect(label.stability).toBe(label.point === 'L4' || label.point === 'L5' ? 'stable' : 'saddle');
    }
  });

  it('leaves out Sun–Earth L3, which is always behind the Sun from here', () => {
    expect(LAGRANGE_LABELS.map((l) => l.name)).not.toContain('Sun–Earth L3');
    expect(LAGRANGE_LABELS).toHaveLength(9);
  });
});

describe('writeLagrangeLabels', () => {
  const m = moonPositionJ2000Km(AT);
  const moon = new Vector3(m.x, m.y, m.z);
  const occluders = [{ centreKm: moon, radiusKm: MOON_RADIUS_KM }];
  // On the Earth side of the Moon, on the Earth–Moon line, looking at the Moon.
  const camera = new PerspectiveCamera(35, 2, 1, 1e7);
  camera.position.copy(moon).multiplyScalar(0.1);
  camera.up.set(0, 0, 1);
  camera.lookAt(moon);
  camera.updateMatrixWorld();
  const out = LAGRANGE_LABELS.map(() => ({ xPx: 0, yPx: 0, visible: false }));
  writeLagrangeLabels(AT, camera, 800, 400, occluders, [], out);

  it('hides Earth–Moon L2 behind the Moon, as NASA hides what is behind a body', () => {
    expect(out[named('Earth–Moon L2')]?.visible).toBe(false);
  });

  it('shows Earth–Moon L1 in front of the Moon, at the centre of the view', () => {
    const l1 = out[named('Earth–Moon L1')];
    expect(l1?.visible).toBe(true);
    expect(l1?.xPx).toBeCloseTo(400, 0);
    expect(l1?.yPx).toBeCloseTo(200, 0);
  });

  // NASA's declutter is weight first: a body's label wins over a computed
  // point's. From near the Earth, Sun–Earth L1 sits on the Sun's label.
  it('hides a point whose label would land on a body label', () => {
    const crowded = LAGRANGE_LABELS.map(() => ({ xPx: 0, yPx: 0, visible: false }));
    const body = { xPx: 410, yPx: 205, visible: true }; // beside Earth–Moon L1
    writeLagrangeLabels(AT, camera, 800, 400, occluders, [body], crowded);
    expect(crowded[named('Earth–Moon L1')]?.visible).toBe(false);
  });

  it('hides the later of two points whose labels would overlap', () => {
    const far = new PerspectiveCamera(35, 2, 1e3, 1e9);
    far.position.set(0, 0, 5e8); // so far out that the Earth's neighbourhood is one spot
    far.lookAt(0, 0, 0);
    far.updateMatrixWorld();
    const stacked = LAGRANGE_LABELS.map(() => ({ xPx: 0, yPx: 0, visible: false }));
    writeLagrangeLabels(AT, far, 800, 400, occluders, [], stacked);
    // Every point within 2 × 10⁶ km of the Earth lands within a few pixels;
    // only the first in list order, Sun–Earth L1, keeps its label.
    const cluster = LAGRANGE_LABELS.flatMap((l, i) =>
      l.system === 'earth-moon' || l.point === 'L1' || l.point === 'L2' ? [stacked[i]?.visible] : [],
    );
    expect(cluster).toEqual([true, false, false, false, false, false, false]);
  });
});
