import { GlassSurface } from '../../ui/GlassSurface.js';
import { TimeDock } from '../../ui/TimeDock.js';
import { useSimulationStore } from '../../state/simulation-store.js';
import { useViewStore } from '../../state/view-store.js';
import type { OrbitClass, SelectableObject } from '../../state/selection-store.js';

const RANGE_START = new Date('2009-02-10T00:00:00Z');
const RANGE_END = new Date('2009-02-11T00:00:00Z');
const CONJUNCTION_MARKERS = [new Date('2009-02-10T16:56:00Z')];

const FILTER_OPTIONS: readonly { orbitClass: OrbitClass; label: string; count: number }[] = [
  { orbitClass: 'leo', label: 'LEO', count: 612 },
  { orbitClass: 'meo', label: 'MEO', count: 54 },
  { orbitClass: 'geo', label: 'GEO', count: 38 },
  { orbitClass: 'debris', label: 'Debris', count: 941 },
];

const DEMO_OBJECT: SelectableObject = {
  id: '25544',
  name: 'ISS (ZARYA)',
  noradId: '25544',
  orbitClass: 'leo',
  altitudeKm: 419.0,
  velocityKmS: 7.66,
  inclinationDeg: 51.6,
};

/**
 * TimeDock (Design.md §6, D7) — the interface. Wired to the real
 * simulation/view stores in `state/` (Architecture.md's own bridge), not
 * mocked local state, so this section proves the store contract end to end.
 */
export function TimeDockSection() {
  const simulation = useSimulationStore();
  const activeFilters = useViewStore((state) => state.activeFilters);
  const toggleFilter = useViewStore((state) => state.toggleFilter);

  return (
    <section className="design-section" aria-labelledby="timedock-heading">
      <h2 id="timedock-heading">TimeDock</h2>

      <GlassSurface variant="floating" elevation={2} className="design-card">
        <h3>mode=&quot;time&quot;</h3>
        <TimeDock
          mode="time"
          playing={simulation.playing}
          rate={simulation.rate}
          currentTime={simulation.currentTime}
          rangeStart={RANGE_START}
          rangeEnd={RANGE_END}
          conjunctionMarkers={CONJUNCTION_MARKERS}
          filters={FILTER_OPTIONS.map((option) => ({ ...option, active: activeFilters.has(option.orbitClass) }))}
          onTogglePlay={simulation.togglePlaying}
          onCycleRate={simulation.cycleRate}
          onJumpToNow={simulation.jumpToNow}
          onScrub={simulation.setCurrentTime}
          onToggleFilter={toggleFilter}
        />
      </GlassSurface>

      <GlassSurface variant="floating" elevation={2} className="design-card">
        <h3>mode=&quot;object&quot;</h3>
        <TimeDock
          mode="object"
          object={DEMO_OBJECT}
          detail={{
            eccentricity: 0.0004,
            raanDeg: 247.46,
            argPericenterDeg: 130.5,
            meanAnomalyDeg: 325.0,
            epoch: new Date('2009-02-10T16:56:00Z'),
            mahalanobisDistance: 1.84,
            probabilityOfCollision: 4.2e-3,
          }}
          onBack={() => {}}
        />
      </GlassSurface>
    </section>
  );
}
