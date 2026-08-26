import { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { GlassSurface } from '../../ui/GlassSurface.js';
import { useCatalog } from '../../data/use-catalog.js';
import { useSimulationLoop } from '../../simulation/use-simulation-loop.js';
import { TierZeroPoints } from './TierZeroPoints.js';
import type { ObjectMeta } from '../../data/catalog-types.js';
import './PointsDebug.css';

const EARTH_RADIUS_KM = 6371;
// Frames the full LEO shell (~160-2,000 km altitude) plus the GEO ring
// (~42,164 km) in view. Chosen empirically for this task; adjust and
// note the new value here if Task 7's live check finds a better framing.
const CAMERA_DISTANCE_KM = 60_000;

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
      </GlassSurface>
    </div>
  );
}
