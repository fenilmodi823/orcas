// frontend/src/renderer/solar/spacecraft-path.ts
import type { HorizonsIndex, Span } from '../../data/horizons-index.js';
import { etSecondsFromUtcMs } from '../../data/planet-ephemeris.js';
import { SEGMENT_FLOWN, SEGMENT_HIDDEN, SEGMENT_PREDICTED, inJump, straddles } from './spacecraft-trail.js';

/** Points in a selected spacecraft's whole path. */
export const MISSION_PATH_MAX_POINTS = 8192;

const _s = new Float64Array(6);

/**
 * The selected spacecraft's whole path in the frame it is in now: points in ICRF km relative to `centre` (NAIF id),
 * 3 per point in time order across every span of the export, and one kind per segment. Samples are uniform in time,
 * shared between the spans in proportion to their length (at least 2 each). A sample whose centre is not `centre`
 * repeats the previous point and hides its segments; the segment joining two spans is hidden; jumps (ET s) and the
 * flown date (UTC ms) are handled as in `writeSpacecraftTrail`. Returns the point count (>= 2), or 0 with nothing
 * written when no sample has that centre. Called once per selection, so it allocates.
 */
export function writeMissionPath(
  index: HorizonsIndex,
  naifId: number,
  centre: number,
  flownUntilUtcMs: number,
  jumps: readonly Span[],
  outKm: Float64Array,
  kinds: Uint8Array,
): number {
  const spans = index.spans(naifId);
  const total = spans.reduce((sum, [a, b]) => sum + (b - a), 0);
  if (spans.length === 0) return 0;
  const flownUntilEtS = etSecondsFromUtcMs(flownUntilUtcMs);
  // ponytail: uniform in time, so a long orbit tour gets about one point a day and its periapses look faceted;
  // adaptive by curvature if it reads badly.
  const counts = spans.map(([a, b]) => Math.max(2, Math.round((MISSION_PATH_MAX_POINTS * (b - a)) / (total || 1))));
  counts[counts.length - 1]! -= counts.reduce((x, y) => x + y, 0) - MISSION_PATH_MAX_POINTS;
  let k = 0;
  let firstValid = -1;
  let prevEtS = NaN;
  let prevOk = false;
  spans.forEach(([a, b], s) => {
    const n = counts[s]!;
    for (let j = 0; j < n; j++, k++) {
      const etS = a + ((b - a) * j) / (n - 1);
      const ok = index.stateInto(naifId, etS, _s) === centre;
      if (ok) {
        if (firstValid < 0) firstValid = k;
        outKm.set(_s.subarray(0, 3), k * 3);
      } else if (firstValid >= 0) {
        outKm.copyWithin(k * 3, (k - 1) * 3, k * 3);
      }
      if (k > 0) {
        const hidden = !ok || !prevOk || (j === 0 && s > 0) || inJump(etS, jumps) || inJump(prevEtS, jumps) || straddles(prevEtS, etS, jumps);
        kinds[k - 1] = hidden ? SEGMENT_HIDDEN : etS > flownUntilEtS ? SEGMENT_PREDICTED : SEGMENT_FLOWN;
      }
      prevEtS = etS;
      prevOk = ok;
    }
  });
  if (firstValid < 0) return 0;
  for (let i = 0; i < firstValid; i++) outKm.copyWithin(i * 3, firstValid * 3, firstValid * 3 + 3);
  return k;
}
