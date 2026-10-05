import { Vector3, type Camera } from 'three';
import { earthMoonLagrangeJ2000Km, sunEarthLagrangeJ2000Km, type LagrangePoints } from '@orcas/physics';
import { bodyScreenPosition, type BodyScreenPosition } from './body-screen.js';
import { crowds, hiddenByBody, type Occluder } from './body-label-layout.js';

export interface LagrangeLabel {
  readonly name: string;
  readonly system: 'sun-earth' | 'earth-moon';
  readonly point: keyof LagrangePoints;
  /** L1–L3 are saddle points of the potential; L4 and L5 are stable (RA5.D8). */
  readonly stability: 'saddle' | 'stable';
}

const label = (system: LagrangeLabel['system'], point: LagrangeLabel['point']): LagrangeLabel => ({
  name: `${system === 'sun-earth' ? 'Sun–Earth' : 'Earth–Moon'} ${point}`,
  system,
  point,
  stability: point === 'L4' || point === 'L5' ? 'stable' : 'saddle',
});

/**
 * S2's cislunar geometry. Sun–Earth L3 is left out: it lies on the far side of
 * the Sun, so from anywhere in the Earth regime it is behind the Sun, and NASA
 * Eyes draws nothing behind a body.
 */
export const LAGRANGE_LABELS: readonly LagrangeLabel[] = [
  label('sun-earth', 'L1'),
  label('sun-earth', 'L2'),
  label('sun-earth', 'L4'),
  label('sun-earth', 'L5'),
  label('earth-moon', 'L1'),
  label('earth-moon', 'L2'),
  label('earth-moon', 'L3'),
  label('earth-moon', 'L4'),
  label('earth-moon', 'L5'),
];

/** Said on screen: these are computed locations, not tracked objects (RA5.D2, Rules §7). */
export const LAGRANGE_CREDIT = 'Lagrange points: computed from the circular restricted three-body model, not observed.';

const _point = new Vector3();

/**
 * Screen positions for `LAGRANGE_LABELS`, in order, into `out`. A point is
 * hidden behind the Earth or any of `occluders`, and where its label would
 * crowd a body's (`bodies`) or an earlier point's: NASA Eyes declutters by
 * weight first, and a body outweighs a computed point. Input: UTC Date;
 * occluders in km, J2000; the viewport and `bodies` in CSS pixels.
 */
export function writeLagrangeLabels(
  at: Date,
  camera: Camera,
  cssWidth: number,
  cssHeight: number,
  occluders: readonly Occluder[],
  bodies: readonly BodyScreenPosition[],
  out: BodyScreenPosition[],
): void {
  const points = { 'sun-earth': sunEarthLagrangeJ2000Km(at), 'earth-moon': earthMoonLagrangeJ2000Km(at) };
  LAGRANGE_LABELS.forEach((l, i) => {
    const target = out[i];
    if (!target) return;
    const p = points[l.system][l.point];
    _point.set(p.x, p.y, p.z);
    bodyScreenPosition(_point, camera, cssWidth, cssHeight, target);
    if (target.visible && hiddenByBody(camera.position, _point, occluders, null)) target.visible = false;
    if (target.visible && bodies.some((b) => crowds(target, b))) target.visible = false;
    for (let j = 0; j < i && target.visible; j++) if (crowds(target, out[j])) target.visible = false;
  });
}
