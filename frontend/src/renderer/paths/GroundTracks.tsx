import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { satrecFromOmm } from '@orcas/physics';
import type { SatRec } from 'satellite.js';
import type { LineSegments2 } from 'three-stdlib';
import type { FrameState } from '../../simulation/frame-state.js';
import type { ObjectMeta } from '../../data/catalog-types.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { readRegimeColor } from './path-regime-tint.js';
import { readCyanToken } from '../scene-colors.js';
import { sampleGroundTrack, DEFAULT_GROUND_TRACK_SAMPLES } from './ground-track.js';
import { toGroundTrackSegments } from './ground-track-split.js';
import { reconcilePool } from '../trails/trail-pool.js';

interface Props {
  readonly frameStateRef: MutableRefObject<FrameState>;
  readonly objects: readonly ObjectMeta[];
  readonly byNorad: Readonly<Record<string, number>>;
  /** Filled by Tier1Objects each frame — see its `activeMembersRef`/`activeCountRef`. */
  readonly activeMembersRef: MutableRefObject<Uint32Array | null>;
  readonly activeCountRef: MutableRefObject<number>;
}

/** Generous vs. today's realistic 0-4-object active set — Tier1Objects.tsx's
 * own note that Tier 1 promotion is rare. Bounds the React element count the
 * same way trail-pool.ts's 64-slot pool bounds Trails.tsx. */
const POOL_CAP = 32;
const RESAMPLE_INTERVAL_MS = 5_000;
const RESAMPLE_EPOCH_DRIFT_MS = 60_000;
const MAX_SEGMENTS = DEFAULT_GROUND_TRACK_SAMPLES - 1;

const BOOTSTRAP_POINTS: [number, number, number][] = [
  [0, 0, 0],
  [0, 0, 0.001],
];
const BOOTSTRAP_COLORS: [number, number, number, number][] = [
  [1, 1, 1, 0],
  [1, 1, 1, 0],
];

interface Slot {
  occupantNorad: string | null;
  occupantIndex: number;
  satrec: SatRec | null;
  rgb: { r: number; g: number; b: number };
  positions: Float32Array; // DEFAULT_GROUND_TRACK_SAMPLES * 3
  azimuthsRad: Float32Array; // DEFAULT_GROUND_TRACK_SAMPLES
  segBuffer: Float32Array; // MAX_SEGMENTS * 6
  colorBuffer: Float32Array; // MAX_SEGMENTS * 2 vertices * 4 (rgba)
  lastWallMs: number;
  lastEpochMs: number;
  drawn: boolean;
}

function makeSlot(): Slot {
  return {
    occupantNorad: null,
    occupantIndex: -1,
    satrec: null,
    rgb: { r: 1, g: 1, b: 1 },
    positions: new Float32Array(DEFAULT_GROUND_TRACK_SAMPLES * 3),
    azimuthsRad: new Float32Array(DEFAULT_GROUND_TRACK_SAMPLES),
    segBuffer: new Float32Array(MAX_SEGMENTS * 6),
    colorBuffer: new Float32Array(MAX_SEGMENTS * 2 * 4),
    lastWallMs: 0,
    lastEpochMs: 0,
    drawn: false,
  };
}

/**
 * Sub-satellite ground tracks for the **active set only** (brief §I M1.7 —
 * never the full catalogue, the featured set, or the trail focus set).
 * Same imperative-per-frame shape as `OrbitPaths`/`Trails`: fixed JSX, a
 * bounded pool of drei `<Line segments>` instances reassigned via
 * `reconcilePool` (reused from `trail-pool.ts`, not forked), resampled at
 * 0.2 Hz like `OrbitPaths`. `segments` renders each pair as an independent
 * `LineSegments2` instance rather than a connected polyline, which is what
 * lets the antimeridian split (`ground-track-split.ts`) leave a real gap
 * instead of drawing a chord through the globe.
 *
 * See `ground-track.ts`'s module doc for why each sample is a radial
 * projection of the satellite's own position, not a true geodetic
 * lat/lon — the scene's Earth mesh does not rotate yet (M1.11).
 */
