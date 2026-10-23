import { moonSystemStatus } from '../data/moon-systems.js';
import { moonAccuracy, requestedSpans, type HorizonsManifest } from '../data/horizons-manifest.js';
import { bodyById, type Body } from '../renderer/solar/bodies.js';
import { MOON_MAPS, MOON_NO_MAP_NOTE } from '../renderer/solar/moon-maps.js';
import { MOONS } from '../renderer/solar/moons.js';
import type { DetailField, DetailGroup } from '../ui/object-detail-model.js';

/** A major moon's panel groups (S6b). There is no description: none is written until one is sourced (B.23). */
/** `manifest` is undefined while it loads and null if it failed. */
export function moonDetailGroups(body: Body, manifest: HorizonsManifest | null | undefined): DetailGroup[] {
  const moon = MOONS.find((m) => m.id === body.id);
  const planet = body.parent ? bodyById(body.parent) : undefined;
  if (!moon || !planet || !body.horizons) return [];
  const [a, b, c] = moon.radiiKm;
  const map = MOON_MAPS[moon.id];
  const irregular = moon.system === 'mars' ? ' Phobos and Deimos are irregular bodies, which an ellipsoid only approximates.' : '';
  const centre = moon.system === 'mars' ? 'Mars’s centre' : `the ${planet.name} system’s barycentre`;
  const fields: DetailField[] = [{ label: 'Source', value: 'JPL Horizons' }];
  let note =
    manifest === undefined
      ? 'Loading the export’s details…'
      : 'The export’s details could not be loaded, so its date, spans and accuracy are not shown.';
  if (manifest) {
    const accuracy = moonAccuracy(manifest, moon.naifId);
    fields.push(
      { label: 'Exported', value: `${manifest.exportedDate} UTC` },
      { label: 'Trajectory', value: manifest.sources.get(moon.naifId) ?? 'Not stated' },
      { label: 'Requested (TDB)', value: requestedSpans(manifest, moon.naifId), wide: true },
    );
    // Four figures: at three, Io's measured 9.997 × 10⁻⁵ reads as the 1 × 10⁻⁴ target itself.
    if (accuracy.worstMeasured !== null) fields.push({ label: 'Worst error, measured', value: accuracy.worstMeasured, precision: 3 });
    if (accuracy.worstEstimated !== null) fields.push({ label: 'Estimated, kept stretches', value: accuracy.worstEstimated, precision: 3 });
    if (accuracy.unmeasured > 0) fields.push({ label: 'Not measured', value: `${accuracy.unmeasured} stretch${accuracy.unmeasured > 1 ? 'es' : ''}` });
    note =
      `Relative to ${centre}, which JPL DE421 places. Errors are fractions of the distance from that centre: ` +
      'measured at every sample the bake dropped; where it kept every sample there is nothing between them to measure, ' +
      'so the error is estimated from coarser steps, or not at all. Shown only within the requested spans; ' +
      'TT = UTC + 69.184 s exactly since 2017; TDB stays within 2 ms of TT.';
  }
  return [
    {
      id: 'identity',
      title: 'Body',
      fields: [
        { label: 'Type', value: 'Moon' },
        { label: 'Moon of', value: planet.name },
        { label: 'Radii', value: `${a} × ${b} × ${c}`, unit: 'km', wide: true },
      ],
      note: `IAU 2015 (Archinal et al. 2018), as NAIF’s pck00011 carries them. Drawn as this ellipsoid, turned by its IAU pole and prime meridian.${irregular}`,
    },
    { id: 'provenance', title: 'Position', fields, note },
    {
      id: 'map',
      title: 'Map',
      fields: [{ label: 'Source', value: map?.source ?? 'None' }],
      note: map?.note ?? MOON_NO_MAP_NOTE[moon.id] ?? 'No map.',
    },
  ];
}

/** What the panel says while a moon has no position (Rules §4: never blank, never a guess). */
export function moonPendingNote(body: Body, ephemerisLoaded: boolean): string {
  if (!body.horizons || !ephemerisLoaded) return 'Computing position…';
  const status = moonSystemStatus(body.horizons.system);
  if (status === 'failed') return 'Position unavailable: this moon’s data did not load.';
  if (status === 'ready') return 'No data at this time: the JPL Horizons export does not cover it.';
  return 'Loading this moon’s trajectory…';
}
