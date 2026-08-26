import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { satrecFromOmm, propagate, temeToJ2000Matrix, applyMat3 } from '@orcas/physics';
import { GlassSurface } from '../../ui/GlassSurface.js';
import { useCatalog } from '../../data/use-catalog.js';
import { useSimulationLoop } from '../../simulation/use-simulation-loop.js';
import type { SimulationLoopHandle } from '../../simulation/use-simulation-loop.js';
import { TierZeroPoints } from './TierZeroPoints.js';
import { computePointShading } from './points-shading.js';
import { PLACEHOLDER_RADIUS_KM } from './points-attributes.js';
import type { ObjectMeta } from '../../data/catalog-types.js';
import './PointsDebug.css';

const EARTH_RADIUS_KM = 6371;
// Frames the full LEO shell (~160-2,000 km altitude) plus the GEO ring
// (~42,164 km) in view. Chosen empirically for this task; adjust and
// note the new value here if Task 7's live check finds a better framing.
const CAMERA_DISTANCE_KM = 60_000;

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

  return <PointsDebugPanel objects={snapshot.objects} />;
}

function PointsDebugPanel({ objects }: { objects: readonly ObjectMeta[] }) {
  const playingRef = useRef(true);
  const rateRef = useRef(1);
  const [startEpochMs] = useState(() => Date.now());
  const loop = useSimulationLoop(objects, playingRef, rateRef, startEpochMs);
  const crossCheck = useCrossCheck(objects, loop);

  return (
    <div className="points-debug">
      <Canvas camera={{ position: [0, 0, CAMERA_DISTANCE_KM], near: 1, far: 500_000 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[EARTH_RADIUS_KM, 0, EARTH_RADIUS_KM]} intensity={1.2} />
        <mesh>
          <sphereGeometry args={[EARTH_RADIUS_KM, 64, 64]} />
          <meshStandardMaterial color="#0E1626" emissive="#00E5FF" emissiveIntensity={0.05} roughness={0.85} />
        </mesh>
        <TierZeroPoints objects={objects} frameStateRef={loop.frameStateRef} />
        <OrbitControls
          makeDefault
          enableDamping={false}
          minDistance={EARTH_RADIUS_KM * 1.05}
          maxDistance={200_000}
        />
      </Canvas>
      <GlassSurface variant="floating" elevation={2} className="points-debug__panel">
        <h1>Tier 0 points debug</h1>
        <p className="points-debug__count">{objects.length.toLocaleString()} objects</p>

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
