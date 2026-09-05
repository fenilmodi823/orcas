import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { FrameState } from '../../simulation/frame-state.js';
import type { ObjectMeta } from '../../data/catalog-types.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { featuredIndices, FEATURED_OBJECT_NAMES } from '../paths/featured-norads.js';
import { computeLabelOpacities, type LabelCandidate } from './object-label-layout.js';
import type { ObjectLabelHandle } from '../../ui/ObjectLabel.js';

/** Hard cap on simultaneously-visible non-exempt labels (P4.D28). */
const LABEL_CAP = 12;
/** One slot per featured object plus one dynamic slot for "the current
 * selection, if it isn't already featured" — mirrors OrbitPaths.tsx's own
 * "static featured slots + one selection slot" shape exactly; the
 * candidate set here only ever changes on a selection click, never per
 * frame, so it needs none of Trails.tsx's pool-reconciliation machinery. */
/** Exported so PointsDebug.tsx renders exactly this many DOM `<ObjectLabel>`
 * elements — one per slot this component writes into. */
export const LABEL_SLOT_COUNT = FEATURED_OBJECT_NAMES.size + 1;
const SLOT_COUNT = LABEL_SLOT_COUNT;
const SELECTION_SLOT = SLOT_COUNT - 1;
/** Placeholder rank for an empty slot — always loses the cap ordering
 * (significance-rank.ts never produces a rank this high). */
const EMPTY_RANK = 65535;

interface MutableCandidate {
  xPx: number;
  yPx: number;
  rank: number;
  visible: boolean;
}

function makeCandidate(): MutableCandidate {
  return { xPx: 0, yPx: 0, rank: EMPTY_RANK, visible: false };
}

interface Props {
  readonly frameStateRef: MutableRefObject<FrameState>;
  readonly objects: readonly ObjectMeta[];
  readonly byNorad: Readonly<Record<string, number>>;
  readonly ranks: Uint16Array;
  /** Camera distance from Earth's centre — the same signal `Tier1Readout`
   * already displays. Reused as-is for the label distance fade. */
  readonly camRadiusKmRef: MutableRefObject<number>;
  /** One entry per slot (`SLOT_COUNT`), written imperatively each frame —
   * the actual `<ObjectLabel>` DOM elements live outside the Canvas in
   * PointsDebug.tsx, same cross-boundary ref pattern `points-tether.ts`
   * already uses for the hover/selection tethers. */
  readonly labelRefs: MutableRefObject<(ObjectLabelHandle | null)[]>;
}

/**
 * Label declutter (P4.D28): projects each candidate's live position,
 * computes its opacity via `object-label-layout.ts`, and writes both
 * through refs into the DOM `<ObjectLabel>` elements. Returns null — all
 * of this component's work is the side effect of the per-frame writes.
 */
export function ObjectLabels({ frameStateRef, objects, byNorad, ranks, camRadiusKmRef, labelRefs }: Props): null {
  const { camera, size } = useThree();

  const featuredBuf = useMemo(() => {
    const buf = new Uint32Array(FEATURED_OBJECT_NAMES.size);
    const n = featuredIndices(objects, buf);
    return { buf, n };
  }, [objects]);

  // slotIndex[k] = catalogue index occupying label slot k, or -1 if empty.
  // Featured slots are fixed once per catalogue load; only the last
  // (selection) slot changes at runtime, inside useFrame below.
  const slotIndex = useRef(new Int32Array(SLOT_COUNT).fill(-1));
  useEffect(() => {
    const arr = slotIndex.current;
    arr.fill(-1);
    for (let k = 0; k < featuredBuf.n; k++) arr[k] = featuredBuf.buf[k];
  }, [featuredBuf]);

  const scratch = useMemo(() => new Vector3(), []);
  // useRef, not useMemo: these entries are mutated in place every frame
  // inside useFrame below, and the React Compiler's hooks-immutability
  // rule forbids mutating a memoised value after render (see Trails.tsx's
  // own note on hitting the identical rule for its head-marker buffer).
  const candidatesRef = useRef<MutableCandidate[]>(Array.from({ length: SLOT_COUNT }, makeCandidate));

  useFrame(() => {
    const epochMs = frameStateRef.current.epochMs;
    if (epochMs <= 0) return; // the sim clock has not ticked yet

    const state = useSelectionStore.getState();
    const selectedIndex = state.selectedNorad === null ? -1 : (byNorad[state.selectedNorad] ?? -1);

    let alreadyFeatured = false;
    for (let k = 0; k < SELECTION_SLOT; k++) {
      if (slotIndex.current[k] === selectedIndex) {
        alreadyFeatured = true;
        break;
      }
    }
    slotIndex.current[SELECTION_SLOT] = selectedIndex !== -1 && !alreadyFeatured ? selectedIndex : -1;

    const positions = frameStateRef.current.positions;
    const widthPx = size.width;
    const heightPx = size.height;
    const candidates = candidatesRef.current;
    let selectedSlot = -1;

    for (let k = 0; k < SLOT_COUNT; k++) {
      const idx = slotIndex.current[k];
      const candidate = candidates[k];
      if (idx === -1) {
        candidate.visible = false;
        candidate.rank = EMPTY_RANK;
        continue;
      }
      scratch.set(positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2]).project(camera);
      // z > 1 is behind the camera — same test points-tether.ts's
      // writeTetherPosition makes, for the same reason (a target behind
      // you otherwise draws mirrored across the screen).
      candidate.visible = scratch.z <= 1;
      candidate.xPx = (scratch.x * 0.5 + 0.5) * widthPx;
      candidate.yPx = (1 - (scratch.y * 0.5 + 0.5)) * heightPx;
      candidate.rank = ranks[idx];
      if (idx === selectedIndex) selectedSlot = k;
    }

    const opacities = computeLabelOpacities({
      candidates: candidates as readonly LabelCandidate[],
      selectedSlot,
      camRadiusKm: camRadiusKmRef.current,
      cap: LABEL_CAP,
    });

    for (let k = 0; k < SLOT_COUNT; k++) {
      const handle = labelRefs.current[k];
      if (!handle) continue;
      const candidate = candidates[k];
      if (candidate.visible) handle.setPosition(candidate.xPx, candidate.yPx);
      handle.setOpacity(opacities[k]);
    }
  });

  return null;
}
