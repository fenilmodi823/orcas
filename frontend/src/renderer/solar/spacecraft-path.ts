// frontend/src/renderer/solar/spacecraft-path.ts
import type { HorizonsIndex, Span } from '../../data/horizons-index.js';
import { etSecondsFromUtcMs } from '../../data/planet-ephemeris.js';
import { osculatingPeriodS } from './moon-trails.js';
import { SEGMENT_FLOWN, SEGMENT_HIDDEN, SEGMENT_PREDICTED, centreGmKm3S2, inJump, straddles } from './spacecraft-trail.js';

/** Points in a selected spacecraft's whole path. */
export const MISSION_PATH_MAX_POINTS = 8192;
/** Fewer samples than this per osculating orbit and the segments are chords, not the orbit: hidden. */
export const MIN_SAMPLES_PER_ORBIT = 16;

const _s = new Float64Array(6);

/**
 * How long the path takes to curve through a full turn at this state (ICRF km, km/s about a centre of μ km³/s²), s:
 * the osculating period on an ellipse; on a hyperbola, 2π over the velocity's turning rate μh/(r³v²), which is long on
 * a near-straight approach and short at a flyby's closest point.
 */
function curveTimeS(s: Float64Array, gm: number): number {
  const [x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0] = s;
  const r = Math.hypot(x, y, z);
  const v2 = vx * vx + vy * vy + vz * vz;
  if (v2 / 2 - gm / r < 0) return osculatingPeriodS(s, gm);
  const h = Math.hypot(y * vz - z * vy, z * vx - x * vz, x * vy - y * vx);
  return (2 * Math.PI * r * r * r * v2) / (gm * h);
}

/**
 * The selected spacecraft's whole path in the frame it is in now: points in ICRF km relative to `centre` (NAIF id),
 * 3 per point in time order across every span of the export, and one kind per segment. Samples are uniform in time,
 * shared between the spans in proportion to their length (at least 2 each). A sample whose centre is not `centre`
 * repeats the previous point and hides its segments; the segment joining two spans is hidden; jumps (ET s) and the
 * flown date (UTC ms) are handled as in `writeSpacecraftTrail`. A sample spaced more than 1/`MIN_SAMPLES_PER_ORBIT` of its
 * curve time about `centre` (`curveTimeS`) hides its segments too (LRO's 2 h orbit at one sample an hour draws chords across the
 * Moon); the trail still shows its orbit. Returns the point count (>= 2), or 0 with no point
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
  const gm = centreGmKm3S2(centre);
  // ponytail: uniform in time, so a long orbit tour gets about one point a day and its periapses look faceted;
  // adaptive by curvature if it reads badly.
  const counts = spans.map(([a, b]) => Math.max(2, Math.round((MISSION_PATH_MAX_POINTS * (b - a)) / (total || 1))));
  // Take any overshoot from the largest spans, one point at a time, so every span keeps at least 2.
  for (let excess = counts.reduce((x, y) => x + y, 0) - MISSION_PATH_MAX_POINTS; excess > 0; excess--) {
    let big = 0;
    for (let i = 1; i < counts.length; i++) if (counts[i]! > counts[big]!) big = i;
    if (counts[big]! <= 2) break;
    counts[big]!--;
  }
  let k = 0;
  let firstValid = -1;
  let prevEtS = NaN;
  let prevOk = false;
  spans.forEach(([a, b], s) => {
    const n = counts[s]!;
    const stepS = (b - a) / (n - 1);
    for (let j = 0; j < n; j++, k++) {
      const etS = a + ((b - a) * j) / (n - 1);
      const valid = index.stateInto(naifId, etS, _s) === centre;
      const ok = valid && (gm === null || stepS * MIN_SAMPLES_PER_ORBIT <= curveTimeS(_s, gm));
      if (valid) {
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
