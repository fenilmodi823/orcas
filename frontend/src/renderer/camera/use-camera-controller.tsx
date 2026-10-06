import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { hasPosition, type FrameState } from '../../simulation/frame-state.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { usePlanetEphemeris } from '../../data/use-planet-ephemeris.js';
import { bodyById } from '../solar/bodies.js';
import { bodyTarget, ECLIPTIC_NORTH_J2000, homeOffsetKm } from '../solar/body-target.js';
import { createCameraSystem, type CameraSystem } from './camera-system.js';
import { dragToManualInput, wheelToManualInput } from './manual-input.js';
import { useCameraTunables } from './camera-tunables.js';
import { useCameraStatus } from './camera-status.js';
import { useReducedMotion } from '../../state/use-reduced-motion.js';

const CROSSFADE_CLASS = 'live-scene--crossfade';

interface Args {
  readonly frameStateRef: MutableRefObject<FrameState>;
  readonly byNorad: Readonly<Record<string, number>>;
  readonly canvasContainerRef: MutableRefObject<HTMLElement | null>;
  /** Written every frame for the dev panel's readout. A ref, not state —
   * this is the per-frame path. */
  readonly radiusKmRef?: MutableRefObject<number>;
  /** Camera-to-object distance, which is what actually decides whether
   * anything is on screen. See CameraSystem.targetDistanceKm. */
  readonly targetDistanceKmRef?: MutableRefObject<number>;
}

/**
 * Owns a `CameraSystem` for the route's lifetime and wires it to R3F, the
 * pointer, the selection store and Esc. The system itself is headless — this
 * hook is the only place it touches React / the DOM (brief §C.13, §D.5).
 */
