import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Line2 } from 'three-stdlib';
import type { FrameState } from '../../simulation/frame-state.js';
import { Flag } from '../../simulation/flags.js';
import type { ObjectMeta } from '../../data/catalog-types.js';
import { buildActiveSet, createActiveSetBuffer } from '../../simulation/active-set.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { featuredIndices, FEATURED_OBJECT_NAMES } from '../paths/featured-norads.js';
import { readRegimeColor } from '../paths/path-regime-tint.js';
import { readCyanToken } from '../scene-colors.js';
import {
  appendIfDue,
  clearTrail,
  createTrailRing,
  readOrdered,
  TRAIL_CAPACITY,
  type TrailRing,
} from './trail-ring.js';
import { writeTrailBuffers } from './trail-geometry.js';
import { reconcilePool } from './trail-pool.js';

interface Props {
  readonly frameStateRef: MutableRefObject<FrameState>;
  readonly objects: readonly ObjectMeta[];
  readonly byNorad: Readonly<Record<string, number>>;
  /** Filled by Tier1Objects each frame — see its `membersRef`/`memberCountRef`. */
  readonly tier1MembersRef: MutableRefObject<Uint32Array | null>;
  readonly tier1CountRef: MutableRefObject<number>;
  /** Bumped once per `scrubTo` — see `useSimulationLoop`. */
  readonly scrubGenerationRef: MutableRefObject<number>;
}

/** Brief §F.6: "for the focus set only (<= 64 objects)." */
const TRAIL_FOCUS_CAP = 64;
const EMPTY_TIER1 = new Uint32Array(0);

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
  occupantIndex: number; // catalogue index; valid only while occupantNorad !== null
  rgb: { r: number; g: number; b: number };
  ring: TrailRing;
  readBuffer: Float32Array; // TRAIL_CAPACITY * 3, reused for readOrdered's output
  positions: Float32Array; // TRAIL_CAPACITY * 3, reused for LineGeometry.setPositions
  colors: Float32Array; // TRAIL_CAPACITY * 4, reused for LineGeometry.setColors(_, 4)
}

function makeSlot(): Slot {
  return {
    occupantNorad: null,
    occupantIndex: -1,
    rgb: { r: 1, g: 1, b: 1 },
    ring: createTrailRing(),
    readBuffer: new Float32Array(TRAIL_CAPACITY * 3),
    positions: new Float32Array(TRAIL_CAPACITY * 3),
    colors: new Float32Array(TRAIL_CAPACITY * 4),
  };
}

/**
 * Recent-history trails for the focus set (brief §F.6): the current
 * selection, hover, the featured set, and every live Tier 1 member —
 * capped at 64, a fixed pool of fat lines reused across whichever
 * objects currently qualify (`trail-pool.ts`'s `reconcilePool`).
 *
 * Zero re-renders after mount, same shape as `OrbitPaths`: fixed JSX,
 * every update an imperative `Line2` geometry write inside `useFrame`.
 * Each occupied slot appends its object's *evaluated* FrameState
 * position (not a fresh SGP4 sample — a trail follows what was actually
 * drawn) at the ring's 10 Hz gate, skipping the append entirely when
 * `Flag.Stale` is set (D-C: a stale position is not real and must not
 * poison the trail). The selected object's trail is `--orca-cyan`;
 * every other occupant is tinted by orbital regime (P4.D24).
 *
 * A scrub (`scrubGenerationRef` changing) clears every ring — brief
 * §F.6: "A trail that spans a scrub is a lie." An ordinary reverse (a
 * rate sign flip) does **not** clear anything; `trail-ring.ts`'s own
 * doc comment explains why that alone makes reverse retract correctly.
 */