export function GroundTracks({
  frameStateRef,
  objects,
  byNorad,
  activeMembersRef,
  activeCountRef,
}: Props): React.ReactElement {
  const cyan = useMemo(() => {
    const c = readCyanToken();
    return { r: c.r, g: c.g, b: c.b };
  }, []);

  const slots = useMemo<Slot[]>(() => Array.from({ length: POOL_CAP }, makeSlot), []);
  const lineRefs = useRef<(LineSegments2 | null)[]>([]);

  const selectedNoradRef = useRef<string | null>(null);
  useEffect(() => {
    const read = (s: { selectedNorad: string | null }) => {
      selectedNoradRef.current = s.selectedNorad;
    };
    read(useSelectionStore.getState());
    return useSelectionStore.subscribe(read);
  }, []);

  function reassignSlot(slot: Slot, k: number, next: string | null, selectedNorad: string | null): void {
    if (next === null) {
      slot.occupantNorad = null;
      slot.occupantIndex = -1;
      slot.satrec = null;
      slot.drawn = false;
      const line = lineRefs.current[k];
      if (line) line.visible = false;
      return;
    }
    slot.occupantNorad = next;
    slot.occupantIndex = byNorad[next];
    slot.satrec = satrecFromOmm(objects[slot.occupantIndex].record);
    slot.drawn = false; // force a resample under the new occupant
    if (next === selectedNorad) {
      slot.rgb = cyan;
    } else {
      const c = readRegimeColor(objects[slot.occupantIndex].regime);
      slot.rgb = { r: c.r, g: c.g, b: c.b };
    }
  }

  function resampleIfDue(slot: Slot, line: LineSegments2 | null, wallMs: number, epochMs: number): void {
    if (!line || slot.occupantNorad === null || !slot.satrec) return;
    const due =
      !slot.drawn ||
      wallMs - slot.lastWallMs >= RESAMPLE_INTERVAL_MS ||
      Math.abs(epochMs - slot.lastEpochMs) >= RESAMPLE_EPOCH_DRIFT_MS;
    if (!due) return;
    try {
      sampleGroundTrack({
        satrec: slot.satrec,
        record: objects[slot.occupantIndex].record,
        noradId: slot.occupantNorad,
        atMs: epochMs,
        outPositions: slot.positions,
        outAzimuthsRad: slot.azimuthsRad,
      });
      const { segmentCount } = toGroundTrackSegments(
        slot.positions,
        slot.azimuthsRad,
        DEFAULT_GROUND_TRACK_SAMPLES,
        slot.segBuffer,
      );
      slot.lastWallMs = wallMs;
      slot.lastEpochMs = epochMs;
      slot.drawn = true;
      if (segmentCount === 0) {
        line.visible = false;
        return;
      }
      const vertexCount = segmentCount * 2;
      for (let v = 0; v < vertexCount; v++) {
        slot.colorBuffer[v * 4] = slot.rgb.r;
        slot.colorBuffer[v * 4 + 1] = slot.rgb.g;
        slot.colorBuffer[v * 4 + 2] = slot.rgb.b;
        slot.colorBuffer[v * 4 + 3] = 1;
      }
      line.geometry.setPositions(slot.segBuffer.subarray(0, segmentCount * 6));
      line.geometry.setColors(slot.colorBuffer.subarray(0, vertexCount * 4), 4);
      line.geometry.instanceCount = segmentCount;
      line.computeLineDistances();
      line.visible = true;
    } catch {
      // Decayed / unpropagatable — hide the track, keep the object's point.
      line.visible = false;
      slot.drawn = false;
    }
  }

  useFrame(() => {
    const epochMs = frameStateRef.current.epochMs;
    if (epochMs <= 0) return; // the sim clock has not ticked yet

    const activeNorads: string[] = [];
    const members = activeMembersRef.current;
    if (members) {
      const n = Math.min(activeCountRef.current, POOL_CAP);
      for (let i = 0; i < n; i++) activeNorads.push(objects[members[i]].norad);
    }

    const selectedNorad = selectedNoradRef.current;
    const nextOccupants = reconcilePool(slots, activeNorads);
    for (let k = 0; k < slots.length; k++) {
      if (nextOccupants[k] !== slots[k].occupantNorad) {
        reassignSlot(slots[k], k, nextOccupants[k], selectedNorad);
      }
    }

    const wallMs = performance.now();
    for (let k = 0; k < slots.length; k++) {
      resampleIfDue(slots[k], lineRefs.current[k], wallMs, epochMs);
    }
  });

  return (
    <group>
      {slots.map((_, k) => (
        <Line
          key={k}
          segments
          ref={(l) => {
            // Array bookkeeping ONLY — see Trails.tsx's own note on why an
            // inline ref callback must never mutate the instance here.
            lineRefs.current[k] = l as LineSegments2 | null;
          }}
          points={BOOTSTRAP_POINTS}
          vertexColors={BOOTSTRAP_COLORS}
          lineWidth={1}
        />
      ))}
    </group>
  );
}
