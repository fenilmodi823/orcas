import { useMemo } from 'react';
import { useCatalog } from '../data/use-catalog.js';
import type { CatalogOrigin } from '../data/use-catalog.js';
import { useProvenance } from '../data/use-provenance.js';
import { formatCreditLine, type CatalogProvenance } from '../data/catalog-provenance.js';
import type { CatalogSnapshot } from '../data/catalog-types.js';
import { LiveScene } from '../renderer/live/LiveScene.js';
import { useLiveScene, type LiveSceneState } from '../renderer/live/use-live-scene.js';
import { countByOrbitClass } from '../renderer/points/points-filters.js';
import { resolveObjectDetail } from '../renderer/points/points-selection-resolve.js';
import { GAIA_ACKNOWLEDGEMENT } from '../renderer/sky/star-sky.js';
import { TimeDock, type FilterOption } from '../ui/TimeDock.js';
import { StatusPill } from '../ui/StatusPill.js';
import { OrbitClassLegend } from '../ui/OrbitClassLegend.js';
import { DataProvenance } from '../ui/DataProvenance.js';
import { DebrisToggle } from '../ui/DebrisToggle.js';
import { DensitySlider } from '../ui/DensitySlider.js';
import { PanelErrorBoundary } from '../ui/PanelErrorBoundary.js';
import { useViewStore } from '../state/view-store.js';
import { useSelectionStore, type FilterClass } from '../state/selection-store.js';
import { useSimulationStore } from '../state/simulation-store.js';
import { useSimulationClock } from './use-simulation-clock.js';
import { clampToRange, scrubRangeOf } from './coverage.js';
import './SimulationView.css';

const FILTER_LABELS: Record<FilterClass, string> = { leo: 'LEO', meo: 'MEO', geo: 'GEO', heo: 'HEO', debris: 'Debris' };
const FILTER_ORDER: readonly FilterClass[] = ['leo', 'meo', 'geo', 'heo', 'debris'];

/**
 * `/` — the product (M1.9). Design.md §7: at rest the scene owns the screen,
 * and the only chrome is the logo (the landing sequence's persistent brand
 * mark, mounted by App), the epoch pill, the dock and the orbit-class legend.
 * Everything else is summoned by expanding the dock.
 *
 * The scene is the same `LiveScene` the `/points` debug route runs, so there
 * is exactly one renderer.
 */
export function SimulationView() {
  const { snapshot, origin, loading, error } = useCatalog();

  if (!snapshot || snapshot.objects.length === 0) {
    // useCatalog falls back to cache and then to bundled fixtures, so this is
    // almost always the brief load while the landing sequence plays over it.
    // Never a blank screen (Rules.md error table): say what is happening.
    return (
      <p className="simulation__status" role="status" data-error={!loading || undefined}>
        {loading ? 'Loading catalogue…' : `No catalogue data available${error ? ` (${error})` : ''}.`}
      </p>
    );
  }
  return <LiveSimulation snapshot={snapshot} origin={origin} />;
}

function LiveSimulation({ snapshot, origin }: { snapshot: CatalogSnapshot; origin: CatalogOrigin }) {
  const scene = useLiveScene(snapshot.objects, snapshot.byNorad);
  const provenance = useProvenance(snapshot, origin);

  return (
    <div className="simulation">
      <LiveScene scene={scene} />
      <PanelErrorBoundary label="Epoch">
        <div className="simulation__pill">
          <StatusPill
            epoch={new Date(provenance.medianEpochMs)}
            stale={origin !== 'live'}
            nowMs={provenance.nowMs}
          />
        </div>
      </PanelErrorBoundary>
      <PanelErrorBoundary label="Orbit class legend">
        <OrbitClassLegend />
      </PanelErrorBoundary>
      <div className="simulation__dock">
        <PanelErrorBoundary label="Time dock">
          <SimulationDock scene={scene} provenance={provenance} />
        </PanelErrorBoundary>
      </div>
      {/* Map-credit style: small, persistent, out of the way. RA-14 §2.3 wants
          a provenance line wherever catalogue data is shown, and both the
          USSPACECOM citation (RA14.D3) and ESA's Gaia acknowledgement are
          licence conditions — neither can wait to be summoned. */}
      <p className="simulation__credit">
        {formatCreditLine(provenance)} Stars: {GAIA_ACKNOWLEDGEMENT}
      </p>
    </div>
  );
}

/** Owns the slow display clock, so its re-renders stay inside the dock. */
function SimulationDock({ scene, provenance }: { scene: LiveSceneState; provenance: CatalogProvenance }) {
  const { objects, loop, resolvedSelected, selectedObjectMeta } = scene;
  const currentTime = useSimulationClock(loop.frameStateRef, provenance.nowMs);
  const playing = useSimulationStore((s) => s.playing);
  const rate = useSimulationStore((s) => s.rate);
  const togglePlaying = useSimulationStore((s) => s.togglePlaying);
  const cycleRate = useSimulationStore((s) => s.cycleRate);
  const activeFilters = useViewStore((s) => s.activeFilters);
  const toggleFilter = useViewStore((s) => s.toggleFilter);
  const setSelected = useSelectionStore((s) => s.setSelected);

  const counts = useMemo(() => countByOrbitClass(objects), [objects]);
  const range = useMemo(() => scrubRangeOf(objects), [objects]);

  if (resolvedSelected && selectedObjectMeta) {
    return (
      <TimeDock
        mode="object"
        object={resolvedSelected}
        detail={resolveObjectDetail(selectedObjectMeta)}
        onBack={() => setSelected(null)}
      />
    );
  }

  const filters: FilterOption[] = FILTER_ORDER.map((orbitClass) => ({
    orbitClass,
    label: FILTER_LABELS[orbitClass],
    count: counts[orbitClass],
    active: activeFilters.has(orbitClass),
  }));
  // The scrubber's end-stops are the union of every object's coverage
  // (brief §E.5): past them there is genuinely no data.
  const rangeStart = new Date(range?.startMs ?? currentTime.getTime());
  const rangeEnd = new Date(range?.endMs ?? currentTime.getTime());
  const scrubTo = (epochMs: number) => loop.scrubTo(range ? clampToRange(epochMs, range) : epochMs);

  return (
    <TimeDock
      mode="time"
      playing={playing}
      rate={rate}
      currentTime={currentTime}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      filters={filters}
      onTogglePlay={togglePlaying}
      onCycleRate={cycleRate}
      onJumpToNow={() => {
        useSimulationStore.getState().jumpToNow();
        scrubTo(Date.now());
      }}
      onScrub={(time) => scrubTo(time.getTime())}
      onToggleFilter={toggleFilter}
      layers={
        <>
          <DensitySlider />
          <DebrisToggle count={counts.debris} />
          <DataProvenance provenance={provenance} />
        </>
      }
    />
  );
}
