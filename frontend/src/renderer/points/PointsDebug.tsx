import { useRef, useState } from 'react';
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';
import { Canvas } from '@react-three/fiber';
import { GlassSurface } from '../../ui/GlassSurface.js';
import { useCatalog } from '../../data/use-catalog.js';
import { useSimulationLoop } from '../../simulation/use-simulation-loop.js';
import { TierZeroPoints, type TierZeroPointsHandle } from './TierZeroPoints.js';
import { countByOrbitClass } from './points-filters.js';
import { FilterChip } from '../../ui/FilterChip.js';
import { TimeDock } from '../../ui/TimeDock.js';
import { ObjectTether, type ObjectTetherHandle } from '../../ui/ObjectTether.js';
import { DensitySlider } from '../../ui/DensitySlider.js';
import { useViewStore } from '../../state/view-store.js';
import { useSelectionStore } from '../../state/selection-store.js';
import type { OrbitClass } from '../../state/selection-store.js';
import { resolveObjectDetail, resolveSelectableObject } from './points-selection-resolve.js';
import { isClickNotDrag } from './points-pick-schedule.js';
import { useCameraController } from '../camera/use-camera-controller.js';
import { CameraDevPanel } from '../camera/CameraDevPanel.js';
import { RegimeLegend } from '../../ui/RegimeLegend.js';
import { Tier1Objects } from '../instanced/Tier1Objects.js';
import { OrbitPaths } from '../paths/OrbitPaths.js';
import { GroundTracks } from '../paths/GroundTracks.js';
import { Trails } from '../trails/Trails.js';
import { Tier1Readout } from './Tier1Readout.js';
import { StarSky } from '../sky/StarSky.js';
import { GAIA_ACKNOWLEDGEMENT } from '../sky/star-sky.js';
import type { FrameState } from '../../simulation/frame-state.js';
import type { ObjectMeta } from '../../data/catalog-types.js';
import { useCrossCheck } from './points-cross-check.js';
import { CrossCheckTable } from './CrossCheckTable.js';
import './PointsDebug.css';

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

const ORBIT_CLASS_LABELS: Record<OrbitClass, string> = {
  leo: 'LEO',
  meo: 'MEO',
  geo: 'GEO',
  heo: 'HEO',
  debris: 'Debris',
};
const ORBIT_CLASSES: readonly OrbitClass[] = ['leo', 'meo', 'geo', 'heo', 'debris'];

/** M1.3's debug route (brief §I): no shared scene, no shared Earth — a
 * locally-scoped, correctly-scaled (1 unit = 1 km) view built only for
 * this route, per this plan's Global Constraints. Real integration into
 * the shared scene is M1.9's job. */
export function PointsDebug() {
  const { snapshot, loading, error } = useCatalog();

  if (loading) {
    return (
      <div className="points-debug">
        <GlassSurface variant="floating" elevation={2}>
          <p className="points-debug__status">Loading catalogue…</p>
        </GlassSurface>
      </div>
    );
  }

  if (!snapshot || snapshot.objects.length === 0) {
    return (
      <div className="points-debug">
        <GlassSurface variant="floating" elevation={2}>
          <p className="points-debug__status" data-error>
            No catalogue object available.
            {error && <span className="points-debug__error-detail"> ({error})</span>}
          </p>
        </GlassSurface>
      </div>
    );
  }

  return <PointsDebugPanel objects={snapshot.objects} byNorad={snapshot.byNorad} />;
}

