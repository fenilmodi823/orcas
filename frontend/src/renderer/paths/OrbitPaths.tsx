import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { satrecFromOmm } from '@orcas/physics';
import type { SatRec } from 'satellite.js';
import type { Line2 } from 'three-stdlib';
import type { FrameState } from '../../simulation/frame-state.js';
import type { ObjectMeta } from '../../data/catalog-types.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { readRegimeColor } from './path-regime-tint.js';
import { readCyanToken } from '../scene-colors.js';
import { featuredIndices, FEATURED_OBJECT_NAMES } from './featured-norads.js';
import { sampleOrbitPath, DEFAULT_PATH_SAMPLES } from './orbit-path.js';
import { writePathBuffers } from './path-geometry.js';

interface Props {
  readonly frameStateRef: MutableRefObject<FrameState>;
  readonly objects: readonly ObjectMeta[];
  readonly byNorad: Readonly<Record<string, number>>;
}

/** Brief §F.6: resample at 0.2 Hz — never per frame. Also resample when
 * the sim clock has jumped further than RESAMPLE_EPOCH_DRIFT_MS (a scrub,
 * or a fast rate outrunning the wall-clock cadence), so the span stays
 * centred on the object. */
const RESAMPLE_INTERVAL_MS = 5_000;
const RESAMPLE_EPOCH_DRIFT_MS = 60_000;

/** Bootstraps the LineGeometry with itemSize-4 colours; the real geometry
 * is pushed in imperatively on the first resample. */
const BOOTSTRAP_POINTS: [number, number, number][] = [
  [0, 0, 0],
  [0, 0, 0.001],
];
const BOOTSTRAP_COLORS: [number, number, number, number][] = [
  [1, 1, 1, 0],
  [1, 1, 1, 0],
];

interface PathSlot {
  index: number; // catalogue index
  noradId: string;
  satrec: SatRec;
  rgb: { r: number; g: number; b: number }; // read once from the tokens
  sample: Float32Array; // DEFAULT_PATH_SAMPLES * 3 — sampleOrbitPath's out
  positions: Float32Array; // DEFAULT_PATH_SAMPLES * 3 — LineGeometry.setPositions
  colors: Float32Array; // DEFAULT_PATH_SAMPLES * 4 — LineGeometry.setColors(_, 4)
  lastWallMs: number;
  lastEpochMs: number;
  drawn: boolean;
}

function makeSlot(
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
    colors: new Float32Array(DEFAULT_PATH_SAMPLES * 4),
    lastWallMs: 0,
    lastEpochMs: 0,
    drawn: false,
  };
}

/**
 * Permanent orbit paths for the featured set, plus one for the current
 * selection (brief §I M1.7, §F.6). Each path is one fat line (drei
 * <Line> -> Line2), propagated through SGP4 in J2000, resampled at
 * 0.2 Hz. Featured lines are tinted by orbital regime (P4.D24); the
 * selection line is --orca-cyan.
 *
 * Zero re-renders after mount — fixed JSX, every update an imperative
 * write into the Line2 geometry inside useFrame, exactly the shape of
 * Tier1Objects / TierZeroPoints. Selection arrives through a store
 * subscription into a ref.
 *
 * ponytail: one draw call per line (~15-20), well inside the §G budget
 * (Q9.3 raises it to 60). Batch into one LineSegments2 only if draw
 * calls bite at M1.8.
 * ponytail: line geometry is world-space, not camera-relative — a path
 * can show ~0.5 m of float32 shimmer within a few hundred metres of a
 * featured object. Invisible at normal viewing distance.
 */
