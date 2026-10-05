import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { Vector3, type Points } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { ObjectMeta } from '../../data/catalog-types.js';
import type { FrameState } from '../../simulation/frame-state.js';
import { useViewStore } from '../../state/view-store.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { createPointsGeometry, updateFlagsAttribute } from './points-geometry.js';
import { PICK_LAYER } from './points-shader-core.js';
import { createPointsMaterial } from './points-material.js';
import { usePointsPicking } from './use-points-picking.js';
import {
  INITIAL_HOVER_TRACKING,
  advanceHover,
  resolveEntityIndexToNorad,
  type HoverTracking,
} from './points-pick-resolve.js';
import type { ObjectTetherHandle } from '../../ui/ObjectTether.js';
import { writeTethers } from './points-tether.js';
import { writePerFrameUniforms } from './points-frame-uniforms.js';
import { densityVisibleCount } from './significance-rank.js';

export interface TierZeroPointsHandle {
  requestPick(px: number, py: number): void;
}

interface TierZeroPointsProps {
  readonly objects: readonly ObjectMeta[];
  /** Computed once by the shared parent (`computeRanks`) — `ObjectLabels`
   * needs the identical rank order for label declutter, so this is lifted
   * out rather than computed a second time here. */
  readonly ranks: Uint16Array;
  readonly frameStateRef: MutableRefObject<FrameState>;
  readonly tetherRef: MutableRefObject<ObjectTetherHandle | null>;
  /** The persistent chip on the selected object — optional so other hosts of
   * this component need not adopt it. */
  readonly selectedTetherRef?: MutableRefObject<ObjectTetherHandle | null>;
  /**
   * A plain ref passed as a prop, assigned imperatively — NOT React's
   * `ref`/`forwardRef`/`useImperativeHandle`. Verified live: `forwardRef`
   * silently fails to attach for a component rendered inside R3F's
   * custom reconciler in this project's dependency versions —
   * `useImperativeHandle`'s factory never ran, with no error anywhere.
   * This is the same "ref passed as prop, assigned in an effect" pattern
   * `frameStateRef`/`tetherRef` already use successfully in this exact
   * file, so it sidesteps the broken path entirely rather than fighting it.
   */
  readonly pickHandleRef: MutableRefObject<TierZeroPointsHandle | null>;
  /** The live THREE.Points, for layers that draw the same geometry again
   * (the density heatmap). Assigned once its geometry exists. */
  readonly pointsObjectRef?: MutableRefObject<Points | null>;
}

/**
 * Tier 0 GPU point renderer (brief §B.3): one `THREE.Points`, one draw
 * call, every object in the catalogue. Positions come from M1.2's
 * `FrameState` — the SAME buffer every frame, flagged `needsUpdate`
 * rather than replaced, so this component allocates nothing per frame.
 *
 * Geometry and material are built once inside a mount effect, never in
 * `useMemo` — reading `frameStateRef.current` (needed to wrap the live
 * position buffer) is only safe outside render, and assigning the result
 * straight onto the ref-held `THREE.Points` instance is the same
 * imperative-mutation-via-ref pattern `Satellites.tsx` and
 * `use-simulation-loop.ts` already use elsewhere in this codebase.
 */
