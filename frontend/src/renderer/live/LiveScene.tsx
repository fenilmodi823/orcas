import { useRef, useState } from 'react';
import type { MutableRefObject, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { TierZeroPoints } from '../points/TierZeroPoints.js';
import { Tier1Objects } from '../instanced/Tier1Objects.js';
import { OrbitPaths } from '../paths/OrbitPaths.js';
import { GroundTracks } from '../paths/GroundTracks.js';
import { ObjectLabels, LABEL_SLOT_COUNT } from '../points/ObjectLabels.js';
import { StarSky } from '../sky/StarSky.js';
import { isClickNotDrag } from '../points/points-pick-schedule.js';
import { useCameraController } from '../camera/use-camera-controller.js';
import { useContextLoss } from '../use-context-loss.js';
import { ObjectTether } from '../../ui/ObjectTether.js';
import { ObjectLabel } from '../../ui/ObjectLabel.js';
import { PanelErrorBoundary } from '../../ui/PanelErrorBoundary.js';
import { useSelectionStore } from '../../state/selection-store.js';
import type { FrameState } from '../../simulation/frame-state.js';
import type { LiveSceneState } from './use-live-scene.js';
import './LiveScene.css';

const EARTH_RADIUS_KM = 6371;
// R_GEO — matches the camera rig's default radius so the first frame does not jump.
const CAMERA_DISTANCE_KM = 42_164;

/** Runs the real camera system inside the R3F context (needs useThree/useFrame). */
function CameraController({
  frameStateRef,
  byNorad,
  canvasContainerRef,
  radiusKmRef,
  targetDistanceKmRef,
}: {
  frameStateRef: MutableRefObject<FrameState>;
  byNorad: Readonly<Record<string, number>>;
  canvasContainerRef: MutableRefObject<HTMLElement | null>;
  radiusKmRef: MutableRefObject<number>;
  targetDistanceKmRef: MutableRefObject<number>;
}) {
  useCameraController({ frameStateRef, byNorad, canvasContainerRef, radiusKmRef, targetDistanceKmRef });
  return null;
}

function toCanvasPixels(event: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  return { px: event.clientX - rect.left, py: event.clientY - rect.top };
}

/**
 * The live catalogue scene — the one renderer, used by `/` and by the
 * `/points` debug route alike (M1.9: "everything wired into the real route").
 * Everything inside `<Canvas>` plus the HTML overlays that track it: tethers,
 * labels, and the context-loss notice. Route chrome is the caller's.
 *
 * `canvasChildren` lets a route add inside-the-Canvas extras (the perf probe)
 * without this component knowing about them.
 */
export function LiveScene({ scene, canvasChildren }: { scene: LiveSceneState; canvasChildren?: ReactNode }) {
  const { objects, byNorad, loop, ranks, featuredNames, resolvedHovered, resolvedSelected } = scene;
  // Each ref gets its own binding rather than being read off a bag during
  // render: passing `viewportRef` to a `ref=` attribute teaches the compiler
  // the bag holds refs, and it then treats every `refs.x` read as a render-
  // time ref access. Individual bindings are what the original code had.
  const {
    pointsHandleRef,
    tetherRef,
    selectedTetherRef,
    labelRefs,
    viewportRef,
    tier1CountRef,
    tier1MembersRef,
    activeCountRef,
    activeMembersRef,
    camRadiusKmRef,
    camTargetDistanceKmRef,
  } = scene.refs;
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const contextLoss = useContextLoss(canvasEl);
  const pointerDownRef = useRef<{ px: number; py: number } | null>(null);
  const hoveredNorad = useSelectionStore((state) => state.hoveredNorad);
  const setSelected = useSelectionStore((state) => state.setSelected);

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const canvas = event.currentTarget.querySelector('canvas');
    if (!canvas || !pointsHandleRef.current) return;
    const { px, py } = toCanvasPixels(event, canvas);
    pointsHandleRef.current.requestPick(px, py);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const canvas = event.currentTarget.querySelector('canvas');
    if (!canvas) return;
    pointerDownRef.current = toCanvasPixels(event, canvas);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const canvas = event.currentTarget.querySelector('canvas');
    const down = pointerDownRef.current;
    if (!canvas || !down) return;
    const up = toCanvasPixels(event, canvas);
    pointerDownRef.current = null;
    if (!isClickNotDrag(down.px, down.py, up.px, up.py)) return; // brief §D.5
    setSelected(hoveredNorad);
  }

  return (
    <div
      ref={viewportRef}
      className="live-scene"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <PanelErrorBoundary label="3D scene">
        {/* dpr={[1, 2]} matches the Math.min(window.devicePixelRatio, 2) point-size math in TierZeroPoints.tsx / StarSky.tsx; per-tier DPR (brief §6.2) is a deliberate follow-up — it would desync those uniforms and needs live point-size verification. */}
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [CAMERA_DISTANCE_KM, 0, 0], fov: 35 }}
          onCreated={({ gl }) => setCanvasEl(gl.domElement)}
        >
          {/* ⚠️ ORDER IS LOAD-BEARING. R3F runs useFrame callbacks in mount
              order, so CameraController must come FIRST: everything below
              projects world positions with `camera`, and one frame of stale
              camera is not a rounding error up close. In object mode the
              camera sits ~82 m from a target moving 7.66 km/s, so it
              translates ~127 m per frame — further than the whole viewing
              distance. Mounted last (as it was), the selected object's
              tether was computed against the previous frame's camera and
              flung hundreds of pixels off-screen every frame, which read as
              the name flickering. Invisible when zoomed out, because 127 m
              against thousands of km is nothing. */}
          <CameraController
            frameStateRef={loop.frameStateRef}
            byNorad={byNorad}
            canvasContainerRef={viewportRef as unknown as MutableRefObject<HTMLElement | null>}
            radiusKmRef={camRadiusKmRef}
            targetDistanceKmRef={camTargetDistanceKmRef}
          />
          {/* After CameraController: OrbitPaths reads nothing from the
              camera, but keeping every projection consumer downstream of
              the controller is the load-bearing order M1.7a established. */}
          <OrbitPaths frameStateRef={loop.frameStateRef} objects={objects} byNorad={byNorad} />
          <StarSky />
          <ambientLight intensity={0.4} />
          <directionalLight position={[EARTH_RADIUS_KM, 0, EARTH_RADIUS_KM]} intensity={1.2} />
          <mesh>
            <sphereGeometry args={[EARTH_RADIUS_KM, 64, 64]} />
            <meshStandardMaterial color="#0E1626" emissive="#00E5FF" emissiveIntensity={0.05} roughness={0.85} />
          </mesh>
          <TierZeroPoints
            objects={objects}
            ranks={ranks}
            frameStateRef={loop.frameStateRef}
            tetherRef={tetherRef}
            selectedTetherRef={selectedTetherRef}
            pickHandleRef={pointsHandleRef}
          />
          <Tier1Objects
            frameStateRef={loop.frameStateRef}
            objects={objects}
            byNorad={byNorad}
            memberCountRef={tier1CountRef}
            activeCountRef={activeCountRef}
            activeMembersRef={activeMembersRef}
            membersRef={tier1MembersRef}
          />
          {/* After Tier1Objects: reads the active set it just wrote into
              activeMembersRef this same frame. */}
          <GroundTracks
            frameStateRef={loop.frameStateRef}
            objects={objects}
            byNorad={byNorad}
            activeMembersRef={activeMembersRef}
            activeCountRef={activeCountRef}
          />
          <ObjectLabels
            frameStateRef={loop.frameStateRef}
            objects={objects}
            byNorad={byNorad}
            ranks={ranks}
            camRadiusKmRef={camRadiusKmRef}
            labelRefs={labelRefs}
          />
          {canvasChildren}
        </Canvas>
      </PanelErrorBoundary>
      {contextLoss.lost && (
        /* Rules.md's error table: never a black canvas. The scene stays
           mounted and repaints itself once the GPU hands the context back,
           so this says what is happening instead of forcing a reload. */
        <p className="live-scene__context-lost" role="status">
          The graphics context was lost — usually the browser reclaiming GPU memory. The view will return on its own.
        </p>
      )}
      <ObjectTether
        ref={selectedTetherRef}
        name={resolvedSelected?.name ?? ''}
        orbitClass={resolvedSelected?.orbitClass ?? 'debris'}
        altitudeKm={resolvedSelected?.altitudeKm ?? 0}
        selected
      />
      <ObjectTether
        ref={tetherRef}
        name={resolvedHovered?.name ?? ''}
        orbitClass={resolvedHovered?.orbitClass ?? 'debris'}
        altitudeKm={resolvedHovered?.altitudeKm ?? 0}
      />
      {Array.from({ length: LABEL_SLOT_COUNT }, (_, k) => (
        <ObjectLabel
          key={k}
          ref={(l) => {
            labelRefs.current[k] = l;
          }}
          // Featured slots (0..featuredNames.length-1) get their real
          // name; the last slot is the dynamic "current selection, if
          // not already featured" one — see ObjectLabels.tsx.
          name={k === LABEL_SLOT_COUNT - 1 ? (resolvedSelected?.name ?? '') : (featuredNames[k] ?? '')}
        />
      ))}
    </div>
  );
}
