import { lazy, Suspense } from 'react';
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
const PointsDebug = lazy(() =>
  import('./renderer/points/PointsDebug.js').then((m) => ({ default: m.PointsDebug })),
);
// The 3D stack itself is lazy for the same reason the debug routes are:
// three + R3F + drei + @orcas/scene were the whole of the eager payload
// otherwise. `LandingSequence` below deliberately stays eager so the intro
// renders from frame one while this chunk streams in behind it.
const Scene = lazy(() => import('./scene/Scene.js').then((m) => ({ default: m.Scene })));

function Simulation() {
  useGlobalHotkeys();

  return (
    <>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
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
  if (window.location.pathname === '/points') {
    return (
      <Suspense fallback={null}>
        <PointsDebug />
      </Suspense>
    );
  }
  return <Simulation />;
}
