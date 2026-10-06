import { Vector3, type Camera } from 'three';
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

/** A body's label shows only while its disc is smaller than this radius, CSS px: close up, the body is its own label. */
const LABEL_MAX_DISC_PX = 20;
const EARTH: Occluder = { centreKm: new Vector3(0, 0, 0), radiusKm: WGS84_A_KM };

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

/** A sphere's apparent radius on screen, CSS px. */
function discPx(camera: Camera, body: Occluder, heightPx: number): number {
  const d = camera.position.distanceTo(body.centreKm);
  const r = body.radiusKm;
  if (d <= r) return Infinity;
  // tan of the angular radius, times the projection's focal scale (1 / tan(fov/2)).
  return (r / Math.sqrt(d * d - r * r)) * camera.projectionMatrix.elements[5] * (heightPx / 2);
}

/**
 * Screen positions for body labels, in priority order, into `out`. As NASA
 * Eyes does (Reference §4.2): a label behind any body is hidden, and where two
 * would overlap the earlier, weightier one wins. A body's own label hides
 * while its disc is large, as the focused body's does (S4 for the Earth, S5a
 * for every body). Input: CSS pixels.
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
    const body = input.isEarth ? EARTH : input.self;
    if (body && discPx(camera, body, cssHeight) > LABEL_MAX_DISC_PX) target.visible = false;
    if (target.visible && hiddenByBody(camera.position, input.pointKm, occluders, input.self)) target.visible = false;
    for (let j = 0; j < i && target.visible; j++) if (crowds(target, out[j])) target.visible = false;
  });
}
