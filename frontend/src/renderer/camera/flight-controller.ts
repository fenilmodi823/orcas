import { Vector3 } from 'three';
import { smoothDamp } from './easing.js';
import {
  angleBetweenDirs,
  APPROACH_BLEND,
  flightDurationSec,
  type FlightEndpoint,
  type FlightSample,
} from './flight-path.js';
import { requiredExtraSwellGain } from './collision.js';
import { solveArrivalTimeMs } from './predictive-arrival.js';
import { Flight } from './flight.js';

const PIVOT_TRACK_SMOOTHTIME_SEC = 0.18;

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
  private readonly pivotVel = { x: { value: 0 }, y: { value: 0 }, z: { value: 0 } };
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
    this.pivotVel.x.value = this.pivotVel.y.value = this.pivotVel.z.value = 0;

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
   * an arbitrary future epoch (linear extrapolation from FrameState). Pass
   * a camera position for the arrival-time fixed point. Returns null if no
   * flight is active.
   */
  tick(
    dt: number,
    camPosKm: Vector3,
    frameEpochMs: number,
    targetPositionAt: (epochMs: number, out: Vector3) => Vector3,
  ): FlightTick | null {
    const flight = this._flight;
    if (!flight) return null;
    this.elapsed += dt;

    if (this.targetIndex >= 0) {
      const durFn = (distKm: number) => flightDurationSec(distKm, this.to.radiusKm, this.thetaRad);
      const tArriveMs = solveArrivalTimeMs(camPosKm, targetPositionAt, frameEpochMs, durFn);
      targetPositionAt(tArriveMs, this._retargetPos);
      this.pivotEstimate.x = smoothDamp(this.pivotEstimate.x, this._retargetPos.x, this.pivotVel.x, PIVOT_TRACK_SMOOTHTIME_SEC, dt);
      this.pivotEstimate.y = smoothDamp(this.pivotEstimate.y, this._retargetPos.y, this.pivotVel.y, PIVOT_TRACK_SMOOTHTIME_SEC, dt);
      this.pivotEstimate.z = smoothDamp(this.pivotEstimate.z, this._retargetPos.z, this.pivotVel.z, PIVOT_TRACK_SMOOTHTIME_SEC, dt);
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
