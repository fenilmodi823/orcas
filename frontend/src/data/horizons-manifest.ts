/** What the panel needs from the S6a export's manifest (`public/ephemeris/horizons/manifest.json`). */
export interface HorizonsSeriesFacts {
  readonly target: number;
  readonly centre: number;
  /** As requested from Horizons, TDB, "YYYY-MM-DD hh:mm". */
  readonly start: string;
  readonly stop: string;
  readonly worstErrorMeasured: number | null;
  readonly segmentsAtExportStep: number;
  readonly worstErrorAtExportStepEstimated: number | null;
}

export interface HorizonsManifest {
  /** The day the export was made, UTC, "YYYY-MM-DD". */
  readonly exportedDate: string;
  /** Each object's Horizons trajectory, e.g. 501 → "jup365_merged". */
  readonly sources: ReadonlyMap<number, string>;
  readonly series: readonly HorizonsSeriesFacts[];
}

export class HorizonsManifestFormatError extends Error {
  constructor(message: string) {
    super(`Horizons manifest: ${message}`);
    this.name = 'HorizonsManifestFormatError';
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
function num(v: unknown, what: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new HorizonsManifestFormatError(`${what} is not a number`);
  return v;
}
const numOrNull = (v: unknown, what: string): number | null => (v === null || v === undefined ? null : num(v, what));
function str(v: unknown, what: string): string {
  if (typeof v !== 'string') throw new HorizonsManifestFormatError(`${what} is not text`);
  return v;
}

/** Validate the manifest at the boundary (Rules §4): anything malformed throws, never reaches the screen. */
export function parseHorizonsManifest(json: unknown): HorizonsManifest {
  if (!isRecord(json) || !isRecord(json.objects) || !Array.isArray(json.series) || !Array.isArray(json.requests)) {
    throw new HorizonsManifestFormatError('expected objects, series and requests');
  }
  const sources = new Map<number, string>();
  for (const [id, o] of Object.entries(json.objects)) {
    if (isRecord(o) && typeof o.horizonsSource === 'string') sources.set(Number(id), o.horizonsSource);
  }
  const series = json.series.map((s: unknown, i): HorizonsSeriesFacts => {
    if (!isRecord(s)) throw new HorizonsManifestFormatError(`series ${i} is not an object`);
    return {
      target: num(s.target, `series ${i} target`),
      centre: num(s.centre, `series ${i} centre`),
      start: str(s.start, `series ${i} start`),
      stop: str(s.stop, `series ${i} stop`),
      worstErrorMeasured: numOrNull(s.worstErrorMeasured, `series ${i} worstErrorMeasured`),
      segmentsAtExportStep: num(s.segmentsAtExportStep, `series ${i} segmentsAtExportStep`),
      worstErrorAtExportStepEstimated: numOrNull(s.worstErrorAtExportStepEstimated, `series ${i} estimate`),
    };
  });
  const exported = json.requests.map((r: unknown, i) => str(isRecord(r) ? r.exportedUtc : undefined, `request ${i} exportedUtc`)).sort();
  const first = exported[0];
  if (!first) throw new HorizonsManifestFormatError('no requests');
  return { exportedDate: first.slice(0, 10), sources, series };
}

const seriesOf = (m: HorizonsManifest, naifId: number) => m.series.filter((s) => s.target === naifId).sort((a, b) => a.start.localeCompare(b.start));

/** A target's spans as requested, dates only: "1973-11-14 – 1974-12-23 · …". */
export function requestedSpans(m: HorizonsManifest, naifId: number): string {
  // No-break spaces inside a span, so a narrow panel wraps between spans, never inside one.
  return seriesOf(m, naifId).map((s) => `${s.start.slice(0, 10)}\u00a0–\u00a0${s.stop.slice(0, 10)}`).join(' · ');
}

/**
 * A target's accuracy across its series, as fractions of its distance from its centre: the worst measured where
 * the bake dropped samples (0 means none was dropped, so none measured), the worst estimated where it kept every
 * sample, and how many such stretches have no estimate at all (NASA-STD-7009B [M&S 33]: say so).
 */
export function moonAccuracy(m: HorizonsManifest, naifId: number): { worstMeasured: number | null; worstEstimated: number | null; unmeasured: number } {
  let worstMeasured: number | null = null;
  let worstEstimated: number | null = null;
  let unmeasured = 0;
  for (const s of seriesOf(m, naifId)) {
    if (s.worstErrorMeasured) worstMeasured = Math.max(worstMeasured ?? 0, s.worstErrorMeasured);
    if (s.worstErrorAtExportStepEstimated) worstEstimated = Math.max(worstEstimated ?? 0, s.worstErrorAtExportStepEstimated);
    else unmeasured += s.segmentsAtExportStep;
  }
  return { worstMeasured, worstEstimated, unmeasured };
}
