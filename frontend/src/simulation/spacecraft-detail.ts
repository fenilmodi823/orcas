import { moonSystem, moonSystemStatus } from '../data/moon-systems.js';
import { etSecondsFromUtcMs } from '../data/planet-ephemeris.js';
import { flownBoundary, moonAccuracy, requestedSpans, type HorizonsManifest } from '../data/horizons-manifest.js';
import type { Body } from '../renderer/solar/bodies.js';
import { CENTRE_BODY, SPACECRAFT } from '../renderer/solar/spacecraft.js';
import type { DetailField, DetailGroup } from '../ui/object-detail-model.js';

const FAILED = 'The export’s details could not be loaded, so its flown and predicted dates are not shown, and its path is not drawn.';

/** The body a Horizons centre (NAIF id) is, as the panel names it. */
export const spacecraftCentreName = (centre: number): string => CENTRE_BODY[centre]?.label ?? `NAIF ${centre}`;

const _state = new Float64Array(6);

/** The centre a spacecraft is near at a UTC instant and its distance from it, km (the state's own vector, ICRF). Null outside its spans. */
export function spacecraftCentreDistance(body: Body, epochMs: number): { label: string; km: number } | null {
  if (body.kind !== 'spacecraft' || !body.horizons) return null;
  const centre = moonSystem('spacecraft')?.stateInto(body.horizons.naifId, etSecondsFromUtcMs(epochMs), _state);
  if (centre === null || centre === undefined) return null;
  return { label: spacecraftCentreName(centre), km: Math.hypot(_state[0] ?? 0, _state[1] ?? 0, _state[2] ?? 0) };
}

/** Voyagers' rough years and how far this export's Saturn flyby is from the mission record (README cross-check, NASA PDS). */
const ROUGH: Readonly<Record<number, { before: string; km: string }>> = {
  [-31]: { before: 'Before 1981', km: '43,587 to 46,656 km' },
  [-32]: { before: 'Before 1989-08-29', km: '38,859 to 42,032 km' },
};

/** The sheet's own boundary date: with its time if it gives one. */
function flownUntil(manifest: HorizonsManifest, naifId: number): string {
  const o = manifest.objects.get(naifId);
  const date = o?.fitThrough ?? o?.lastContact ?? manifest.exportedDate;
  return date.length > 10 ? `${date} UTC` : date;
}

const BASIS = { fit: 'Data sheet: fit', 'last-contact': 'Data sheet: last contact', export: 'Export date (the sheet states none)' } as const;

function positionGroup(naifId: number, manifest: HorizonsManifest | null | undefined): DetailGroup {
  const fields: DetailField[] = [{ label: 'Source', value: 'JPL Horizons', text: true }];
  if (!manifest) {
    return { id: 'provenance', title: 'Position', fields, note: manifest === undefined ? 'Loading the export’s details…' : FAILED };
  }
  const accuracy = moonAccuracy(manifest, naifId);
  fields.push(
    { label: 'Exported', value: `${manifest.exportedDate} UTC` },
    { label: 'Trajectory', value: manifest.sources.get(naifId) ?? 'Not stated' },
    { label: 'Requested (TDB)', value: requestedSpans(manifest, naifId), wide: true },
  );
  if (accuracy.worstMeasured !== null) fields.push({ label: 'Worst error, measured', value: accuracy.worstMeasured, precision: 3 });
  if (accuracy.worstEstimated !== null) fields.push({ label: 'Estimated, kept stretches', value: accuracy.worstEstimated, precision: 3 });
  if (accuracy.unmeasured > 0) fields.push({ label: 'Not measured', value: `${accuracy.unmeasured} stretch${accuracy.unmeasured > 1 ? 'es' : ''}` });
  return {
    id: 'provenance',
    title: 'Position',
    fields,
    note:
      'Relative to the body it is near — the Sun’s barycentre, the Earth, the Moon or a planet — which JPL DE421 places (the Moon: the scene’s own). ' +
      'Shown only within the requested spans.',
  };
}

/** A spacecraft's panel groups (S6c1), quoting its data sheet. `manifest` is undefined while it loads and null if it failed. */
export function spacecraftDetailGroups(body: Body, manifest: HorizonsManifest | null | undefined): DetailGroup[] {
  const craft = SPACECRAFT.find((s) => s.id === body.id);
  if (body.kind !== 'spacecraft' || !craft) return [];
  const { naifId } = craft;
  const facts = manifest?.objects.get(naifId);
  const groups: DetailGroup[] = [
    {
      id: 'identity',
      title: 'Spacecraft',
      fields: [
        { label: 'Type', value: 'Spacecraft', text: true },
        { label: 'Designator', value: facts?.designator ?? 'Not stated', text: true },
        { label: 'Data', value: `${craft.years[0]} – ${craft.years[1]}`, text: true },
      ],
    },
    positionGroup(naifId, manifest),
  ];
  if (!manifest) return groups;
  const boundary = flownBoundary(manifest, naifId);
  groups.push({
    id: 'flown',
    title: 'Flown and predicted',
    fields: [
      { label: 'Flown until', value: flownUntil(manifest, naifId), text: true },
      { label: 'Basis', value: BASIS[boundary.kind], text: true, wide: true },
    ],
    note: [boundary.quote === null ? null : `“${boundary.quote}”`, ...(facts?.notes ?? [])].filter((n) => n !== null).join(' '),
  });
  const rough = ROUGH[naifId];
  if (rough) {
    groups.push({
      id: 'rough',
      title: 'Rough years',
      fields: [{ label: 'Rough years', value: rough.before, text: true }],
      note:
        'The data sheet calls these years “a patched conic mission-design type trajectory … providing a rough accuracy”. ' +
        `Measured from the Sun at its Saturn flyby, this export differs from the mission record (NASA PDS) by ${rough.km}.`,
    });
  }
  return groups;
}

/** What the panel says while a spacecraft has no position (Rules §4: never blank, never a guess). */
export function spacecraftPendingNote(body: Body, _ephemerisLoaded: boolean, manifest: HorizonsManifest | null | undefined): string {
  if (!body.horizons) return 'Computing position…';
  const status = moonSystemStatus('spacecraft');
  const failed = manifest === null ? ` ${FAILED}` : '';
  if (status === 'failed') return `Position unavailable: the spacecraft data did not load.${failed}`;
  if (status === 'ready') {
    return (manifest ? `No data at this time. The export covers: ${requestedSpans(manifest, body.horizons.naifId)}.` : 'No data at this time.') + failed;
  }
  return `Loading the spacecraft trajectories…${failed}`;
}