export function useCameraController({
  frameStateRef,
  byNorad,
  canvasContainerRef,
  radiusKmRef,
  targetDistanceKmRef,
}: Args): void {
  const { camera } = useThree();
  const reducedMotion = useReducedMotion();
  const sysRef = useRef<CameraSystem | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  // A selection made before the loop has a position for it (a cold start,
  // or a link opened with `object=`). Flying then would aim at the Earth's
  // centre, so the flight waits here until the slot is written.
  const pendingTargetRef = useRef(-1);
  // The same for a body (S5a): a planet has no position until the DE421 bake loads.
  const pendingBodyRef = useRef<string | null>(null);
  const followBodyRef = useRef<((id: string) => void) | null>(null);
  const ephemerisRef = usePlanetEphemeris();
  // dev-panel tunables read via a ref so the mount-effect listeners always
  // see the current value without re-subscribing.
  const tunablesRef = useRef(useCameraTunables.getState());
  useEffect(() => useCameraTunables.subscribe((s) => (tunablesRef.current = s)), []);

  useEffect(() => {
    const container = canvasContainerRef.current;
    const onCrossFade = () => {
      if (!container) return;
      container.classList.add(CROSSFADE_CLASS);
      window.setTimeout(() => container.classList.remove(CROSSFADE_CLASS), 260);
    };
    const sys = createCameraSystem(camera as PerspectiveCamera, {
      reducedMotion,
      onCrossFade,
    });
    sysRef.current = sys;
    // One inert frame so the system has a FrameState before any selection
    // event (which could fire before R3F's first useFrame tick) reaches flyTo.
    sys.update(0, frameStateRef.current);

    // selection → camera. Vanilla subscribe, outside React's render cycle.
    const follow = (norad: string | null) => {
      pendingTargetRef.current = -1;
      pendingBodyRef.current = null;
      const index = norad === null ? undefined : byNorad[norad];
      if (index !== undefined && !hasPosition(frameStateRef.current, index)) {
        pendingTargetRef.current = index;
        return;
      }
      const p = norad === null ? sys.flyToEarth() : index === undefined ? Promise.resolve() : sys.flyTo(index);
      p.catch(() => undefined); // CancelledError when superseded — expected
    };
    const followBody = (id: string) => {
      pendingTargetRef.current = -1;
      pendingBodyRef.current = null;
      const body = bodyById(id);
      if (!body) return;
      const target = bodyTarget(body, ephemerisRef);
      const epochMs = frameStateRef.current.epochMs;
      if (epochMs <= 0 || !target.positionKm(epochMs, new Vector3())) {
        pendingBodyRef.current = id;
        return;
      }
      sys.flyToBody(target).catch(() => undefined);
    };
    followBodyRef.current = followBody;
    let homing = false; // the home view clears the selection without flying back to the Earth
    const unsub = useSelectionStore.subscribe((state, prev) => {
      if (homing) return;
      if (state.selectedBody !== prev.selectedBody && state.selectedBody !== null) return followBody(state.selectedBody);
      if (state.selectedNorad !== prev.selectedNorad && state.selectedNorad !== null) return follow(state.selectedNorad);
      const changed = state.selectedNorad !== prev.selectedNorad || state.selectedBody !== prev.selectedBody;
      if (changed && state.selectedNorad === null && state.selectedBody === null) follow(null);
    });
    // A link's `object=` is applied by the dock's effect, outside the Canvas,
    // before R3F mounts this and subscribes; follow it now or it never flies.
    const initial = useSelectionStore.getState();
    if (initial.selectedBody !== null) followBody(initial.selectedBody);
    else if (initial.selectedNorad !== null) follow(initial.selectedNorad);

    // The breadcrumb's root: NASA Eyes' home, the Sun from 7 × 10⁸ km, 25° above the ecliptic.
    const unsubHome = useCameraStatus.subscribe((state, prev) => {
      const sun = bodyById('sun');
      const epochMs = frameStateRef.current.epochMs;
      if (state.homeRequests === prev.homeRequests || !sun || epochMs <= 0) return;
      const target = { ...bodyTarget(sun, ephemerisRef), key: 'home' };
      const sunKm = target.positionKm(epochMs, new Vector3());
      if (!sunKm) return;
      homing = true;
      useSelectionStore.getState().clearSelection();
      homing = false;
      pendingTargetRef.current = -1;
      pendingBodyRef.current = null;
      const arrivalOffsetKm = homeOffsetKm(camera.position, sunKm, new Vector3());
      sys.flyToBody(target, { arrivalOffsetKm, refUp: ECLIPTIC_NORTH_J2000.clone(), spin: false }).catch(() => undefined);
    });

    // "Reset view & tunables" → actually reset the view. The selection
    // subscription above short-circuits on an unchanged id, so when nothing
    // is selected — the common case while orbiting freely — clearing the
    // selection is a no-op and the zoom/orbit stayed where it was. This is
    // the explicit command the panel had no way to send.
    const unsubReset = useCameraStatus.subscribe((state, prev) => {
      if (state.resetRequests === prev.resetRequests) return;
      const { selectedNorad, selectedBody } = useSelectionStore.getState();
      const wasSelected = selectedNorad !== null || selectedBody !== null;
      useSelectionStore.getState().clearSelection();
      if (!wasSelected) sys.flyToEarth().catch(() => undefined);
    });

    // Esc → clear selection (which the subscription turns into flyToEarth).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useSelectionStore.getState().clearSelection();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) dragRef.current = { x: e.clientX, y: e.clientY };
    };
    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || (e.buttons & 1) === 0) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      sys.applyManualInput(dragToManualInput(dx, dy, tunablesRef.current.dragRadPerPx));
    };
    const onPointerUp = () => {
      dragRef.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      // Must be non-passive (below) so this actually stops the browser from
      // scrolling/zooming the page instead of the camera — a passive
      // listener can never call preventDefault, it's silently ignored.
      e.preventDefault();
      sys.applyManualInput(wheelToManualInput(e.deltaY, tunablesRef.current.wheelLnPerUnit));
    };

    const el: HTMLElement | Window = container ?? window;
    window.addEventListener('keydown', onKey);
    el.addEventListener('pointerdown', onPointerDown as EventListener);
    el.addEventListener('pointermove', onPointerMove as EventListener);
    window.addEventListener('pointerup', onPointerUp);
    el.addEventListener('wheel', onWheel as EventListener, { passive: false });

    return () => {
      unsub();
      unsubReset();
      unsubHome();
      window.removeEventListener('keydown', onKey);
      el.removeEventListener('pointerdown', onPointerDown as EventListener);
      el.removeEventListener('pointermove', onPointerMove as EventListener);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('wheel', onWheel as EventListener);
      sys.dispose();
      sysRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- camera/refs are stable for the route lifetime, same precedent as TierZeroPoints' mount effects
  }, []);

  // Push the live preference in rather than rebuilding the camera system:
  // the OS setting can change mid-session and the in-app override at any time.
  useEffect(() => {
    if (sysRef.current) sysRef.current.reducedMotion = reducedMotion;
  }, [reducedMotion]);

  // CameraSystem owns the camera it was given — it applies the pose AND the
  // per-frame near/far itself, so this hook never mutates `camera` directly.
  useFrame((_, dt) => {
    const sys = sysRef.current;
    if (!sys) return;
    const pending = pendingTargetRef.current;
    if (pending >= 0 && hasPosition(frameStateRef.current, pending)) {
      pendingTargetRef.current = -1;
      sys.flyTo(pending).catch(() => undefined);
    }
    const pendingBody = pendingBodyRef.current;
    if (pendingBody !== null) followBodyRef.current?.(pendingBody); // re-pends until the body has a position
    sys.approachBlend = tunablesRef.current.approachBlend;
    sys.update(dt, frameStateRef.current);
    // Publish flight state for pick suppression. The store only writes on a
    // CHANGE, so this is a comparison per frame, not a React update.
    const kind = sys.state.kind;
    useCameraStatus.getState().setFlying(kind === 'focusFlight' || kind === 'exit');
    if (radiusKmRef) radiusKmRef.current = sys.radiusKm;
    if (targetDistanceKmRef) targetDistanceKmRef.current = sys.targetDistanceKm;
  });
}
