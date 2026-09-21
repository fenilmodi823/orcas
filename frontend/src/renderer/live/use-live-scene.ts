import { useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { useSimulationLoop, type SimulationLoopHandle } from '../../simulation/use-simulation-loop.js';
import { computeRanks } from '../points/significance-rank.js';
import { featuredIndices, FEATURED_OBJECT_NAMES } from '../paths/featured-norads.js';
import { resolveSelectableObject } from '../points/points-selection-resolve.js';
import { useSelectionStore, type SelectableObject } from '../../state/selection-store.js';
import { useSimulationStore } from '../../state/simulation-store.js';
import type { TierZeroPointsHandle } from '../points/TierZeroPoints.js';
import type { ObjectTetherHandle } from '../../ui/ObjectTether.js';
import type { ObjectLabelHandle } from '../../ui/ObjectLabel.js';
import type { ObjectMeta } from '../../data/catalog-types.js';

/** Refs the scene writes each frame. Readouts poll them; nothing re-renders. */
export interface LiveSceneRefs {
  readonly pointsHandleRef: MutableRefObject<TierZeroPointsHandle | null>;
  readonly tetherRef: MutableRefObject<ObjectTetherHandle | null>;
  readonly selectedTetherRef: MutableRefObject<ObjectTetherHandle | null>;
  readonly labelRefs: MutableRefObject<(ObjectLabelHandle | null)[]>;
  readonly viewportRef: MutableRefObject<HTMLDivElement | null>;
  readonly tier1CountRef: MutableRefObject<number>;
  readonly tier1MembersRef: MutableRefObject<Uint32Array | null>;
  readonly activeCountRef: MutableRefObject<number>;
  readonly activeMembersRef: MutableRefObject<Uint32Array | null>;
  readonly camRadiusKmRef: MutableRefObject<number>;
  readonly camTargetDistanceKmRef: MutableRefObject<number>;
}

export interface LiveSceneState {
  readonly objects: readonly ObjectMeta[];
  readonly byNorad: Readonly<Record<string, number>>;
  readonly loop: SimulationLoopHandle;
  readonly ranks: ReturnType<typeof computeRanks>;
  readonly featuredNames: readonly string[];
  readonly refs: LiveSceneRefs;
  readonly resolvedHovered: SelectableObject | null;
  readonly resolvedSelected: SelectableObject | null;
  readonly selectedObjectMeta: ObjectMeta | null;
}

/**
 * Everything the live scene needs that is not JSX — shared by `/` and the
 * `/points` debug route so the two can never drift into two renderers.
 *
 * Time is driven by the simulation store (play/pause, rate), which is what
 * Space and the TimeDock write to. The loop reads refs rather than store
 * state, so the store is mirrored into those refs by subscription: a store
 * change reaches the next frame without re-rendering the scene, which is the
 * "never update React state every frame" rule applied in reverse.
 */
export function useLiveScene(objects: readonly ObjectMeta[], byNorad: Readonly<Record<string, number>>): LiveSceneState {
  const playingRef = useRef(useSimulationStore.getState().playing);
  const rateRef = useRef(useSimulationStore.getState().rate);
  const [startEpochMs] = useState(() => Date.now());
  const loop = useSimulationLoop(objects, playingRef, rateRef, startEpochMs);

  useEffect(
    () =>
      useSimulationStore.subscribe((state) => {
        playingRef.current = state.playing;
        rateRef.current = state.rate;
      }),
    [],
  );

  // Pure function of the catalogue — computed once and shared by
  // TierZeroPoints (density slider) and ObjectLabels (label declutter),
  // rather than sorting the whole catalogue twice per mount.
  const ranks = useMemo(() => computeRanks(objects), [objects]);
  // Same resolved featured list ObjectLabels.tsx computes internally for
  // its own slot indices — deterministic given the same objects array, so
  // the two independent computations always agree on order.
  const featuredNames = useMemo(() => {
    const buf = new Uint32Array(FEATURED_OBJECT_NAMES.size);
    const n = featuredIndices(objects, buf);
    const names: string[] = [];
    for (let i = 0; i < n; i++) names.push(objects[buf[i]].name);
    return names;
  }, [objects]);

  const refs: LiveSceneRefs = {
    pointsHandleRef: useRef<TierZeroPointsHandle>(null),
    tetherRef: useRef<ObjectTetherHandle>(null),
    selectedTetherRef: useRef<ObjectTetherHandle>(null),
    labelRefs: useRef<(ObjectLabelHandle | null)[]>([]),
    viewportRef: useRef<HTMLDivElement>(null),
    tier1CountRef: useRef(0),
    tier1MembersRef: useRef<Uint32Array | null>(null),
    activeCountRef: useRef(0),
    activeMembersRef: useRef<Uint32Array | null>(null),
    camRadiusKmRef: useRef(0),
    camTargetDistanceKmRef: useRef(0),
  };

  const selectedNorad = useSelectionStore((state) => state.selectedNorad);
  const hoveredNorad = useSelectionStore((state) => state.hoveredNorad);
  const frame = loop.frameStateRef.current;

  return {
    objects,
    byNorad,
    loop,
    ranks,
    featuredNames,
    refs,
    resolvedHovered: hoveredNorad === null ? null : resolveSelectableObject(hoveredNorad, objects, byNorad, frame),
    resolvedSelected: selectedNorad === null ? null : resolveSelectableObject(selectedNorad, objects, byNorad, frame),
    selectedObjectMeta: selectedNorad === null ? null : (objects.find((o) => o.norad === selectedNorad) ?? null),
  };
}
