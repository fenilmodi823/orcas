import { apiBaseUrl, CatalogFetchError } from './catalog-client.js';

export interface ConjunctionParty {
  readonly noradId: string;
  readonly name: string;
  readonly elementSetEpochMs: number;
}

/**
 * One close approach from the latest screening run. There is no bare
 * probability: `maximumPc` is an upper bound over ellipses of `aspectRatio`,
 * and it is null when the 2D model does not apply (RA-12 §6–7).
 */
export interface Conjunction {
  readonly tcaMs: number;
  readonly missDistanceKm: number;
  readonly relativeSpeedKmS: number;
  readonly maximumPc: number | null;
  readonly aspectRatio: number;
  readonly hardBodyRadiusKm: number;
  readonly dilutionSigmaKm: number;
  readonly valid2d: boolean;
  readonly validityReason: string | null;
  readonly method: string;
  readonly primary: ConjunctionParty;
  readonly secondary: ConjunctionParty;
}

export interface ScreeningRun {
  readonly completedAtMs: number;
  readonly windowStartMs: number;
  readonly windowEndMs: number;
  readonly reportingDistanceKm: number;
}

export interface ConjunctionReport {
  /** Null until a screening run has completed — "not screened", never "clear". */
  readonly run: ScreeningRun | null;
  readonly items: readonly Conjunction[];
  /** Items the backend sent that failed validation and were dropped. */
  readonly rejected: number;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const time = (v: unknown): number | undefined => {
  const ms = typeof v === 'string' ? Date.parse(v) : Number.NaN;
  return Number.isFinite(ms) ? ms : undefined;
};

function party(raw: unknown): ConjunctionParty | undefined {
  if (!isObj(raw)) return undefined;
  const noradId = str(raw.norad_id);
  const name = str(raw.name);
  const elementSetEpochMs = time(raw.element_set_epoch);
  if (noradId === undefined || name === undefined || elementSetEpochMs === undefined) return undefined;
  return { noradId, name, elementSetEpochMs };
}

/** One item, or undefined if any field a display depends on is missing or malformed. */
export function parseConjunction(raw: unknown): Conjunction | undefined {
  if (!isObj(raw)) return undefined;
  const primary = party(raw.primary);
  const secondary = party(raw.secondary);
  const tcaMs = time(raw.tca);
  const missDistanceKm = num(raw.miss_distance_km);
  const relativeSpeedKmS = num(raw.relative_speed_km_s);
  const aspectRatio = num(raw.aspect_ratio);
  const hardBodyRadiusKm = num(raw.hard_body_radius_km);
  const dilutionSigmaKm = num(raw.dilution_sigma_km);
  const method = str(raw.method);
  const valid2d = typeof raw.valid_2d === 'boolean' ? raw.valid_2d : undefined;
  const maximumPc = raw.maximum_pc === null ? null : num(raw.maximum_pc);
  const validityReason = raw.validity_reason === null ? null : str(raw.validity_reason);
  if (
    !primary || !secondary || tcaMs === undefined || missDistanceKm === undefined ||
    relativeSpeedKmS === undefined || aspectRatio === undefined || hardBodyRadiusKm === undefined ||
    dilutionSigmaKm === undefined || method === undefined || valid2d === undefined ||
    maximumPc === undefined || validityReason === undefined ||
    // A number where the 2D model does not apply is exactly what must never reach a screen.
    (!valid2d && maximumPc !== null)
  ) {
    return undefined;
  }
  return {
    tcaMs, missDistanceKm, relativeSpeedKmS, maximumPc, aspectRatio, hardBodyRadiusKm,
    dilutionSigmaKm, valid2d, validityReason, method, primary, secondary,
  };
}

function parseRun(raw: unknown): ScreeningRun | null | undefined {
  if (raw === null) return null;
  if (!isObj(raw)) return undefined;
  const completedAtMs = time(raw.completed_at);
  const windowStartMs = time(raw.window_start);
  const windowEndMs = time(raw.window_end);
  const reportingDistanceKm = num(raw.reporting_distance_km);
  if (completedAtMs === undefined || windowStartMs === undefined || windowEndMs === undefined || reportingDistanceKm === undefined) {
    return undefined;
  }
  return { completedAtMs, windowStartMs, windowEndMs, reportingDistanceKm };
}

/** The latest screening run's close approaches for one object. */
export async function fetchConjunctions(noradId: string, signal?: AbortSignal): Promise<ConjunctionReport> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api/v1/conjunctions?norad_id=${encodeURIComponent(noradId)}&limit=200`, { signal });
  } catch (err) {
    throw new CatalogFetchError('network request for /conjunctions failed', err);
  }
  if (!res.ok) throw new CatalogFetchError(`GET /conjunctions -> ${res.status}`);
  const body: unknown = await res.json();
  const run = isObj(body) ? parseRun(body.run) : undefined;
  if (!isObj(body) || run === undefined || !Array.isArray(body.items)) {
    throw new CatalogFetchError('conjunctions response did not match the expected shape');
  }
  const items = body.items.map(parseConjunction).filter((c): c is Conjunction => c !== undefined);
  return { run, items, rejected: body.items.length - items.length };
}
