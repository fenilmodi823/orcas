import type { Span } from './horizons-index.js';

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
  /** Stretches where the data jumps, as requested: [start, stop] TDB labels "YYYY-MM-DD hh:mm". */
  readonly jumps: readonly (readonly [string, string])[];
}

/** What a data sheet says about one object; moons carry only a name. */
export interface HorizonsObjectFacts {
  readonly name: string;
  readonly designator: string | null;
  readonly fitThrough: string | null;
  readonly fitQuote: string | null;
  readonly lastContact: string | null;
  readonly lastContactQuote: string | null;
  readonly notes: readonly string[];
}

export interface HorizonsManifest {
  /** The day the export was made, UTC, "YYYY-MM-DD". */
  readonly exportedDate: string;
  /** The same instant (earliest request), UTC ms. */
  readonly exportedUtcMs: number;
  /** Per NAIF id. */
  readonly objects: ReadonlyMap<number, HorizonsObjectFacts>;
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

const strOrNull = (v: unknown, what: string): string | null => (v === null || v === undefined ? null : str(v, what));

const SHEET_DATE = /^(\d{4})-(\d{2})(?:-(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?)?$/;

/** The instant a data sheet's date ends, UTC ms: a day or month includes all of itself. */
export function sheetDateEndUtcMs(text: string): number {
  const m = SHEET_DATE.exec(text);
  if (!m) throw new HorizonsManifestFormatError(`"${text}" is not a data-sheet date`);
  const [y, mo, d, h, mi, s] = m.slice(1).map((v) => (v === undefined ? undefined : Number(v)));
  if (y === undefined || mo === undefined) throw new HorizonsManifestFormatError(`"${text}" is not a data-sheet date`);
  if (d === undefined) return Date.UTC(y, mo); // month index mo is the next month
  if (h === undefined || mi === undefined) return Date.UTC(y, mo - 1, d + 1);
  return Date.UTC(y, mo - 1, d, h, mi, s ?? 0);
}

/** A Horizons TDB label "YYYY-MM-DD hh:mm" as ET, seconds past J2000 (TDB). */
export function tdbLabelEtS(label: string): number {
  return (Date.parse(`${label.replace(' ', 'T')}:00Z`) - Date.UTC(2000, 0, 1, 12)) / 1000;
}

function sheetDate(v: unknown, what: string): string | null {
  const text = strOrNull(v, what);
  if (text !== null) sheetDateEndUtcMs(text);
  return text;
}

function objectFacts(o: Record<string, unknown>, id: string): HorizonsObjectFacts {
  const notes = o.notes === undefined ? [] : o.notes;
  if (!Array.isArray(notes)) throw new HorizonsManifestFormatError(`object ${id} notes is not a list`);
  return {
    name: str(o.name, `object ${id} name`),
    designator: strOrNull(o.designator, `object ${id} designator`),
    fitThrough: sheetDate(o.fitThrough, `object ${id} fitThrough`),
    fitQuote: strOrNull(o.fitQuote, `object ${id} fitQuote`),
    lastContact: sheetDate(o.lastContact, `object ${id} lastContact`),
    lastContactQuote: strOrNull(o.lastContactQuote, `object ${id} lastContactQuote`),
    notes: notes.map((n: unknown, i) => str(n, `object ${id} note ${i}`)),
  };
}

function jumpsOf(v: unknown, i: number): readonly (readonly [string, string])[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new HorizonsManifestFormatError(`series ${i} jumpsInTheData is not a list`);
  return v.map((j: unknown): readonly [string, string] => {
    if (!Array.isArray(j) || j.length !== 2) throw new HorizonsManifestFormatError(`series ${i} has a jump that is not a pair`);
    return [str(j[0], `series ${i} jump start`), str(j[1], `series ${i} jump stop`)];
  });
}

/** Validate the manifest at the boundary (Rules §4): anything malformed throws, never reaches the screen. */
export function parseHorizonsManifest(json: unknown): HorizonsManifest {
  if (!isRecord(json) || !isRecord(json.objects) || !Array.isArray(json.series) || !Array.isArray(json.requests)) {
    throw new HorizonsManifestFormatError('expected objects, series and requests');
  }
  const sources = new Map<number, string>();
  const objects = new Map<number, HorizonsObjectFacts>();
  for (const [id, o] of Object.entries(json.objects)) {
    if (!isRecord(o)) continue;
    if (typeof o.horizonsSource === 'string') sources.set(Number(id), o.horizonsSource);
    objects.set(Number(id), objectFacts(o, id));
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
      jumps: jumpsOf(s.jumpsInTheData, i),
    };
  });
  const exported = json.requests.map((r: unknown, i) => str(isRecord(r) ? r.exportedUtc : undefined, `request ${i} exportedUtc`)).sort();
  const first = exported[0];
  if (!first) throw new HorizonsManifestFormatError('no requests');
  const exportedUtcMs = Date.parse(first);
  if (!Number.isFinite(exportedUtcMs)) throw new HorizonsManifestFormatError(`exportedUtc "${first}" is not a date`);
  return { exportedDate: first.slice(0, 10), exportedUtcMs, objects, sources, series };
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

/** Where flown ends and predicted begins for a target, UTC ms: the data sheet's fit date, else last contact, else the export. */
export function flownBoundary(m: HorizonsManifest, naifId: number): { utcMs: number; kind: 'fit' | 'last-contact' | 'export'; quote: string | null } {
  const o = m.objects.get(naifId);
  if (o?.fitThrough) return { utcMs: sheetDateEndUtcMs(o.fitThrough), kind: 'fit', quote: o.fitQuote };
  if (o?.lastContact) return { utcMs: sheetDateEndUtcMs(o.lastContact), kind: 'last-contact', quote: o.lastContactQuote };
  return { utcMs: m.exportedUtcMs, kind: 'export', quote: o?.fitQuote ?? null };
}

/** Every jump in a target's data, all its series, as ET spans (seconds past J2000, TDB). */
export function jumpSpans(m: HorizonsManifest, naifId: number): Span[] {
  return m.series.filter((s) => s.target === naifId).flatMap((s) => s.jumps.map(([a, b]): Span => [tdbLabelEtS(a), tdbLabelEtS(b)]));
}
