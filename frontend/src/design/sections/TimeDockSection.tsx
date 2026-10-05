import { GlassSurface } from '../../ui/GlassSurface.js';
import { TimeDock } from '../../ui/TimeDock.js';
import { useSimulationStore } from '../../state/simulation-store.js';
import { useViewStore } from '../../state/view-store.js';
import type { FilterClass, SelectableObject } from '../../state/selection-store.js';
import type { DetailGroup } from '../../ui/object-detail-model.js';

const RANGE_START = new Date('2009-02-10T00:00:00Z');
const RANGE_END = new Date('2009-02-11T00:00:00Z');
const CONJUNCTION_MARKERS = [new Date('2009-02-10T16:56:00Z')];

const FILTER_OPTIONS: readonly { orbitClass: FilterClass; label: string; count: number }[] = [
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
 * The object-mode detail groups for the gallery. Demo values only, so the
 * Conjunction group is deliberately absent: the ISS had no conjunction to
 * show, and the slot staying empty until Phase 5 fills it is itself a state
 * worth seeing.
 *
 * This card used to put D_M 1.84 and "P_c 4.2e-3" on the ISS. Those are the
 * paper's Table I figures for Cosmos 2251, from simulated covariance the paper
 * never states and that cannot be reproduced (RA-11, RA-12 §3.4) — and a bare
 * P_c is itself banned (RA-12 §7). Never let a gallery present them as a live
 * readout.
 */
const DEMO_GROUPS: readonly DetailGroup[] = [
  {
    id: 'identity',
    title: 'Identity',
    fields: [
      { label: 'NORAD ID', value: '25544' },
      { label: 'Int’l designator', value: '1998-067A' },
      { label: 'Type', value: 'Payload' },
      { label: 'Orbit class', value: 'LEO' },
    ],
  },
  {
    id: 'orbit',
    title: 'Orbit',
    fields: [
      { label: 'Inclination', value: 51.6, unit: '°', precision: 2 },
      { label: 'Eccentricity', value: 0.0004, precision: 5 },
      { label: 'RAAN', value: 247.46, unit: '°', precision: 2 },
    ],
  },
  {
    id: 'provenance',
    title: 'Provenance',
    fields: [
      { label: 'Element-set epoch', value: '2009-02-10 16:56:00 UTC' },
      { label: 'Source', value: 'demo values' },
    ],
  },
];

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
          onStepRate={simulation.stepRate}
          onSetTime={(ms) => simulation.setCurrentTime(new Date(ms))}
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
          groups={DEMO_GROUPS}
          onBack={() => {}}
        />
      </GlassSurface>
    </section>
  );
}
