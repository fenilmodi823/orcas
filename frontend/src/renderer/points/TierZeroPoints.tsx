import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { AdditiveBlending, ShaderMaterial, Vector3, type Points } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { WGS84_A_KM, WGS84_B_KM } from '@orcas/physics';
import type { ObjectMeta } from '../../data/catalog-types.js';
import type { FrameState } from '../../simulation/frame-state.js';
import { useViewStore } from '../../state/view-store.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { createPointsGeometry, updateFlagsAttribute } from './points-geometry.js';
import { POINTS_VERTEX_SHADER, PICK_LAYER } from './points-shader-core.js';
import { usePointsPicking } from './use-points-picking.js';
import {
  INITIAL_HOVER_TRACKING,
  advanceHover,
  resolveEntityIndexToNorad,
  type HoverTracking,
} from './points-pick-resolve.js';
import type { ObjectTetherHandle } from '../../ui/ObjectTether.js';
import { writeTetherPosition } from './points-tether.js';
import { LOD_BAND_PX } from '../lod/lod-band.js';
import { writePerFrameUniforms } from './points-frame-uniforms.js';
import { readCyanToken } from '../scene-colors.js';

const FRAGMENT_SHADER = /* glsl */ `
precision mediump float;

varying float vBrightness;
uniform vec3 uColor;

void main() {
  // Soft radial falloff on gl_PointCoord: a Gaussian-ish core plus a
  // faint halo (brief §B.3). The 4.0 / 0.12 constants below are chosen
  // empirically for this task and tuned live in Task 7 — not spec values.
  vec2 fromCenter = gl_PointCoord - vec2(0.5);
  float d = length(fromCenter) * 2.0; // 0 at center, 1 at edge
  float core = exp(-d * d * 4.0);
  float halo = smoothstep(1.0, 0.0, d) * 0.12;
  float alpha = clamp(core + halo, 0.0, 1.0) * vBrightness;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`;

export interface TierZeroPointsHandle {
  requestPick(px: number, py: number): void;
}

interface TierZeroPointsProps {
  readonly objects: readonly ObjectMeta[];
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
}

/** Reads --orca-cyan from tokens.css rather than hardcoding the hex —
 * Rules.md bans colour literals outside tokens.css; a GLSL uniform can't
 * reference a CSS variable directly, so this is the one-time bridge. */
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
  frameStateRef,
  tetherRef,
  selectedTetherRef,
  pickHandleRef,
}: TierZeroPointsProps) {
  const pointsRef = useRef<Points>(null);
  const { size, camera } = useThree();
  const pick = usePointsPicking(pointsRef);
  const hoverTrackingRef = useRef<HoverTracking>(INITIAL_HOVER_TRACKING);
  const projectedRef = useRef(new Vector3());

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

    const geometry = createPointsGeometry(
      objects,
      frameStateRef.current.positions,
      frameStateRef.current.flags,
      useViewStore.getState().activeFilters,
    );
    const material = new ShaderMaterial({
      vertexShader: POINTS_VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uPixelsPerRadian: { value: 0 },
        uMinPointPx: { value: 1.5 }, // chosen empirically, tune in Task 7
        uDpr: { value: Math.min(window.devicePixelRatio, 2) }, // Rules.md perf ceiling: dpr capped at 2
        uBaseBrightness: { value: 1.0 },
        // 0.6, not 0.05: with PLACEHOLDER_RADIUS_KM this small, truePx is
        // always many orders of magnitude below uMinPointPx for every
        // object at any real-world distance, so the area-ratio
        // compensation always crushes brightness to this floor — verified
        // live in Task 7 (a 0.05 floor rendered as an invisible ~2px,
        // 5%-alpha additive dot, indistinguishable from the background).
        // Once real per-object sizes exist, most objects will draw well
        // above the floor and this value matters far less.
        uFloorBrightness: { value: 0.6 },
        uDimFactor: { value: 0.3 }, // D6, Design.md §3 — not invented here
        uLodLoPx: { value: LOD_BAND_PX.loPx },
        uLodHiPx: { value: LOD_BAND_PX.hiPx },
        uFocusActive: { value: 0.0 }, // no selection system until M1.5
        uSelectedEntityId: { value: -1 }, // never matches a real 0-based index until M1.5 wires real selection
        uColor: { value: readCyanToken() },
        uCamPos: { value: new Vector3() },
        uEarthRadii: { value: new Vector3(WGS84_A_KM, WGS84_A_KM, WGS84_B_KM) },
      },
    });

    points.geometry = geometry;
    points.material = material;

    return () => {
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
      if (state.activeFilters === previousState.activeFilters) return;
      const points = pointsRef.current;
      if (!points) return;
      updateFlagsAttribute(points.geometry, objects, state.activeFilters);
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
    const hoveredNorad = hoverTrackingRef.current.debounce.value;
    if (hoveredNorad !== useSelectionStore.getState().hoveredNorad) {
      useSelectionStore.getState().setHover(hoveredNorad);
    }

    // D6 focus dim: exempt the selected object from the uniform dim via
    // uSelectedEntityId, and only activate the dim at all once something
    // is selected.
    const selectedNorad = useSelectionStore.getState().selectedNorad;
    const selectedIndex = selectedNorad === null ? -1 : objects.findIndex((o) => o.norad === selectedNorad);
    material.uniforms.uSelectedEntityId.value = selectedIndex;
    material.uniforms.uFocusActive.value = selectedNorad === null ? 0.0 : 1.0;

    // Two tethers, one shared projection (brief §D.6: at most one for
    // `selected`, one for `hover`). The SELECTED one is what makes a
    // fly-to legible — without it the target is a 1.5 px dot for most of
    // the flight and the M1.7a review reported not being able to see what
    // it was flying to at all.
    const positions = frameStateRef.current.positions;
    const hoverIndex = hoveredNorad === null ? -1 : objects.findIndex((o) => o.norad === hoveredNorad);
    writeTetherPosition(tetherRef.current, hoverIndex, positions, camera, size.width, size.height, projectedRef.current);
    writeTetherPosition(
      selectedTetherRef?.current ?? null,
      // Hide the selected tether while the same object is hovered — two
      // chips stacked on one dot reads as a rendering fault.
      selectedIndex === hoverIndex ? -1 : selectedIndex,
      positions,
      camera,
      size.width,
      size.height,
      projectedRef.current,
    );
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
