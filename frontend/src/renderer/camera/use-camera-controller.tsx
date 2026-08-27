import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { PerspectiveCamera } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { FrameState } from '../../simulation/frame-state.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { createCameraSystem, type CameraSystem } from './camera-system.js';

const DRAG_RAD_PER_PX = 0.005;
const WHEEL_LN_PER_UNIT = 0.001;
const CROSSFADE_CLASS = 'points-debug__viewport--crossfade';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Args {
  readonly frameStateRef: MutableRefObject<FrameState>;
  readonly byNorad: Readonly<Record<string, number>>;
  readonly canvasContainerRef: MutableRefObject<HTMLElement | null>;
}

/**
 * Owns a `CameraSystem` for the route's lifetime and wires it to R3F, the
 * pointer, the selection store and Esc. The system itself is headless — this
 * hook is the only place it touches React / the DOM (brief §C.13, §D.5).
 */
export function useCameraController({ frameStateRef, byNorad, canvasContainerRef }: Args): void {
  const { camera } = useThree();
  const sysRef = useRef<CameraSystem | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const container = canvasContainerRef.current;
    const onCrossFade = () => {
      if (!container) return;
      container.classList.add(CROSSFADE_CLASS);
      window.setTimeout(() => container.classList.remove(CROSSFADE_CLASS), 260);
    };
    const sys = createCameraSystem(camera as PerspectiveCamera, {
      reducedMotion: prefersReducedMotion(),
      onCrossFade,
    });
    sysRef.current = sys;
    // One inert frame so the system has a FrameState before any selection
    // event (which could fire before R3F's first useFrame tick) reaches flyTo.
    sys.update(0, frameStateRef.current);

    // selection → camera. Vanilla subscribe, outside React's render cycle.
    const unsub = useSelectionStore.subscribe((state, prev) => {
      if (state.selectedNorad === prev.selectedNorad) return;
      const p =
        state.selectedNorad === null
          ? sys.flyToEarth()
          : byNorad[state.selectedNorad] === undefined
            ? Promise.resolve()
            : sys.flyTo(byNorad[state.selectedNorad]);
      p.catch(() => undefined); // CancelledError when superseded — expected
    });

    // Esc → clear selection (which the subscription turns into flyToEarth).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useSelectionStore.getState().setSelected(null);
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
      sys.applyManualInput({ dAzimuthRad: -dx * DRAG_RAD_PER_PX, dElevationRad: -dy * DRAG_RAD_PER_PX, dLnRadius: 0 });
    };
    const onPointerUp = () => {
      dragRef.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      sys.applyManualInput({ dAzimuthRad: 0, dElevationRad: 0, dLnRadius: e.deltaY * WHEEL_LN_PER_UNIT });
    };

    const el: HTMLElement | Window = container ?? window;
    window.addEventListener('keydown', onKey);
    el.addEventListener('pointerdown', onPointerDown as EventListener);
    el.addEventListener('pointermove', onPointerMove as EventListener);
    window.addEventListener('pointerup', onPointerUp);
    el.addEventListener('wheel', onWheel as EventListener, { passive: true });

    return () => {
      unsub();
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

  // CameraSystem owns the camera it was given — it applies the pose AND the
  // per-frame near/far itself, so this hook never mutates `camera` directly.
  useFrame((_, dt) => sysRef.current?.update(dt, frameStateRef.current));
}