export function Trails({
  frameStateRef,
  objects,
  byNorad,
  tier1MembersRef,
  tier1CountRef,
  scrubGenerationRef,
}: Props): React.ReactElement {
  const cyan = useMemo(() => {
    const c = readCyanToken();
    return { r: c.r, g: c.g, b: c.b };
  }, []);

  const featuredBuf = useMemo(() => {
    const buf = new Uint32Array(FEATURED_OBJECT_NAMES.size);
    const n = featuredIndices(objects, buf);
    return { buf, n };
  }, [objects]);

  const slots = useMemo<Slot[]>(() => Array.from({ length: TRAIL_FOCUS_CAP }, makeSlot), []);
  const lineRefs = useRef<(Line2 | null)[]>([]);
  const focusSetBuf = useMemo(() => createActiveSetBuffer(TRAIL_FOCUS_CAP), []);
  // Seeded to a value the real generation (which starts at 0) can never
  // equal on mount, so the first frame's compare is always "changed" —
  // a harmless no-op clear, every ring already starts empty. Reading
  // scrubGenerationRef.current here to seed it would be a render-time
  // ref read, which the React compiler forbids.
  const lastScrubGeneration = useRef(-1);

  const selectedNoradRef = useRef<string | null>(null);
  useEffect(() => {
    const read = (s: { selectedNorad: string | null }) => {
      selectedNoradRef.current = s.selectedNorad;
    };
    read(useSelectionStore.getState());
    return useSelectionStore.subscribe(read);
  }, []);

  function reassignSlot(slot: Slot, k: number, next: string | null, selectedNorad: string | null): void {
    clearTrail(slot.ring);
    if (next === null) {
      slot.occupantNorad = null;
      slot.occupantIndex = -1;
      const line = lineRefs.current[k];
      if (line) line.visible = false;
      return;
    }
    slot.occupantNorad = next;
    slot.occupantIndex = byNorad[next];
    if (next === selectedNorad) {
      slot.rgb = cyan;
    } else {
      const c = readRegimeColor(objects[slot.occupantIndex].regime);
      slot.rgb = { r: c.r, g: c.g, b: c.b };
    }
  }

  function updateSlotGeometry(slot: Slot, k: number, frame: FrameState, epochMs: number): void {
    const line = lineRefs.current[k];
    if (!line) return;
    if (slot.occupantNorad === null) {
      // Enforced every frame, not just on the reconcile transition: an
      // inline ref callback (drei's <Line> pattern OrbitPaths.tsx also
      // uses) gets detached and reattached whenever this component's
      // parent re-renders — which PointsDebugPanel does on every hover
      // change — and React re-fires it with the SAME Line2 instance.
      // Setting `visible` there would fight this loop every time hover
      // moves; keeping the visibility decision here, every frame, makes
      // it immune to that churn regardless of when it happens.
      line.visible = false;
      return;
    }
    const idx = slot.occupantIndex;
    if ((frame.flags[idx] & Flag.Stale) !== 0) return; // D-C: not a real position right now

    const appended = appendIfDue(
      slot.ring,
      epochMs,
      frame.positions[idx * 3],
      frame.positions[idx * 3 + 1],
      frame.positions[idx * 3 + 2],
    );
    if (!appended) return;

    const count = readOrdered(slot.ring, slot.readBuffer);
    if (count < 2) {
      line.visible = false; // a single point is not a line yet
      return;
    }
    writeTrailBuffers(slot.readBuffer, count, slot.rgb, slot.positions, slot.colors);
    line.geometry.setPositions(slot.positions.subarray(0, count * 3));
    line.geometry.setColors(slot.colors.subarray(0, count * 4), 4);
    line.computeLineDistances();
    line.visible = true;
  }

  useFrame(() => {
    const epochMs = frameStateRef.current.epochMs;
    if (epochMs <= 0) return; // the sim clock has not ticked yet

    if (scrubGenerationRef.current !== lastScrubGeneration.current) {
      lastScrubGeneration.current = scrubGenerationRef.current;
      for (const slot of slots) clearTrail(slot.ring);
    }

    // The focus set: selected, hovered, featured, then Tier 1 — brief
    // §F.6, identity before proximity (active-set.ts's own policy).
    const state = useSelectionStore.getState();
    const selectedIndex = state.selectedNorad === null ? -1 : (byNorad[state.selectedNorad] ?? -1);
    const hoveredIndex = state.hoveredNorad === null ? -1 : (byNorad[state.hoveredNorad] ?? -1);
    const tier1 = tier1MembersRef.current ?? EMPTY_TIER1;
    const tier1Count = tier1MembersRef.current ? tier1CountRef.current : 0;
    const focusCount = buildActiveSet(
      {
        selectedIndex,
        hoveredIndex,
        featured: featuredBuf.buf,
        featuredCount: featuredBuf.n,
        tier1,
        tier1Count,
      },
      focusSetBuf,
    );
    const focusNorads: string[] = [];
    for (let i = 0; i < focusCount; i++) focusNorads.push(objects[focusSetBuf[i]].norad);

    const nextOccupants = reconcilePool(slots, focusNorads);
    for (let k = 0; k < slots.length; k++) {
      if (nextOccupants[k] !== slots[k].occupantNorad) {
        reassignSlot(slots[k], k, nextOccupants[k], state.selectedNorad);
      }
    }

    const frame = frameStateRef.current;
    for (let k = 0; k < slots.length; k++) {
      updateSlotGeometry(slots[k], k, frame, epochMs);
    }
  });

  return (
    <group>
      {slots.map((_, k) => (
        <Line
          key={k}
          ref={(l) => {
            // Array bookkeeping ONLY — never mutate the instance here.
            // This inline callback is a new function every render, so
            // React detaches and reattaches it (with the SAME Line2
            // instance) on every parent re-render; any mutation placed
            // here would fight updateSlotGeometry's every-frame writes
            // on a timing race. See updateSlotGeometry's own note.
            lineRefs.current[k] = l as Line2 | null;
          }}
          points={BOOTSTRAP_POINTS}
          vertexColors={BOOTSTRAP_COLORS}
          lineWidth={1.5}
        />
      ))}
    </group>
  );
}
