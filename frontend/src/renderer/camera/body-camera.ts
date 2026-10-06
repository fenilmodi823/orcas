import { Vector3 } from 'three';
import { deriveAzElRadius, rigCameraPosition, syncTargetAngles, type CameraRig } from './camera-rig.js';
import { updateBodyRig } from './camera-rig-updates.js';
import { R_EARTH_A_KM } from './collision.js';
import { ECI_UP } from './look-rotation.js';
import { CancelledError } from './errors.js';
import { arrivalDistanceKm, BodyFlight, type BodyFlightSpec } from './body-flight.js';
import { makeDeferred, type Deferred } from './flight.js';
import type { FlightSample } from './flight-path.js';

/** Something with a centre, a size and a pole the camera can fly to (S5a): the Sun, a planet, the Moon, the Earth. */
export interface BodyTarget {
  /** The state machine's key: a body's id. */
  readonly key: string;
  readonly equatorialRadiusKm: number;
  /** Centre at a UTC instant, km, scene frame; null when unknown (the planets before their bake loads). */
  positionKm(epochMs: number, out: Vector3): Vector3 | null;
  /** North pole, unit, scene frame. */
  poleJ2000(epochMs: number, out: Vector3): Vector3;
  /** The Sun's centre, for the lit side; null for the Sun itself. */
  sunKm(epochMs: number, out: Vector3): Vector3 | null;
}

export interface BodyFlyOpts {
  /** Arrive here instead, km from the body, with this up: NASA's `#/home` and the way back to the Earth. */
  readonly arrivalOffsetKm?: Vector3;
  readonly refUp?: Vector3;
  /** Swing to the lit side after arriving. Default true. */
  readonly swing?: boolean;
  /** NASA's slow orbit after arriving (`cinematic: true`). Default true. */
  readonly spin?: boolean;
}

/** The camera stays this far out from a body's centre, × its equatorial radius. */
const MIN_RADIUS_SCALE = 1.05;
/** Beyond this, a flight to a satellite or home first crosses the gap NASA's way: the Moon is inside. */
const FAR_FROM_EARTH_KM = 2e6;

/** The Earth as the far legs' destination: the scene's origin, pole up, no swing. */
export const EARTH_TARGET: BodyTarget = {
  key: 'earth',
  equatorialRadiusKm: R_EARTH_A_KM,
  positionKm: (_epochMs, out) => out.set(0, 0, 0),
  poleJ2000: (_epochMs, out) => out.copy(ECI_UP),
  sunKm: () => null,
};

export interface BodyFlightStart {
  readonly rig: CameraRig;
  readonly targetRig: CameraRig;
  readonly refUp: Vector3;
  readonly epochMs: number;
  /** Reduced motion (P4.D21): land at once and cross-fade, never a bare teleport. */
  readonly reducedMotion: boolean;
  readonly onCrossFade?: () => void;
}

const _body = new Vector3();
const _sun = new Vector3();
const _pos = new Vector3();
const sample = (): FlightSample => ({ positionKm: new Vector3(), pivotKm: new Vector3(), refUp: new Vector3() });

/**
 * The camera's body mode (S5a): the flight to a body (body-flight.ts), then following it with its pole up and,
 * as NASA does, orbiting it slowly until the user takes over. Kept out of camera-system.ts so that file stays
 * about satellites and under the line limit.
 */
export class BodyCamera {
  target: BodyTarget | null = null;
  private flight: BodyFlight | null = null;
  private deferred: Deferred | null = null;
  private spinning = false;
  /** An "up" the caller fixed (home keeps the ecliptic's north), instead of the body's pole. */
  private fixedUp: Vector3 | null = null;
  private readonly lastBodyKm = new Vector3();
  private readonly out = sample();

  get flying(): boolean {
    return this.flight !== null;
  }

  get minRadiusKm(): number {
    return (this.target?.equatorialRadiusKm ?? 0) * MIN_RADIUS_SCALE;
  }

  /** In body mode away from the Earth, or far from it: a satellite flight from here would be a cut. */
  isFar(rig: CameraRig): boolean {
    const awayOnABody = this.target !== null && this.target.key !== EARTH_TARGET.key;
    return awayOnABody || rigCameraPosition(rig, _pos).length() > FAR_FROM_EARTH_KM;
  }

