import { TT_MINUS_UTC_S } from '@orcas/physics';
import { hermiteState, type Vec3 } from '../propagation/hermite.js';

/**
 * Reader for the planet ephemeris `scripts/data/bake_planets.py` bakes from
 * JPL DE421 (S3, B.16): per body, position and velocity keyframes relative to
 * the Solar System barycentre, ICRF, km and km/s, on an ET grid. Positions
 * between keyframes come from the same cubic Hermite as the satellites (M1.1).
 * Layout: see the script's docstring.
 */

const MAGIC = 'ORCASPL1';
const HEADER_BYTES = 12; // 8s + u32
const ENTRY_BYTES = 28; // i32 + u32 + f64 + f64 + u32, no padding under struct '<'
const FLOATS_PER_KEYFRAME = 6;
/** J2000 (2000-01-01 12:00), as a UTC label, in seconds since 1970. */
const J2000_LABEL_S = Date.UTC(2000, 0, 1, 12) / 1000;

/** What the file carries. Jupiter to Neptune are system barycentres: DE421 has no planet-centre segment for them. */
export const EPHEMERIS_BODIES = [
  { naifId: 10, name: 'Sun', barycentre: false },
  { naifId: 199, name: 'Mercury', barycentre: false },
  { naifId: 299, name: 'Venus', barycentre: false },
  { naifId: 399, name: 'Earth', barycentre: false },
  { naifId: 499, name: 'Mars', barycentre: false },
  { naifId: 5, name: 'Jupiter', barycentre: true },
  { naifId: 6, name: 'Saturn', barycentre: true },
  { naifId: 7, name: 'Uranus', barycentre: true },
  { naifId: 8, name: 'Neptune', barycentre: true },
] as const;

interface BodyKeyframes {
  readonly firstEtS: number;
  readonly stepS: number;
  /** [x, y, z, vx, vy, vz] per keyframe; km, km/s. */
  readonly states: Float32Array;
}

export interface PlanetEphemeris {
  readonly bodies: ReadonlyMap<number, BodyKeyframes>;
}

export class PlanetEphemerisFormatError extends Error {
  constructor(message: string) {
    super(`Planet ephemeris: ${message}`);
    this.name = 'PlanetEphemerisFormatError';
  }
}

/** Parse the baked file. Throws `PlanetEphemerisFormatError` on anything malformed. */
export function parsePlanetEphemeris(buffer: ArrayBuffer): PlanetEphemeris {
  if (buffer.byteLength < HEADER_BYTES) throw new PlanetEphemerisFormatError(`file is only ${buffer.byteLength} bytes`);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 8));
  if (magic !== MAGIC) throw new PlanetEphemerisFormatError(`expected magic "${MAGIC}", found "${magic}"`);
  const view = new DataView(buffer);
  const count = view.getUint32(8, true);
  const bodies = new Map<number, BodyKeyframes>();
  for (let i = 0; i < count; i++) {
    const at = HEADER_BYTES + i * ENTRY_BYTES;
    if (at + ENTRY_BYTES > buffer.byteLength) throw new PlanetEphemerisFormatError(`body ${i}'s entry is past the end`);
    const naifId = view.getInt32(at, true);
    const keyframes = view.getUint32(at + 4, true);
    const offset = view.getUint32(at + 24, true);
    const bytes = keyframes * FLOATS_PER_KEYFRAME * 4;
    if (keyframes < 2 || offset + bytes > buffer.byteLength) {
      throw new PlanetEphemerisFormatError(`NAIF ${naifId} claims ${keyframes} keyframes at byte ${offset}`);
    }
    bodies.set(naifId, {
      firstEtS: view.getFloat64(at + 8, true),
      stepS: view.getFloat64(at + 16, true),
      states: new Float32Array(buffer.slice(offset, offset + bytes)),
    });
  }
  return { bodies };
}

function endpoint(states: Float32Array, k: number) {
  const i = k * FLOATS_PER_KEYFRAME;
  return {
    position: { x: states[i] ?? NaN, y: states[i + 1] ?? NaN, z: states[i + 2] ?? NaN },
    velocity: { x: states[i + 3] ?? NaN, y: states[i + 4] ?? NaN, z: states[i + 5] ?? NaN },
  };
}

/**
 * A body's position at a UTC instant, or null outside the baked span or for a
 * body the file does not carry. ET = UTC + 69.184 s, the convention the Sun
 * and Moon use; before 2017 it is up to about a minute off. Input: NAIF id,
 * UTC ms. Output: km, ICRF, relative to the Solar System barycentre.
 */
export function bodyPositionKm(ephemeris: PlanetEphemeris, naifId: number, utcMs: number): Vec3 | null {
  const body = ephemeris.bodies.get(naifId);
  if (!body) return null;
  const etS = utcMs / 1000 + TT_MINUS_UTC_S - J2000_LABEL_S;
  const u = (etS - body.firstEtS) / body.stepS;
  const last = body.states.length / FLOATS_PER_KEYFRAME - 1;
  if (!(u >= 0 && u <= last)) return null;
  const k = Math.min(Math.floor(u), last - 1);
  return hermiteState(endpoint(body.states, k), endpoint(body.states, k + 1), body.stepS, u - k).position;
}
