import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';
import { Canvas } from '@react-three/fiber';
import { satrecFromOmm, propagate, temeToJ2000Matrix, applyMat3 } from '@orcas/physics';
import { GlassSurface } from '../../ui/GlassSurface.js';
import { useCatalog } from '../../data/use-catalog.js';
import { useSimulationLoop } from '../../simulation/use-simulation-loop.js';
import type { SimulationLoopHandle } from '../../simulation/use-simulation-loop.js';
import { TierZeroPoints, type TierZeroPointsHandle } from './TierZeroPoints.js';
import { computePointShading } from './points-shading.js';
import { PLACEHOLDER_RADIUS_KM } from './points-attributes.js';
import { countByOrbitClass } from './points-filters.js';
import { FilterChip } from '../../ui/FilterChip.js';
import { TimeDock } from '../../ui/TimeDock.js';
import { ObjectTether, type ObjectTetherHandle } from '../../ui/ObjectTether.js';
import { useViewStore } from '../../state/view-store.js';
import { useSelectionStore } from '../../state/selection-store.js';
import type { OrbitClass } from '../../state/selection-store.js';
import { resolveObjectDetail, resolveSelectableObject } from './points-selection-resolve.js';
import { isClickNotDrag } from './points-pick-schedule.js';
import { useCameraController } from '../camera/use-camera-controller.js';
import { CameraDevPanel } from '../camera/CameraDevPanel.js';
import { Tier1Objects } from '../instanced/Tier1Objects.js';
import { Tier1Readout } from './Tier1Readout.js';
import type { FrameState } from '../../simulation/frame-state.js';
import type { ObjectMeta } from '../../data/catalog-types.js';
import './PointsDebug.css';

const EARTH_RADIUS_KM = 6371;
// R_GEO — matches the camera rig's default radius so the first frame does not jump.
const CAMERA_DISTANCE_KM = 42_164;

/** Runs the real camera system inside the R3F context (needs useThree/useFrame). */
function CameraController({
  frameStateRef,
  byNorad,
  canvasContainerRef,
}: {
  frameStateRef: MutableRefObject<FrameState>;
  byNorad: Readonly<Record<string, number>>;
  canvasContainerRef: MutableRefObject<HTMLElement | null>;
}) {
  useCameraController({ frameStateRef, byNorad, canvasContainerRef });
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

const CROSS_CHECK_COUNT = 10;
const POLL_MS = 100; // matches SimulationDebug.tsx's existing ≤10Hz UI-mirror pattern

interface Vec3Km {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface CrossCheckRow {
  readonly norad: string;
  readonly renderedKm: Vec3Km;
  readonly directKm: Vec3Km;
  readonly deltaM: number;
  readonly drawPx: number;
}

/**
 * The milestone's "cross-check ten known objects' screen positions
 * against an independent tracker" requirement (brief §I) — reusing the
 * exact direct-SGP4 reference PropagationDebug.tsx already established
 * and live-verified against a real ISS record in M1.1, rather than a new
 * external tracker dependency.
 */
function buildCrossCheckRows(
  objects: readonly ObjectMeta[],
  frameState: { positions: Float32Array; epochMs: number },
  pixelsPerRadian: number,
): CrossCheckRow[] {
  const rows: CrossCheckRow[] = [];
  const at = new Date(frameState.epochMs);

  for (let i = 0; i < Math.min(CROSS_CHECK_COUNT, objects.length); i++) {
    const object = objects[i];
    const satrec = satrecFromOmm(object.record);
    const rawDirect = propagate(satrec, at, object.norad);
    const directKm = applyMat3(temeToJ2000Matrix(at), rawDirect.positionEciKm);

    const renderedKm: Vec3Km = {
      x: frameState.positions[i * 3],
      y: frameState.positions[i * 3 + 1],
      z: frameState.positions[i * 3 + 2],
    };

    const deltaM =
      Math.hypot(directKm.x - renderedKm.x, directKm.y - renderedKm.y, directKm.z - renderedKm.z) * 1000;

    const distanceKm = Math.hypot(directKm.x, directKm.y, directKm.z);
    const { drawPx } = computePointShading(PLACEHOLDER_RADIUS_KM, distanceKm, pixelsPerRadian, 1.5, 1, 0.05);

    rows.push({ norad: object.norad, renderedKm, directKm, deltaM, drawPx });
  }

  return rows;
}

function useCrossCheck(objects: readonly ObjectMeta[], loop: SimulationLoopHandle): CrossCheckRow[] {
  const [crossCheck, setCrossCheck] = useState<CrossCheckRow[]>([]);

  useEffect(() => {
    // Display-only estimate (fixed 60deg FOV assumption) for the table's
    // "expected drawPx" column — the live shader (TierZeroPoints.tsx)
    // computes its own from the real camera every frame; this only needs
    // to be in the right ballpark for a human comparing the table against
    // the rendered image.
    const assumedFovRad = (60 * Math.PI) / 180;
    const assumedPixelsPerRadian = window.innerHeight / assumedFovRad;
    const interval = setInterval(() => {
      const frameState = loop.frameStateRef.current;
      // FrameState starts at epochMs 0 (createFrameState's initial value)
      // until the simulation loop's first rAF tick writes a real epoch.
      // Propagating any 2026-fitted element set to the Unix epoch is
      // legitimately outside SGP4's valid range and throws — skip this
      // poll rather than crash; the next one lands after the real tick.
      if (frameState.epochMs <= 0) return;
      setCrossCheck(buildCrossCheckRows(objects, frameState, assumedPixelsPerRadian));
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [objects, loop.frameStateRef]);

  return crossCheck;
}

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
  const counts = countByOrbitClass(objects);

  const pointsHandleRef = useRef<TierZeroPointsHandle>(null);
  const tetherRef = useRef<ObjectTetherHandle>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const tier1CountRef = useRef(0);
  const activeCountRef = useRef(0);
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
            pickHandleRef={pointsHandleRef}
          />
          <Tier1Objects
            frameStateRef={loop.frameStateRef}
            byNorad={byNorad}
            memberCountRef={tier1CountRef}
            activeCountRef={activeCountRef}
          />
          <CameraController
            frameStateRef={loop.frameStateRef}
            byNorad={byNorad}
            canvasContainerRef={viewportRef as unknown as MutableRefObject<HTMLElement | null>}
          />
        </Canvas>
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
      <GlassSurface variant="floating" elevation={2} className="points-debug__panel">
        <h1>Tier 0 points debug</h1>
        <p className="points-debug__count">{objects.length.toLocaleString()} objects</p>
        <Tier1Readout tier1CountRef={tier1CountRef} activeCountRef={activeCountRef} />

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

        <table className="points-debug__table">
          <thead>
            <tr>
              <th>NORAD</th>
              <th>rendered (km)</th>
              <th>direct SGP4 (km)</th>
              <th>delta (m)</th>
              <th>expected px</th>
            </tr>
          </thead>
          <tbody>
            {crossCheck.map((row) => (
              <tr key={row.norad}>
                <td>{row.norad}</td>
                <td>
                  {row.renderedKm.x.toFixed(1)}, {row.renderedKm.y.toFixed(1)}, {row.renderedKm.z.toFixed(1)}
                </td>
                <td>
                  {row.directKm.x.toFixed(1)}, {row.directKm.y.toFixed(1)}, {row.directKm.z.toFixed(1)}
                </td>
                <td>{row.deltaM.toFixed(1)}</td>
                <td>{row.drawPx.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassSurface>
    </div>
  );
}
