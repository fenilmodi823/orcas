import type { Camera, Vector3 } from 'three';
import { WGS84_A_KM } from '@orcas/physics';
import { DENSITY_RADIUS_PX } from '../points/object-label-layout.js';
import { bodyScreenPosition, sphereBlocks, type BodyScreenPosition } from './body-screen.js';

/** A body that hides what is behind it: the Sun, the Moon, a planet. The Earth's ellipsoid is tested separately. */
export interface Occluder {
  readonly centreKm: Vector3;
  readonly radiusKm: number;
}

export interface BodyLabelInput {
  readonly pointKm: Vector3;
  /** The body this label names, so its own sphere never hides it. */
  readonly self: Occluder | null;
  /** The Earth: its own surface must not hide it, and it goes while the camera is close. */
  readonly isEarth?: boolean;
}

/** The Earth's label shows once the Earth's disc is smaller than this radius, CSS px. */
const EARTH_LABEL_MAX_DISC_PX = 20;

/** Is the line from `fromKm` to `pointKm` blocked by any occluder other than `self`? Input: km, scene frame. */
export function hiddenByBody(
  fromKm: Vector3,
  pointKm: Vector3,
  occluders: readonly Occluder[],
  self: Occluder | null,
): boolean {
  return occluders.some((o) => o !== self && sphereBlocks(fromKm, pointKm, o.centreKm, o.radiusKm));
}

/** Two visible labels whose anchors sit closer than ORCAS's 60 px declutter radius. */
export function crowds(a: BodyScreenPosition, b: BodyScreenPosition | undefined): boolean {
  return b !== undefined && b.visible && Math.hypot(a.xPx - b.xPx, a.yPx - b.yPx) < DENSITY_RADIUS_PX;
}

/** The Earth's apparent radius on screen, CSS px. */
function earthDiscPx(camera: Camera, heightPx: number): number {
  const d = camera.position.length();
  if (d <= WGS84_A_KM) return Infinity;
  // tan of the angular radius, times the projection's focal scale (1 / tan(fov/2)).
  return (WGS84_A_KM / Math.sqrt(d * d - WGS84_A_KM * WGS84_A_KM)) * camera.projectionMatrix.elements[5] * (heightPx / 2);
}

/**
 * Screen positions for body labels, in priority order, into `out`. As NASA
 * Eyes does (Reference §4.2): a label behind any body is hidden, and where two
 * would overlap the earlier, weightier one wins. The Earth's own label hides
 * while the camera is close, as the focused body's does. Input: CSS pixels.
 */
export function layoutBodyLabels(
  camera: Camera,
  cssWidth: number,
  cssHeight: number,
  inputs: readonly BodyLabelInput[],
  occluders: readonly Occluder[],
  out: BodyScreenPosition[],
): void {
  inputs.forEach((input, i) => {
    const target = out[i];
    if (!target) return;
    bodyScreenPosition(input.pointKm, camera, cssWidth, cssHeight, target, !input.isEarth);
    if (input.isEarth && earthDiscPx(camera, cssHeight) > EARTH_LABEL_MAX_DISC_PX) target.visible = false;
    if (target.visible && hiddenByBody(camera.position, input.pointKm, occluders, input.self)) target.visible = false;
    for (let j = 0; j < i && target.visible; j++) if (crowds(target, out[j])) target.visible = false;
  });
}