export function OrbitPaths({ frameStateRef, objects, byNorad }: Props): React.ReactElement {
  const cyan = useMemo(() => {
    const c = readCyanToken();
    return { r: c.r, g: c.g, b: c.b };
  }, []);

  const featuredSlots = useMemo<PathSlot[]>(() => {
    const buf = new Uint32Array(FEATURED_OBJECT_NAMES.size);
    const n = featuredIndices(objects, buf);
    const slots: PathSlot[] = [];
    for (let k = 0; k < n; k++) {
      const i = buf[k];
      const c = readRegimeColor(objects[i].regime);
      slots.push(
        makeSlot(i, objects[i].norad, satrecFromOmm(objects[i].record), { r: c.r, g: c.g, b: c.b }),
      );
    }
    return slots;
  }, [objects]);

  const featuredLineRefs = useRef<(Line2 | null)[]>([]);
  const selectionLineRef = useRef<Line2 | null>(null);

  const selectedNoradRef = useRef<string | null>(null);
  useEffect(() => {
    const read = (s: { selectedNorad: string | null }) => {
      selectedNoradRef.current = s.selectedNorad;
    };
    read(useSelectionStore.getState());
    return useSelectionStore.subscribe(read);
  }, []);
  const selectedSlotRef = useRef<PathSlot | null>(null);

  function pushGeometry(line: Line2, slot: PathSlot): void {
    line.geometry.setPositions(slot.positions);
    line.geometry.setColors(slot.colors, 4);
    line.geometry.instanceCount = DEFAULT_PATH_SAMPLES - 1;
    line.computeLineDistances();
    line.visible = true;
    slot.drawn = true;
  }

  function resampleIfDue(slot: PathSlot, line: Line2 | null, wallMs: number, epochMs: number): void {
    if (!line) return;
    const due =
      !slot.drawn ||
      wallMs - slot.lastWallMs >= RESAMPLE_INTERVAL_MS ||
      Math.abs(epochMs - slot.lastEpochMs) >= RESAMPLE_EPOCH_DRIFT_MS;
    if (!due) return;
    try {
      sampleOrbitPath({
        satrec: slot.satrec,
        record: objects[slot.index].record,
        noradId: slot.noradId,
        atMs: epochMs,
        out: slot.sample,
      });
      writePathBuffers(slot.sample, DEFAULT_PATH_SAMPLES, slot.rgb, slot.positions, slot.colors);
      pushGeometry(line, slot);
      slot.lastWallMs = wallMs;
      slot.lastEpochMs = epochMs;
    } catch {
      // Decayed / unpropagatable — hide the line, keep the object's point.
      line.visible = false;
      slot.drawn = false;
    }
  }

  useFrame(() => {
    const wallMs = performance.now();
    const epochMs = frameStateRef.current.epochMs;
    if (epochMs <= 0) return; // the sim clock has not ticked yet

    for (let k = 0; k < featuredSlots.length; k++) {
      resampleIfDue(featuredSlots[k], featuredLineRefs.current[k] ?? null, wallMs, epochMs);
    }

    const norad = selectedNoradRef.current;
    const line = selectionLineRef.current;
    if (norad === null) {
      selectedSlotRef.current = null;
      if (line) line.visible = false;
    } else if (selectedSlotRef.current?.noradId !== norad) {
      const i = byNorad[norad];
      selectedSlotRef.current =
        i === undefined ? null : makeSlot(i, norad, satrecFromOmm(objects[i].record), cyan);
      if (line) line.visible = false;
    }
    if (selectedSlotRef.current) resampleIfDue(selectedSlotRef.current, line, wallMs, epochMs);
  });

  return (
    <group>
      {featuredSlots.map((slot, k) => (
        <Line
          key={slot.noradId}
          ref={(l) => {
            featuredLineRefs.current[k] = l as Line2 | null;
          }}
          points={BOOTSTRAP_POINTS}
          vertexColors={BOOTSTRAP_COLORS}
          lineWidth={1.5}
          visible={false}
        />
      ))}
      <Line
        ref={(l) => {
          selectionLineRef.current = l as Line2 | null;
        }}
        points={BOOTSTRAP_POINTS}
        vertexColors={BOOTSTRAP_COLORS}
        lineWidth={2}
        visible={false}
      />
    </group>
  );
}
