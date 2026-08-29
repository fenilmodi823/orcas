import { Vector3 } from 'three';
import { clamp, flightEase } from './easing.js';
import { sampleFlightPath, type FlightEndpoint, type FlightSample } from './flight-path.js';
import { CancelledError } from './errors.js';

export interface FlyOpts {
  duration?: number; // seconds — overrides the computed duration
  framingScale?: number; // k in §C.6; larger = further back
  swell?: number; // arc lift; 0 = flat great-circle
}

export interface Deferred {
  readonly promise: Promise<void>;
  resolve(): void;
  reject(err: Error): void;
}

export function makeDeferred(): Deferred {
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // Prevent an unhandled-rejection warning if the caller never awaits a
  // cancelled flight — the reject is still observable via .promise.
  promise.catch(() => undefined);
  return { promise, resolve, reject };
}

/**
 * One camera flight (brief §C.6). Interpolates direction (slerp), radius
 * (geometric + swell) and pivot (toward a per-frame-refreshed estimate).
 * A cancelled flight hands its current pose to the superseding flight as
 * `from` — it never snaps, so rapid clicking produces one continuous curve.
 */
export class Flight {
  private readonly deferred = makeDeferred();
  private elapsed = 0;
  private settled = false;

  constructor(
    private readonly from: FlightEndpoint,
    private readonly to: FlightEndpoint,
    private readonly durationSec: number,
    private readonly extraSwellGain: number,
  ) {}

  get promise(): Promise<void> {
    return this.deferred.promise;
  }

  get done(): boolean {
    return this.elapsed >= this.durationSec;
  }

  get elapsedFraction(): number {
    return clamp(this.elapsed / this.durationSec, 0, 1);
  }

  sample(elapsedSec: number, toPivotEstimateKm: Vector3, out: FlightSample): FlightSample {
    this.elapsed = Math.max(0, elapsedSec);
    const u = flightEase(this.elapsedFraction);
    return sampleFlightPath(this.from, this.to, u, toPivotEstimateKm, this.extraSwellGain, out);
  }

  /** Call once, from CameraSystem, when `done` first becomes true. */
  resolveOnArrival(): void {
    if (this.settled) return;
    this.settled = true;
    this.deferred.resolve();
  }

  cancel(): void {
    if (this.settled) return;
    this.settled = true;
    this.deferred.reject(new CancelledError());
  }
}
