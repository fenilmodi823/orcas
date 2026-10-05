import { useCallback, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCatalog } from '../data/use-catalog.js';
import type { CatalogOrigin } from '../data/use-catalog.js';
import { useProvenance } from '../data/use-provenance.js';
import { formatCreditLine, type CatalogProvenance } from '../data/catalog-provenance.js';
import type { CatalogSnapshot, NoradId } from '../data/catalog-types.js';
import { LiveScene } from '../renderer/live/LiveScene.js';
import { useLiveScene, type LiveSceneState } from '../renderer/live/use-live-scene.js';
import { countByOrbitClass } from '../renderer/points/points-filters.js';
import { GAIA_ACKNOWLEDGEMENT } from '../renderer/sky/star-sky.js';
import { EARTH_IMAGERY_CREDIT } from '../renderer/earth/earth-materials.js';
import { LAGRANGE_CREDIT } from '../renderer/earth/lagrange-labels.js';
import { PLANET_CREDIT } from '../renderer/solar/planets.js';
import { TimeDock, type FilterOption } from '../ui/TimeDock.js';
import { StatusPill } from '../ui/StatusPill.js';
import { OrbitClassLegend } from '../ui/OrbitClassLegend.js';
import { DataProvenance } from '../ui/DataProvenance.js';
import { DebrisToggle } from '../ui/DebrisToggle.js';
import { HeatmapToggle } from '../ui/HeatmapToggle.js';
import { ReplayControl, type ReplayHandle } from '../ui/ReplayControl.js';
import { DensitySlider } from '../ui/DensitySlider.js';
import { PanelErrorBoundary } from '../ui/PanelErrorBoundary.js';
import { useViewStore } from '../state/view-store.js';
import { useSelectionStore, type FilterClass } from '../state/selection-store.js';
import { useReducedMotion } from '../state/use-reduced-motion.js';
import { effectiveRate, useSimulationStore } from '../state/simulation-store.js';
import { useSimulationClock } from './use-simulation-clock.js';
import { SimulationSearch } from './SimulationSearch.js';
import { SimulationObjectPanel } from './SimulationObjectPanel.js';
import { clampToRange, scrubRangeOf } from './coverage.js';
import { useEdgeStop } from './use-edge-stop.js';
import { parseViewState } from './view-url.js';
import { useApplyInitialView, useWriteViewUrl } from './use-view-url.js';
import './SimulationView.css';

const FILTER_LABELS: Record<FilterClass, string> = { leo: 'LEO', meo: 'MEO', geo: 'GEO', heo: 'HEO', debris: 'Debris' };
const FILTER_ORDER: readonly FilterClass[] = ['leo', 'meo', 'geo', 'heo', 'debris'];
/** Design.md §5: panels spring, stiffness 220 / damping 26. */
const PANEL_SPRING = { type: 'spring', stiffness: 220, damping: 26 } as const;

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
  const { snapshot, origin, loading, error, replayAtMs, replayError, startReplay, endReplay } = useCatalog();
  const replay: ReplayHandle = { atMs: replayAtMs, error: replayError, start: startReplay, end: endReplay };
  // The link the page opened with (time, rate, selection — S1), applied once:
  // a replay remounts the scene and must not re-apply it.
  const [initialView] = useState(() => parseViewState(new URLSearchParams(window.location.search)));
  const viewTakenRef = useRef(false);
  const takeInitialView = useCallback(() => {
    if (viewTakenRef.current) return null;
    viewTakenRef.current = true;
    return initialView;
  }, [initialView]);

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
  // Keyed on the replay instant: a replay is a different catalogue, and the
  // scene's buffers are sized to its catalogue at mount, so it remounts.
  return (
    <LiveSimulation
      key={replayAtMs ?? 'live'}
      snapshot={snapshot}
      origin={origin}
      replay={replay}
      takeInitialView={takeInitialView}
    />
  );
}

interface LiveSimulationProps {
  readonly snapshot: CatalogSnapshot;
  readonly origin: CatalogOrigin;
  readonly replay: ReplayHandle;
  readonly takeInitialView: () => ReturnType<typeof parseViewState> | null;
}

