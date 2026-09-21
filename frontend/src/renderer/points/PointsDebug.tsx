import { useRef, useState } from 'react';
import { GlassSurface } from '../../ui/GlassSurface.js';
import { useCatalog } from '../../data/use-catalog.js';
import type { CatalogOrigin } from '../../data/use-catalog.js';
import { countByOrbitClass } from './points-filters.js';
import { FilterChip } from '../../ui/FilterChip.js';
import { TimeDock } from '../../ui/TimeDock.js';
import { DataProvenance } from '../../ui/DataProvenance.js';
import { useProvenance } from '../../data/use-provenance.js';
import { DebrisToggle } from '../../ui/DebrisToggle.js';
import { DensitySlider } from '../../ui/DensitySlider.js';
import { useViewStore } from '../../state/view-store.js';
import { useSelectionStore } from '../../state/selection-store.js';
import type { FilterClass } from '../../state/selection-store.js';
import { resolveObjectDetail } from './points-selection-resolve.js';
import { CameraDevPanel } from '../camera/CameraDevPanel.js';
import { OrbitClassLegend } from '../../ui/OrbitClassLegend.js';
import { PerfProbe, PerfHud } from './PerfHud.js';
import { Tier1Readout } from './Tier1Readout.js';
import { GAIA_ACKNOWLEDGEMENT } from '../sky/star-sky.js';
import type { CatalogSnapshot } from '../../data/catalog-types.js';
import { useCrossCheck } from './points-cross-check.js';
import { CrossCheckTable } from './CrossCheckTable.js';
import { PanelErrorBoundary } from '../../ui/PanelErrorBoundary.js';
import { LiveScene } from '../live/LiveScene.js';
import { useLiveScene } from '../live/use-live-scene.js';
import './PointsDebug.css';

const FILTER_CLASS_LABELS: Record<FilterClass, string> = {
  leo: 'LEO',
  meo: 'MEO',
  geo: 'GEO',
  heo: 'HEO',
  debris: 'Debris',
};
const FILTER_CLASSES: readonly FilterClass[] = ['leo', 'meo', 'geo', 'heo', 'debris'];

/** The `/points` debug route: the live scene (shared with `/`) plus the
 * instruments — cross-check table, camera tunables, perf HUD, tier readouts.
 * The renderer itself lives in `renderer/live/` so this route can never grow
 * a second copy of it. */
export function PointsDebug() {
  const { snapshot, origin, loading, error } = useCatalog();

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

  return <PointsDebugPanel snapshot={snapshot} origin={origin} />;
}

function PointsDebugPanel({ snapshot, origin }: { snapshot: CatalogSnapshot; origin: CatalogOrigin }) {
  const scene = useLiveScene(snapshot.objects, snapshot.byNorad);
  const { objects, loop, refs, resolvedSelected, selectedObjectMeta } = scene;
  const provenance = useProvenance(snapshot, origin);
  const crossCheck = useCrossCheck(objects, loop);
  // M1.8 §G.8: a hidden perf HUD, read once at boot — no reason for it to
  // react to a URL change after mount.
  const [perfEnabled] = useState(() => new URLSearchParams(window.location.search).has('perf'));
  const frameMsRef = useRef(0);
  const drawCallsRef = useRef(0);
  const trianglesRef = useRef(0);
  const jsMsRef = useRef(0);
  const gpuMsRef = useRef(-1);
  const activeFilters = useViewStore((state) => state.activeFilters);
  const toggleFilter = useViewStore((state) => state.toggleFilter);
  const panelCollapsed = useViewStore((state) => state.panelCollapsed);
  const togglePanel = useViewStore((state) => state.togglePanel);
  const setSelected = useSelectionStore((state) => state.setSelected);
  const counts = countByOrbitClass(objects);
  const perfRefs = { frameMsRef, drawCallsRef, trianglesRef, jsMsRef, gpuMsRef };

  return (
    <div className="points-debug">
      <LiveScene scene={scene} canvasChildren={perfEnabled && <PerfProbe {...perfRefs} />} />
      {resolvedSelected && selectedObjectMeta && (
        <div className="points-debug__dock">
          <PanelErrorBoundary label="Time dock">
            <TimeDock
              mode="object"
              object={resolvedSelected}
              detail={resolveObjectDetail(selectedObjectMeta)}
              onBack={() => setSelected(null)}
            />
          </PanelErrorBoundary>
        </div>
      )}
      <PanelErrorBoundary label="Camera panel">
        <CameraDevPanel />
      </PanelErrorBoundary>
      <PanelErrorBoundary label="Orbit class legend">
        <OrbitClassLegend />
      </PanelErrorBoundary>
      {panelCollapsed && (
        <button type="button" className="points-debug__panel-reopen" onClick={togglePanel} aria-label="Show debug panel">
          ▸
        </button>
      )}
      <GlassSurface
        variant="floating"
        elevation={2}
        className={`points-debug__panel${panelCollapsed ? ' points-debug__panel--collapsed' : ''}`}
      >
        <button type="button" className="points-debug__panel-collapse" onClick={togglePanel} aria-label="Hide debug panel">
          ◂
        </button>
        <PanelErrorBoundary label="Debug panel">
          <h1>Tier 0 points debug</h1>
          <p className="points-debug__count">{objects.length.toLocaleString()} objects</p>
          <Tier1Readout
            tier1CountRef={refs.tier1CountRef}
            activeCountRef={refs.activeCountRef}
            radiusKmRef={refs.camRadiusKmRef}
            targetDistanceKmRef={refs.camTargetDistanceKmRef}
          />
          <DensitySlider />
          <DebrisToggle count={counts.debris} />
          {perfEnabled && <PerfHud {...perfRefs} />}

          <div className="points-debug__filters">
            {FILTER_CLASSES.map((orbitClass) => (
              <FilterChip
                key={orbitClass}
                orbitClass={orbitClass}
                label={FILTER_CLASS_LABELS[orbitClass]}
                count={counts[orbitClass]}
                active={activeFilters.has(orbitClass)}
                onToggle={() => toggleFilter(orbitClass)}
              />
            ))}
          </div>

          <CrossCheckTable rows={crossCheck} />

          {/* In the panel's flow rather than floating in a corner: it describes
              the object count directly above it, and the panel has grown tall
              enough that no corner is reliably free. */}
          <PanelErrorBoundary label="Data provenance">
            <DataProvenance provenance={provenance} />
          </PanelErrorBoundary>

          {/* ESA's data policy requires the acknowledgement to be visible where
              the data is used, not only in source. */}
          <p className="points-debug__attribution">{GAIA_ACKNOWLEDGEMENT}</p>
        </PanelErrorBoundary>
      </GlassSurface>
    </div>
  );
}