  /**
   * Start a flight from the rig's current pose. Resolves on arrival, rejects with `CancelledError` when
   * superseded. Null when the body has no position yet: nothing moves.
   */
  begin(target: BodyTarget, start: BodyFlightStart, opts: BodyFlyOpts = {}): Promise<void> | null {
    const { rig, refUp, epochMs } = start;
    const bodyKm = target.positionKm(epochMs, _body);
    if (!bodyKm) return null;
    const distKm = arrivalDistanceKm(target.equatorialRadiusKm, rig.fovDeg);
    rigCameraPosition(rig, _pos);
    const arrival = opts.arrivalOffsetKm?.clone() ?? _pos.clone().sub(bodyKm);
    if (!opts.arrivalOffsetKm) {
      if (arrival.lengthSq() < 1e-12) arrival.set(0, -1, 0);
      arrival.setLength(distKm);
    }
    const sunKm = opts.swing === false || opts.arrivalOffsetKm ? null : target.sunKm(epochMs, _sun);
    const spec: BodyFlightSpec = {
      startPositionKm: _pos.clone(),
      startPivotKm: rig.pivotKm.clone(),
      startRefUp: refUp.clone(),
      arrivalOffsetKm: arrival,
      swingOffsetKm: sunKm ? sunKm.clone().sub(bodyKm).setLength(arrival.length()) : null,
      endRefUp: opts.refUp?.clone() ?? target.poleJ2000(epochMs, new Vector3()),
    };
    this.cancel();
    this.target = target;
    this.lastBodyKm.copy(bodyKm);
    this.spinning = opts.spin ?? true;
    this.fixedUp = opts.refUp?.clone() ?? null;
    this.flight = new BodyFlight(spec);
    this.deferred = makeDeferred();
    if (start.reducedMotion) {
      // Land on the last pose now; the next tick reports the arrival.
      while (!this.flight.tick(1, bodyKm, this.out));
      this.apply(rig, start.targetRig, refUp);
      start.onCrossFade?.();
    }
    return this.deferred.promise;
  }

  /** Advance the flight and pose the rig. True on the frame it arrives. */
  tick(dtSec: number, epochMs: number, rig: CameraRig, targetRig: CameraRig, refUp: Vector3): boolean {
    const flight = this.flight;
    if (!flight || !this.target) return false;
    const bodyKm = this.target.positionKm(epochMs, _body) ?? this.lastBodyKm;
    this.lastBodyKm.copy(bodyKm);
    const done = flight.tick(dtSec, bodyKm, this.out);
    this.apply(rig, targetRig, refUp);
    return done;
  }

  /** The flight has landed: settle its promise and hand over to following. */
  finish(): void {
    this.flight = null;
    this.deferred?.resolve();
    this.deferred = null;
  }

  /** Follow the body, pole up, orbiting slowly until the user takes over. */
  follow(rig: CameraRig, targetRig: CameraRig, refUp: Vector3, epochMs: number, dtSec: number, reducedMotion: boolean): void {
    if (!this.target) return;
    const bodyKm = this.target.positionKm(epochMs, _body);
    if (this.fixedUp) refUp.copy(this.fixedUp);
    else this.target.poleJ2000(epochMs, refUp);
    updateBodyRig(rig, targetRig, refUp, bodyKm, this.minRadiusKm, this.spinning && !reducedMotion ? dtSec : 0, dtSec);
  }

  /** Any manual input ends NASA's slow orbit, as a tap does there. */
  stopSpin(): void {
    this.spinning = false;
  }

  /** Abandon a flight in the air (a new one, or a grab), and leave body mode. */
  cancel(): void {
    this.flight = null;
    this.deferred?.reject(new CancelledError());
    this.deferred = null;
    this.target = null;
  }

  private apply(rig: CameraRig, targetRig: CameraRig, refUp: Vector3): void {
    rig.pivotKm.copy(this.out.pivotKm);
    deriveAzElRadius(rig, this.out.positionKm);
    targetRig.pivotKm.copy(this.out.pivotKm);
    syncTargetAngles(targetRig, rig);
    refUp.copy(this.out.refUp);
  }
}
