import { eciToGeodeticDeg, gmstRad, propagate, PropagationFailedError, type satrecFromOmm } from '@orcas/physics';
import type { ObjectMeta } from './catalog-types.js';
import { formatEpochUtc } from './catalog-provenance.js';

type SatRec = ReturnType<typeof satrecFromOmm>;

export interface EphemerisExportOptions {
  readonly startMs: number;
  readonly durationS: number;
  readonly stepS: number;
  /** Wall-clock time the file is generated, for its header. */
  readonly generatedMs: number;
}

const COLUMNS = [
  'utc',
  'offset_s',
  'x_teme_km',
  'y_teme_km',
  'z_teme_km',
  'vx_teme_km_s',
  'vy_teme_km_s',
  'vz_teme_km_s',
  'latitude_deg',
  'longitude_deg',
  'altitude_wgs84_km',
  'speed_km_s',
];

/**
 * The selected object's SGP4 ephemeris as CSV, with a `#`-prefixed header
 * that says what every number is: the element-set epoch and source it rests
 * on, the propagator, and each column's frame and unit. Positions and
 * velocities are TEME, straight from SGP4; geodetic values are WGS84.
 * Rows stop at the first instant SGP4 cannot propagate, and the header says
 * so — a truncated file never passes for a complete one. Header lines are
 * comments, not fields (read with e.g. pandas `comment='#'`); no data field
 * contains a comma, so none needs quoting.
 */
export function ephemerisCsv(object: ObjectMeta, satrec: SatRec, options: EphemerisExportOptions): string {
  const rows: string[] = [];
  let failedAtMs: number | null = null;
  for (let offset = 0; offset <= options.durationS; offset += options.stepS) {
    const at = new Date(options.startMs + offset * 1000);
    let state;
    try {
      state = propagate(satrec, at, object.norad);
    } catch (error) {
      if (!(error instanceof PropagationFailedError)) throw error;
      failedAtMs = at.getTime();
      break;
    }
    const p = state.positionEciKm;
    const v = state.velocityEciKmS;
    const geo = eciToGeodeticDeg(p, gmstRad(at));
    rows.push(
      [
        at.toISOString(),
        String(offset),
        p.x.toFixed(6),
        p.y.toFixed(6),
        p.z.toFixed(6),
        v.x.toFixed(9),
        v.y.toFixed(9),
        v.z.toFixed(9),
        geo.latitudeDeg.toFixed(6),
        geo.longitudeDeg.toFixed(6),
        geo.altitudeKm.toFixed(6),
        Math.hypot(v.x, v.y, v.z).toFixed(9),
      ].join(','),
    );
  }

  const header = [
    '# ORCAS ephemeris export',
    `# Object: ${object.name} (NORAD ${object.norad}, ${object.objectId})`,
    `# Element-set epoch: ${formatEpochUtc(object.epochMs)}; source: ${object.source}`,
    '# Propagator: SGP4 (satellite.js via @orcas/physics). Positions are SGP4 predictions from public element sets, not observations.',
    '# Frames: x/y/z and vx/vy/vz in TEME (km, km/s); latitude/longitude/altitude geodetic on WGS84 (deg, deg, km).',
    `# Window: ${new Date(options.startMs).toISOString()} + ${options.durationS} s at ${options.stepS} s steps`,
    ...(failedAtMs === null ? [] : [`# TRUNCATED: SGP4 could not propagate at ${new Date(failedAtMs).toISOString()}; rows stop there.`]),
    `# Generated: ${new Date(options.generatedMs).toISOString()}`,
  ];

  return [...header, COLUMNS.join(','), ...rows].join('\n') + '\n';
}

/** A file name safe on every OS: object name, NORAD, start time. */
export function ephemerisFileName(object: ObjectMeta, startMs: number): string {
  const name = object.name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const stamp = new Date(startMs).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${name}_${object.norad}_${stamp}Z.csv`;
}
