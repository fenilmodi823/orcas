import type { HermiteEndpoint, Vec3 } from '../propagation/hermite.js';
import { hermiteWindow, windowStart } from '../propagation/hermite-window.js';
import { etSecondsFromUtcMs } from './planet-ephemeris.js';

/**
 * Reader for the spacecraft and moon trajectories `scripts/data/bake_horizons.py`
 * bakes from the S6 JPL Horizons export (S6a, B.26, B.27). Each segment holds
 * position and velocity keyframes at a fixed step, relative to its centre (a
 * NAIF id), ICRF, km and km/s, on an ET grid, with its own interpolation
 * window W (SPK type 13). Per target, segments come finest export step first:
 * the first that covers an instant is the one to use. Layout: see the script.
 */

const MAGIC = 'ORCASHZ1';
const HEADER_BYTES = 12; // 8s + u32
const ENTRY_BYTES = 36; // i32 + i32 + u32 + f64 + f64 + u32 + u32, no padding under struct '<'
const FLOATS_PER_KEYFRAME = 6;

export interface HorizonsSegment {
  readonly target: number;
  readonly centre: number;
  readonly firstEtS: number;
  readonly stepS: number;
  readonly window: number;
  /** [x, y, z, vx, vy, vz] per keyframe; km, km/s, relative to `centre`. */
  readonly states: Float32Array;
}

export interface HorizonsEphemeris {
  /** Per target NAIF id, its segments in the order to search them. */
  readonly segments: ReadonlyMap<number, readonly HorizonsSegment[]>;
}

export interface CentredState extends HermiteEndpoint {
  /** NAIF id of the body the position is relative to. */
  readonly centre: number;
}

export class HorizonsEphemerisFormatError extends Error {
  constructor(message: string) {
    super(`Horizons ephemeris: ${message}`);
    this.name = 'HorizonsEphemerisFormatError';
  }
}

/** Parse one baked file. Throws `HorizonsEphemerisFormatError` on anything malformed. */
export function parseHorizonsEphemeris(buffer: ArrayBuffer): HorizonsEphemeris {
  if (buffer.byteLength < HEADER_BYTES) throw new HorizonsEphemerisFormatError(`file is only ${buffer.byteLength} bytes`);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 8));
  if (magic !== MAGIC) throw new HorizonsEphemerisFormatError(`expected magic "${MAGIC}", found "${magic}"`);
  const view = new DataView(buffer);
  const count = view.getUint32(8, true);
  const segments = new Map<number, HorizonsSegment[]>();
  for (let i = 0; i < count; i++) {
    const at = HEADER_BYTES + i * ENTRY_BYTES;
    if (at + ENTRY_BYTES > buffer.byteLength) throw new HorizonsEphemerisFormatError(`segment ${i}'s entry is past the end`);
    const target = view.getInt32(at, true);
    const keyframes = view.getUint32(at + 8, true);
    const window = view.getUint32(at + 28, true);
    const offset = view.getUint32(at + 32, true);
    const bytes = keyframes * FLOATS_PER_KEYFRAME * 4;
    if (keyframes < 2 || window < 2 || offset + bytes > buffer.byteLength) {
      throw new HorizonsEphemerisFormatError(`segment ${i} (NAIF ${target}) claims ${keyframes} keyframes at byte ${offset}`);
    }
    const list = segments.get(target) ?? [];
    list.push({
      target,
      centre: view.getInt32(at + 4, true),
      firstEtS: view.getFloat64(at + 12, true),
      stepS: view.getFloat64(at + 20, true),
      window,
      states: new Float32Array(buffer.slice(offset, offset + bytes)),
    });
    segments.set(target, list);
  }
  return { segments };
}

function keyframe(states: Float32Array, k: number, scale: number): { position: Vec3; velocity: Vec3 } {
  const i = k * FLOATS_PER_KEYFRAME;
  return {
    position: { x: states[i] ?? NaN, y: states[i + 1] ?? NaN, z: states[i + 2] ?? NaN },
    velocity: { x: (states[i + 3] ?? NaN) * scale, y: (states[i + 4] ?? NaN) * scale, z: (states[i + 5] ?? NaN) * scale },
  };
}

/** One segment's state at ET, or null outside it. Output: km and km/s, ICRF, relative to the segment's centre. */
export function segmentStateKm(segment: HorizonsSegment, etS: number): HermiteEndpoint | null {
  const count = segment.states.length / FLOATS_PER_KEYFRAME;
  const u = (etS - segment.firstEtS) / segment.stepS;
  if (!(u >= 0 && u <= count - 1)) return null;
  const k = Math.min(Math.floor(u), count - 2);
  const window = Math.min(segment.window, count);
  const lo = windowStart(k, window, count);
  const times: number[] = [];
  const positions: Vec3[] = [];
  const velocities: Vec3[] = [];
  for (let j = lo; j < lo + window; j++) {
    // Time in steps, velocity in km per step: keeps the divided differences well scaled.
    const { position, velocity } = keyframe(segment.states, j, segment.stepS);
    times.push(j);
    positions.push(position);
    velocities.push(velocity);
  }
  const state = hermiteWindow(times, positions, velocities, u);
  const v = state.velocity;
  return { position: state.position, velocity: { x: v.x / segment.stepS, y: v.y / segment.stepS, z: v.z / segment.stepS } };
}

/**
 * A target's state at ET from the first segment that covers it, with that
 * segment's centre; null where the export has no data (B.26: not drawn).
 * ponytail: a linear scan of the target's segments (up to ~2,700 for Cassini);
 * index by time when S6c evaluates trails per frame.
 */
export function horizonsStateAtEt(ephemeris: HorizonsEphemeris, target: number, etS: number): CentredState | null {
  for (const segment of ephemeris.segments.get(target) ?? []) {
    const state = segmentStateKm(segment, etS);
    if (state) return { ...state, centre: segment.centre };
  }
  return null;
}

/** As `horizonsStateAtEt`, at a UTC instant (TDB = UTC + 69.184 s, before 2017 up to about a minute off). */
export function horizonsStateKm(ephemeris: HorizonsEphemeris, target: number, utcMs: number): CentredState | null {
  return horizonsStateAtEt(ephemeris, target, etSecondsFromUtcMs(utcMs));
}
