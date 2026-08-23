import { lazy, Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Earth, Starfield } from '@orcas/scene';
import { LandingSequence } from './landing/LandingSequence.js';
import { useGlobalHotkeys } from './state/use-global-hotkeys.js';

// Lazy-loaded so the design lab stays out of the main bundle (Rules.md:
// < 300 KB gzipped before the 3D chunk). No router dependency — a path
// check is all one extra route needs.
const DesignLab = lazy(() => import('./design/index.js'));
const CatalogDebug = lazy(() =>
  import('./data/CatalogDebug.js').then((m) => ({ default: m.CatalogDebug })),
);
const PropagationDebug = lazy(() =>
  import('./propagation/PropagationDebug.js').then((m) => ({ default: m.PropagationDebug })),
);
const SimulationDebug = lazy(() =>
  import('./simulation/SimulationDebug.js').then((m) => ({ default: m.SimulationDebug })),
);

/** Mouse orbit/zoom plus arrow-key pan — Design.md §9: "the scene itself has
 * keyboard camera controls." `listenToKeyEvents` isn't wired by drei itself. */
function CameraControls() {
  const ref = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    // three.js's type declares HTMLElement, but the runtime only needs
    // addEventListener/removeEventListener — window has both, and listening
    // there (not the canvas) means arrow keys work without first clicking
    // the canvas to give it focus.
    ref.current?.listenToKeyEvents(window as unknown as HTMLElement);
  }, []);

  return <OrbitControls ref={ref} makeDefault enableDamping={false} />;
}

function Simulation() {
  useGlobalHotkeys();

  return (
    <>
      <Canvas camera={{ position: [0, 0, 4] }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 3, 5]} intensity={1.2} />
        <Starfield />
        <Earth />
        <CameraControls />
      </Canvas>
      {/* Mounted alongside the Canvas, never gating it — Branding.md:
          the sequence must never block the scene loading behind it. */}
      <LandingSequence />
    </>
  );
}

/** Thin shell. Proves packages/orcas-scene renders inside the frontend workspace. */
export function App() {
  if (window.location.pathname === '/design') {
    return (
      <Suspense fallback={null}>
        <DesignLab />
      </Suspense>
    );
  }
  if (window.location.pathname === '/catalog') {
    return (
      <Suspense fallback={null}>
        <CatalogDebug />
      </Suspense>
    );
  }
  if (window.location.pathname === '/propagation') {
    return (
      <Suspense fallback={null}>
        <PropagationDebug />
      </Suspense>
    );
  }
  if (window.location.pathname === '/keyframes') {
    return (
      <Suspense fallback={null}>
        <SimulationDebug />
      </Suspense>
    );
  }
  return <Simulation />;
}
