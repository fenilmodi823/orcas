/**
 * `(snapshotVersion, epochTicks)` is a complete description of the
 * simulation's world state (brief §E.5) — camera and selection are UI
 * state, serialised separately, not part of this coordinate.
 */
export interface SimulationCoordinate {
  readonly snapshotVersion: number;
  readonly epochTicks: number;
}

const SV_PARAM = 'sv';
const TICKS_PARAM = 't';

/** Writes the coordinate into a copy of `search`, preserving any other
 * params already present. Does not mutate its input. */
export function encodeSimulationCoordinate(
  search: URLSearchParams,
  coordinate: SimulationCoordinate,
): URLSearchParams {
  const next = new URLSearchParams(search);
  next.set(SV_PARAM, String(coordinate.snapshotVersion));
  next.set(TICKS_PARAM, String(coordinate.epochTicks));
  return next;
}

/** Reads the coordinate back out. Returns `null` if either field is
 * missing or not an integer — malformed input is rejected, never
 * silently coerced (Rules.md: "Malformed upstream data: reject at
 * validation"). */
export function parseSimulationCoordinate(search: URLSearchParams): SimulationCoordinate | null {
  if (!search.has(SV_PARAM) || !search.has(TICKS_PARAM)) return null;
  const snapshotVersion = Number(search.get(SV_PARAM));
  const epochTicks = Number(search.get(TICKS_PARAM));
  if (!Number.isInteger(snapshotVersion) || !Number.isInteger(epochTicks)) return null;
  return { snapshotVersion, epochTicks };
}