export function TierZeroPoints({
  objects,
  ranks,
  frameStateRef,
  tetherRef,
  selectedTetherRef,
  pickHandleRef,
  pointsObjectRef,
}: TierZeroPointsProps) {
  const pointsRef = useRef<Points>(null);
  const { size, camera } = useThree();
  const pick = usePointsPicking(pointsRef);
  const hoverTrackingRef = useRef<HoverTracking>(INITIAL_HOVER_TRACKING);
  const projectedRef = useRef(new Vector3());
  // Looked up twice a frame; a scan of the whole catalogue each time was O(n).
  const indexByNorad = useMemo(() => new Map(objects.map((o, i) => [o.norad, i])), [objects]);

  useEffect(() => {
    pickHandleRef.current = { requestPick: pick.requestPick };
    return () => {
      pickHandleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pickHandleRef is stable for the route's lifetime, same precedent as the other mount effects in this file
  }, []);

  useEffect(() => {
    const points = pointsRef.current;
    if (!points) return;

    const initialDensity = useViewStore.getState().density;
    const geometry = createPointsGeometry(
      objects,
      frameStateRef.current.positions,
      frameStateRef.current.flags,
      useViewStore.getState().activeFilters,
      ranks,
      densityVisibleCount(objects, initialDensity) - 1,
      useViewStore.getState().showDebris,
    );
    const material = createPointsMaterial();

    points.geometry = geometry;
    points.material = material;
    if (pointsObjectRef) pointsObjectRef.current = points;

    return () => {
      if (pointsObjectRef) pointsObjectRef.current = null;
      geometry.dispose();
      material.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- objects/frameStateRef are stable for the route's lifetime, same precedent as use-simulation-loop.ts
  }, []);

  useEffect(() => {
    // Vanilla Zustand subscribe, not the React hook — this runs outside
    // React's render cycle, matching this component's existing "Tier 3
    // never enters React state" discipline from M1.2/M1.3. aFlags is
    // rewritten in place only when the filter set actually changes
    // (brief: "filter re-evaluation on filter change only, never per
    // frame"), never inside useFrame.
    const unsubscribe = useViewStore.subscribe((state, previousState) => {
      if (
        state.activeFilters === previousState.activeFilters &&
        state.density === previousState.density &&
        state.showDebris === previousState.showDebris
      ) {
        return;
      }
      const points = pointsRef.current;
      if (!points) return;
      updateFlagsAttribute(
        points.geometry,
        objects,
        state.activeFilters,
        ranks,
        densityVisibleCount(objects, state.density) - 1,
        state.showDebris,
      );
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- objects is stable for the route's lifetime, same precedent as the mount effect above
  }, []);

  useFrame(() => {
    const points = pointsRef.current;
    if (!points) return;

    // The mount effect above assigns the real geometry imperatively, and
    // it can lose the race against this callback's very first rAF tick
    // (React's passive-effect scheduling isn't guaranteed to land before
    // R3F's next frame) — until it does, `points.geometry` is still
    // THREE.Points's own default empty BufferGeometry, which has no
    // 'position' attribute at all. Bail for that one frame; every frame
    // after the effect lands finds it and proceeds normally.
    const positionAttribute = points.geometry.getAttribute('position');
    if (!positionAttribute) return;

    const material = writePerFrameUniforms(points, positionAttribute, camera, size.height);

    // Advance the pick pipeline by at most one step (brief §D.2/§D.3). The
    // GPU readback resolves on only ~1 frame in N; advanceHover holds the
    // last real resolution across the idle frames so the 2-frame hover
    // debounce can actually elapse (brief §D.4). Write the SelectionStore
    // only when the debounced value actually changes.
    const poll = pick.pollPick();
    const resolved = !poll.resolved
      ? undefined
      : poll.hit === null
        ? null
        : resolveEntityIndexToNorad(poll.hit.entityIndex, objects);
    hoverTrackingRef.current = advanceHover(resolved, hoverTrackingRef.current);
    // Faded out (S4): nothing can be hovered, and the wheel moves no pointer to clear it.
    const hoveredNorad = points.visible ? hoverTrackingRef.current.debounce.value : null;
    if (hoveredNorad !== useSelectionStore.getState().hoveredNorad) {
      useSelectionStore.getState().setHover(hoveredNorad);
    }

    // D6 focus dim: exempt the selected object from the uniform dim via
    // uSelectedEntityId, and only activate the dim at all once something
    // is selected.
    const selectedNorad = useSelectionStore.getState().selectedNorad;
    const selectedIndex = selectedNorad === null ? -1 : (indexByNorad.get(selectedNorad) ?? -1);
    material.uniforms.uSelectedEntityId.value = selectedIndex;
    material.uniforms.uFocusActive.value = selectedNorad === null ? 0.0 : 1.0;

    // Two tethers, one shared projection (brief §D.6: at most one for
    // `selected`, one for `hover`). The SELECTED one is what makes a
    // fly-to legible — without it the target is a 1.5 px dot for most of
    // the flight and the M1.7a review reported not being able to see what
    // it was flying to at all.
    const positions = frameStateRef.current.positions;
    const hoverIndex = hoveredNorad === null ? -1 : (indexByNorad.get(hoveredNorad) ?? -1);
    writeTethers({
      hoverTether: tetherRef.current,
      selectedTether: selectedTetherRef?.current ?? null,
      hoverIndex,
      selectedIndex: points.visible ? selectedIndex : -1, // the tethers fade with the satellites
      positions,
      camera,
      widthPx: size.width,
      heightPx: size.height,
      scratch: projectedRef.current,
    });
  });

  // frustumCulled disabled: three.js would need to recompute the geometry's
  // bounding sphere from `position` every time it changes to cull correctly,
  // which is exactly the per-frame CPU cost this component exists to avoid.
  // onUpdate enables PICK_LAYER in addition to the default layer, so the
  // pick pass's restricted camera can see this object while Earth (which
  // never joins PICK_LAYER) stays excluded.
  return (
    <points ref={pointsRef} frustumCulled={false} onUpdate={(self) => self.layers.enable(PICK_LAYER)} />
  );
}
