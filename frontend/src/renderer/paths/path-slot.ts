import type { SatRec } from 'satellite.js';
import { DEFAULT_PATH_SAMPLES } from './orbit-path.js';

/** Line widths in CSS px. NASA Eyes draws its lines 1.2 px, 2 px on hover
 * (Reference - NASA Eyes §4.3); ORCAS's featured paths keep their 1.5 px and
 * thicken by the same proportion on hover. */
export const FEATURED_LINE_WIDTH_PX = 1.5;
export const HOVERED_LINE_WIDTH_PX = 2.5;
export const SELECTION_LINE_WIDTH_PX = 2;

/** A featured path's width: thicker while its object is hovered (S1). */
export function featuredLineWidthPx(hovered: boolean): number {
  return hovered ? HOVERED_LINE_WIDTH_PX : FEATURED_LINE_WIDTH_PX;
}

/**
 * Bootstraps the LineGeometry with itemSize-4 (RGBA) colours; the real
 * geometry is pushed in imperatively on the first resample.
 *
 * ⚠️ Alpha 0 is what hides this, not a `visible` prop: drei's `<Line>`
 * spreads every prop it doesn't recognise onto *both* the mesh and its
 * material (see its source), so a `visible={false}` passed here would
 * set `material.visible = false` once at mount — a value `pushGeometry`
 * in OrbitPaths.tsx has no reason to ever touch — and the line would stay invisible
 * forever, resampled or not. Found live-verifying M1.7b: zero draw calls
 * ever fired despite correct geometry and `line.visible === true`.
 */
export const BOOTSTRAP_POINTS: [number, number, number][] = [
  [0, 0, 0],
  [0, 0, 0.001],
];
export const BOOTSTRAP_COLORS: [number, number, number, number][] = [
  [1, 1, 1, 0],
  [1, 1, 1, 0],
];

export interface PathSlot {
  index: number; // catalogue index
  noradId: string;
  satrec: SatRec;
  rgb: { r: number; g: number; b: number }; // read once from the tokens
  sample: Float32Array; // DEFAULT_PATH_SAMPLES * 3 — sampleOrbitPath's out
  positions: Float32Array; // DEFAULT_PATH_SAMPLES * 3 — absolute km, written at resample
  cameraRelative: Float32Array; // DEFAULT_PATH_SAMPLES * 3 — `positions` minus the camera, refreshed every frame
  colors: Float32Array; // DEFAULT_PATH_SAMPLES * 4 — LineGeometry.setColors(_, 4)
  lastWallMs: number;
  lastEpochMs: number;
  drawn: boolean;
}

export function makeSlot(
  index: number,
  noradId: string,
  satrec: SatRec,
  rgb: { r: number; g: number; b: number },
): PathSlot {
  return {
    index,
    noradId,
    satrec,
    rgb,
    sample: new Float32Array(DEFAULT_PATH_SAMPLES * 3),
    positions: new Float32Array(DEFAULT_PATH_SAMPLES * 3),
    cameraRelative: new Float32Array(DEFAULT_PATH_SAMPLES * 3),
    colors: new Float32Array(DEFAULT_PATH_SAMPLES * 4),
    lastWallMs: 0,
    lastEpochMs: 0,
    drawn: false,
  };
}