function LiveSimulation({ snapshot, origin, replay, takeInitialView }: LiveSimulationProps) {
  const scene = useLiveScene(snapshot.objects, snapshot.byNorad, replay.atMs ?? undefined);
  const provenance = useProvenance(snapshot, origin);
  const reducedMotion = useReducedMotion();
  const selected = scene.selectedObjectMeta;
  // Reduced motion fades the panel in place rather than sliding it (P4.D21).
  const panelOffset = reducedMotion ? { opacity: 0 } : { opacity: 0, x: -16 };

  return (
    <div className="simulation" data-object-panel={selected ? '' : undefined}>
      <LiveScene scene={scene} />
      <AnimatePresence>
        {selected && (
          <motion.div
            key="object-panel"
            className="simulation__panel"
            initial={panelOffset}
            animate={{ opacity: 1, x: 0 }}
            exit={panelOffset}
            transition={PANEL_SPRING}
          >
            <PanelErrorBoundary label="Object panel">
              <SimulationObjectPanel scene={scene} meta={selected} provenance={provenance} />
            </PanelErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>
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
      <PanelErrorBoundary label="Search">
        <SimulationSearch objects={scene.objects} />
      </PanelErrorBoundary>
      <div className="simulation__dock">
        <PanelErrorBoundary label="Time dock">
          <SimulationDock scene={scene} provenance={provenance} replay={replay} takeInitialView={takeInitialView} />
        </PanelErrorBoundary>
      </div>
      {/* Map-credit style: small, persistent, out of the way. RA-14 §2.3 wants
          a provenance line wherever catalogue data is shown, and both the
          USSPACECOM citation (RA14.D3) and ESA's Gaia acknowledgement are
          licence conditions — neither can wait to be summoned. */}
      <p className="simulation__credit">
        {formatCreditLine(provenance)} Stars: {GAIA_ACKNOWLEDGEMENT} {EARTH_IMAGERY_CREDIT} {PLANET_CREDIT} {LAGRANGE_CREDIT}
      </p>
    </div>
  );
}

/** Owns the slow display clock, so its re-renders stay inside the dock. */
interface SimulationDockProps {
  readonly scene: LiveSceneState;
  readonly provenance: CatalogProvenance;
  readonly replay: ReplayHandle;
  readonly takeInitialView: () => ReturnType<typeof parseViewState> | null;
}

function SimulationDock({ scene, provenance, replay, takeInitialView }: SimulationDockProps) {
  const { objects, loop } = scene;
  const currentTime = useSimulationClock(loop.frameStateRef, provenance.nowMs);
  const playing = useSimulationStore((s) => s.playing);
  const rate = useSimulationStore((s) => effectiveRate(s));
  const togglePlaying = useSimulationStore((s) => s.togglePlaying);
  const stepRate = useSimulationStore((s) => s.stepRate);
  const activeFilters = useViewStore((s) => s.activeFilters);
  const toggleFilter = useViewStore((s) => s.toggleFilter);

  const counts = useMemo(() => countByOrbitClass(objects), [objects]);
  const range = useMemo(() => scrubRangeOf(objects), [objects]);
  // The dock stays the clock while an object is selected; the object lives in
  // the left panel (B.15), as in NASA Eyes.
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
  const scrubTo = useCallback(
    (epochMs: number) => loop.scrubTo(range ? clampToRange(epochMs, range) : epochMs),
    [loop, range],
  );
  // Stop at the edge of the data and say so; typed times jump and pause (S1).
  const edge = useEdgeStop(currentTime.getTime(), playing, range, scrubTo);
  // The view lives in the address bar, as in NASA Eyes (S1).
  const selectedNorad = useSelectionStore((s) => s.selectedNorad);
  const setSelected = useSelectionStore((s) => s.setSelected);
  const select = useCallback(
    (norad: string) => {
      if (scene.byNorad[norad] !== undefined) setSelected(norad as NoradId);
    },
    [scene.byNorad, setSelected],
  );
  useApplyInitialView(takeInitialView, { select, jumpTo: edge.jumpTo });
  const live = useSimulationStore((s) => s.live);
  useWriteViewUrl({ epochMs: currentTime.getTime(), rate, playing, live, selected: selectedNorad });

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
      onStepRate={stepRate}
      onSetTime={edge.jumpTo}
      notice={edge.notice}
      onJumpToNow={() => {
        // During a replay, NOW means the present catalogue, not today's time
        // propagated from the replay's old element sets.
        if (replay.atMs !== null) return replay.end();
        useSimulationStore.getState().jumpToNow();
        scrubTo(Date.now());
      }}
      onScrub={(time) => {
        useSimulationStore.getState().leaveLive();
        scrubTo(time.getTime());
      }}
      onToggleFilter={toggleFilter}
      layers={
        <>
          <DensitySlider />
          <DebrisToggle count={counts.debris} />
          <HeatmapToggle />
          <ReplayControl replay={replay} />
          <DataProvenance provenance={provenance} />
        </>
      }
    />
  );
}
