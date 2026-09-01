import { Vector3 } from 'three';
import {
  angleBetweenDirs,
  APPROACH_BLEND,
  flightDurationSec,
  type FlightEndpoint,
  type FlightSample,
} from './flight-path.js';
import { requiredExtraSwellGain } from './collision.js';
import { Flight } from './flight.js';

export interface FlightBegin {
  readonly from: FlightEndpoint;
  readonly to: FlightEndpoint;
  /** Distance of the two camera endpoints from Earth's centre — for the
   * low-to-low arc lift (§C.8). */
  readonly camDist0Km: number;
  readonly camDist1Km: number;
  /** −1 for a flight to Earth (no predictive retarget). */
  readonly targetIndex: number;
  readonly durationSec?: number;
  readonly extraSwellGain?: number;
}

export interface FlightTick {
  readonly sample: FlightSample;
  readonly done: boolean;
}

/**
 * Owns one in-flight camera transition: builds the `Flight`, advances it
 * each frame, and runs the predictive retarget (brief §C.10) so the pivot
 * leads a moving target. Kept separate from `CameraSystem` so each file
 * stays focused and under the line limit.
 */
export class FlightController {
  /** Where the radius curve sits between geometric and reciprocal
   * (flight-path.ts's `blendRadiusKm`). Public and mutable so the dev
   * panel can retune a flight that is already in the air. */
  approachBlend = APPROACH_BLEND;
  private _flight: Flight | null = null;
  private elapsed = 0;
  private thetaRad = 0;
  private targetIndex = -1;
  private readonly to: FlightEndpoint = emptyEndpoint();
  private readonly from: FlightEndpoint = emptyEndpoint();
  private readonly sample: FlightSample = {
    positionKm: new Vector3(),
    pivotKm: new Vector3(),
    refUp: new Vector3(),
  };
  private readonly pivotEstimate = new Vector3();
  private readonly _retargetPos = new Vector3();

  get flight(): Flight | null {
    return this._flight;
  }

  /** Start a flight. Cancels any previous one AFTER arming the new one, so
   * rapid clicks produce one continuous curve (brief §C.6). */
  begin(input: FlightBegin): Flight {
    const prev = this._flight;
    copyEndpoint(this.from, input.from);
    copyEndpoint(this.to, input.to);
    this.targetIndex = input.targetIndex;
    this.thetaRad = angleBetweenDirs(this.from.dir, this.to.dir);
    this.elapsed = 0;
    this.pivotEstimate.copy(this.to.pivotKm);

    const dur =
      input.durationSec ?? flightDurationSec(this.from.radiusKm, this.to.radiusKm, this.thetaRad);
    const extraSwell = Math.max(
      input.extraSwellGain ?? 0,
      requiredExtraSwellGain(input.camDist0Km, input.camDist1Km),
    );
    this._flight = new Flight(this.from, this.to, dur, extraSwell);
    prev?.cancel();
    return this._flight;
  }

  /**
   * Advance the flight by `dt`. `targetPositionAt` evaluates the target at
   * an arbitrary future epoch (linear extrapolation from FrameState).
   * Returns null if no flight is active.
   */
  tick(
    dt: number,
    frameEpochMs: number,
    targetPositionAt: (epochMs: number, out: Vector3) => Vector3,
  ): FlightTick | null {
    const flight = this._flight;
    if (!flight) return null;
    this.elapsed += dt;

    if (this.targetIndex >= 0) {
      // ⭐ Lead the target by the flight's OWN REMAINING TIME.
      //
      // This used to re-solve the arrival time from scratch every tick with
      // `solveArrivalTimeMs`, whose duration function is floored at
      // DUR_MIN = 1.2 s. That floor never expires, so the aim point stayed a
      // fixed ~1.2 s ahead of the object for the whole flight — and at
      // 7.66 km/s that is ~9 km. Measured on /points: the camera sat 7.85 km
      // from the satellite for 1.7 seconds (1.5 px, invisible), then snapped
      // to 82 m the instant the state machine reached `object` mode and the
      // pivot became the object's real position. That snap WAS the "appears
      // out of nowhere".
      //
      // Once a flight is in the air its arrival time is not a fixed point to
      // solve — it is known. `remainingSec` goes to zero, so the aim point
      // converges onto the object exactly at arrival and the camera closes
      // on it smoothly the whole way in.
      // Aim at where the object IS, and copy it directly.
      //
      // Both halves are measured, not assumed, and both were wrong before:
      //
      // 1. It used to aim where the object WILL BE, via `solveArrivalTimeMs`
      //    whose duration is floored at DUR_MIN = 1.2 s. That floor never
      //    expires, so the aim point stayed ~1.2 s x 7.66 km/s = ~9 km ahead
      //    for the whole flight. Measured: the camera sat 7.85 km from the
      //    satellite (1.5 px, invisible) for 1.7 s, then snapped to 82 m when
      //    object mode took over. That snap WAS "it appears out of nowhere".
      //    Leading by the flight's own remaining time fixed the snap but left
      //    the closing LINEAR in time, because the lead itself is v x t.
      //
      // 2. smoothDamp toward a target moving at constant velocity carries a
      //    steady-state offset of roughly smoothTime x speed. At 0.18 s and
      //    7.66 km/s that is 1.38 km — measured as a 1.35 km plateau holding
      //    for 1.5 s, then a 16x jump in one frame at handover.
      //
      // With a direct copy of the live position the camera sits exactly
      // `radius(u)` from the object for the whole focused part of the flight,
      // so apparent size follows blendRadiusKm — the curve that is actually
      // tuned for this — instead of being set by a tracking artefact. The
      // position comes from a deterministic propagator, not a noisy sensor,
      // so there is no jitter for the damping to earn its lag against. Object
      // mode already tracks by hard copy for exactly this reason.
      targetPositionAt(frameEpochMs, this._retargetPos);
      this.pivotEstimate.copy(this._retargetPos);
      this.to.refUp.copy(this.pivotEstimate).normalize();
    }

    flight.sample(this.elapsed, this.pivotEstimate, this.sample, this.approachBlend);
    return { sample: this.sample, done: flight.done };
  }

  finish(): void {
    this._flight?.resolveOnArrival();
    this._flight = null;
  }

  cancel(): void {
    this._flight?.cancel();
    this._flight = null;
  }
}

function emptyEndpoint(): FlightEndpoint {
  return { dir: new Vector3(0, 0, 1), radiusKm: 1, pivotKm: new Vector3(), refUp: new Vector3(0, 0, 1) };
}

function copyEndpoint(dst: FlightEndpoint, src: FlightEndpoint): void {
  dst.dir.copy(src.dir);
  dst.radiusKm = src.radiusKm;
  dst.pivotKm.copy(src.pivotKm);
  dst.refUp.copy(src.refUp);
}