function PointsDebugPanel({
  objects,
  byNorad,
}: {
  objects: readonly ObjectMeta[];
  byNorad: Readonly<Record<string, number>>;
}) {
  const playingRef = useRef(true);
  const rateRef = useRef(1);
  const [startEpochMs] = useState(() => Date.now());
  const loop = useSimulationLoop(objects, playingRef, rateRef, startEpochMs);
  const crossCheck = useCrossCheck(objects, loop);
  const activeFilters = useViewStore((state) => state.activeFilters);
  const toggleFilter = useViewStore((state) => state.toggleFilter);
  const panelCollapsed = useViewStore((state) => state.panelCollapsed);
  const togglePanel = useViewStore((state) => state.togglePanel);
  const counts = countByOrbitClass(objects);

  const pointsHandleRef = useRef<TierZeroPointsHandle>(null);
  const tetherRef = useRef<ObjectTetherHandle>(null);
  const selectedTetherRef = useRef<ObjectTetherHandle>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const tier1CountRef = useRef(0);
  const tier1MembersRef = useRef<Uint32Array | null>(null);
  const activeCountRef = useRef(0);
  const activeMembersRef = useRef<Uint32Array | null>(null);
  const camRadiusKmRef = useRef(0);
  const camTargetDistanceKmRef = useRef(0);
  const pointerDownRef = useRef<{ px: number; py: number } | null>(null);
  const selectedNorad = useSelectionStore((state) => state.selectedNorad);
  const hoveredNorad = useSelectionStore((state) => state.hoveredNorad);
  const setSelected = useSelectionStore((state) => state.setSelected);

  function toCanvasPixels(event: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return { px: event.clientX - rect.left, py: event.clientY - rect.top };
  }

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

  const resolvedHovered =
    hoveredNorad === null ? null : resolveSelectableObject(hoveredNorad, objects, byNorad, loop.frameStateRef.current);
  const resolvedSelected =
    selectedNorad === null
      ? null
      : resolveSelectableObject(selectedNorad, objects, byNorad, loop.frameStateRef.current);
  const selectedObjectMeta = selectedNorad === null ? null : objects.find((o) => o.norad === selectedNorad) ?? null;

  return (
    <div className="points-debug">
      <div
        ref={viewportRef}
        className="points-debug__viewport"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <Canvas camera={{ position: [CAMERA_DISTANCE_KM, 0, 0], fov: 35 }}>
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
          {/* After Tier1Objects: reads the Tier 1 membership it just
              wrote into tier1MembersRef this same frame. */}
          <Trails
            frameStateRef={loop.frameStateRef}
            objects={objects}
            byNorad={byNorad}
            tier1MembersRef={tier1MembersRef}
            tier1CountRef={tier1CountRef}
            scrubGenerationRef={loop.scrubGenerationRef}
          />
        </Canvas>
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
      </div>
      {resolvedSelected && selectedObjectMeta && (
        <div className="points-debug__dock">
          <TimeDock
            mode="object"
            object={resolvedSelected}
            detail={resolveObjectDetail(selectedObjectMeta)}
            onBack={() => setSelected(null)}
          />
        </div>
      )}
      <CameraDevPanel />
      <RegimeLegend />
      {panelCollapsed && (
        <button
          type="button"
          className="points-debug__panel-reopen"
          onClick={togglePanel}
          aria-label="Show debug panel"
        >
          ▸
        </button>
      )}
      <GlassSurface
        variant="floating"
        elevation={2}
        className={`points-debug__panel${panelCollapsed ? ' points-debug__panel--collapsed' : ''}`}
      >
        <button
          type="button"
          className="points-debug__panel-collapse"
          onClick={togglePanel}
          aria-label="Hide debug panel"
        >
          ◂
        </button>
        <h1>Tier 0 points debug</h1>
        <p className="points-debug__count">{objects.length.toLocaleString()} objects</p>
        <Tier1Readout
          tier1CountRef={tier1CountRef}
          activeCountRef={activeCountRef}
          radiusKmRef={camRadiusKmRef}
          targetDistanceKmRef={camTargetDistanceKmRef}
        />
        <DensitySlider />

        <div className="points-debug__filters">
          {ORBIT_CLASSES.map((orbitClass) => (
            <FilterChip
              key={orbitClass}
              orbitClass={orbitClass}
              label={ORBIT_CLASS_LABELS[orbitClass]}
              count={counts[orbitClass]}
              active={activeFilters.has(orbitClass)}
              onToggle={() => toggleFilter(orbitClass)}
            />
          ))}
        </div>

        <CrossCheckTable rows={crossCheck} />

        {/* ESA's data policy requires the acknowledgement to be visible where
            the data is used, not only in source. */}
        <p className="points-debug__attribution">{GAIA_ACKNOWLEDGEMENT}</p>
      </GlassSurface>
    </div>
  );
}
