import { PerspectiveCamera, Vector2, Vector3 } from 'three';
import type { FrameState } from '../../simulation/frame-state.js';
import { clamp } from './easing.js';
import { createRig, deriveAzElRadius, syncTargetAngles, type CameraRig } from './camera-rig.js';
import { ECI_UP, refUpForFreeOrbit } from './look-rotation.js';
import { applyNearFar, projectToScreen, writeCameraFromRig } from './camera-output.js';
import { CancelledError } from './errors.js';
import type { FlightEndpoint } from './flight-path.js';
import { FlightController } from './flight-controller.js';
import { applyImmediateArrival, buildFlightEndpoints, targetPositionAt } from './flight-setup.js';
import { accumulateManualInput, type ManualInput } from './manual-input.js';
import { makeDeferred, type Deferred, type FlyOpts } from './flight.js';
import { INITIAL_CAMERA_STATE, reduceCameraState, type CameraEvent, type CameraState } from './camera-state-machine.js';
import type { CameraSystem, CameraSystemOpts } from './camera-system-types.js';
import {
  FREE_ORBIT_MIN_RADIUS_KM,
  OBJECT_MIN_RADIUS_KM,
  updateFreeOrbitRig,
  updateObjectRig,
} from './camera-rig-updates.js';

const DT_CLAMP_SEC = 0.1;
const EXIT_DURATION_SEC = 1.2;

export { CancelledError };
export type { CameraSystem, CameraSystemOpts, FlyOpts, ManualInput };

const _tp = new Vector3();

// flight endpoint scratch — filled by buildFlightEndpoints, copied out by FlightController.begin
const ep = (): FlightEndpoint => ({ dir: new Vector3(0, 0, 1), radiusKm: 1, pivotKm: new Vector3(), refUp: new Vector3(0, 0, 1) });
const _from = ep();
const _to = ep();

class CameraSystemImpl implements CameraSystem {
  private _state: CameraState = INITIAL_CAMERA_STATE;
  private readonly rig: CameraRig = createRig();
  private readonly targetRig: CameraRig = createRig(); // manual input writes here; rig damps toward it
  private readonly prevUp = new Vector3().copy(ECI_UP);
  private readonly refUp = new Vector3().copy(ECI_UP);
  private _nearFar = { nearKm: 1, farKm: 1e6 };
  private _targetDistanceKm = 0;
  private frameRef!: FrameState;

  private readonly flights = new FlightController();
  private targetIndex = -1;
  private readonly preFocusDir = new Vector3(1, 0, 0);
  private preFocusRadiusKm = 42164;
  private pendingArrival: Deferred | null = null;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly opts: CameraSystemOpts = {},
  ) {
    this.camera.fov = this.rig.fovDeg;
  }

  get state(): Readonly<CameraState> {
    return this._state;
  }

  get radiusKm(): number {
    return this.rig.radiusKm;
  }

  get targetDistanceKm(): number {
    return this._targetDistanceKm;
  }

  get reducedMotion(): boolean {
    return this.opts.reducedMotion ?? false;
  }

  set reducedMotion(value: boolean) {
    this.opts.reducedMotion = value;
  }

  get approachBlend(): number {
    return this.flights.approachBlend;
  }

  set approachBlend(p: number) {
    this.flights.approachBlend = p;
  }

  get nearFarKm(): Readonly<{ nearKm: number; farKm: number }> {
    return this._nearFar;
  }

  private dispatch(event: CameraEvent): void {
    this._state = reduceCameraState(this._state, event);
  }

  applyManualInput(input: ManualInput): void {
    // A grab mid-flight (brief §C.11): re-express BOTH rigs as a freeOrbit
    // pose reproducing the camera's exact current world position, so the
    // pivot snap from the flight's interpolated look-at back to Earth centre
    // does not jolt the view. targetRig := rig means the first post-grab
    // frame damps nowhere.
    if (this._state.kind === 'focusFlight' || this._state.kind === 'exit') {
      this.flights.cancel();
      this.rig.pivotKm.set(0, 0, 0);
      this.rig.frame.identity();
      deriveAzElRadius(this.rig, this.camera.position);
      this.targetRig.pivotKm.set(0, 0, 0);
      this.targetRig.frame.identity();
      syncTargetAngles(this.targetRig, this.rig);
      // The drag basis is built from refUp, so it has to become freeOrbit's
      // before the very first post-grab event uses it — not one frame later.
      refUpForFreeOrbit(this.refUp);
      this.dispatch({ type: 'grabInput' });
    }
    const floor = this._state.kind === 'object' ? OBJECT_MIN_RADIUS_KM : FREE_ORBIT_MIN_RADIUS_KM;
    accumulateManualInput(this.targetRig, input, floor, this.refUp);
  }

  flyTo(targetIndex: number, opts?: FlyOpts): Promise<void> {
    this.targetIndex = targetIndex;
    if (this._state.kind === 'freeOrbit') {
      this.preFocusDir.copy(this.camera.position).sub(this.rig.pivotKm).normalize();
      this.preFocusRadiusKm = this.rig.radiusKm;
    }
    this.dispatch({ type: 'select', index: targetIndex });
    return this.beginFlight(opts, false);
  }

  flyToEarth(opts?: FlyOpts): Promise<void> {
    if (this._state.kind === 'object') this.dispatch({ type: 'deselect' });
    else this._state = { kind: 'exit' };
    this.targetIndex = -1;
    return this.beginFlight(opts, true, EXIT_DURATION_SEC);
  }

  exitToFree(): Promise<void> {
    return this.flyToEarth();
  }

  private beginFlight(opts: FlyOpts | undefined, toEarth: boolean, forcedDurationSec?: number): Promise<void> {
    const { camDist0Km, camDist1Km } = buildFlightEndpoints({
      rig: this.rig,
      refUp: this.refUp,
      toEarth,
      frame: this.frameRef,
      targetIndex: this.targetIndex,
      preFocusDir: this.preFocusDir,
      preFocusRadiusKm: this.preFocusRadiusKm,
      framingScale: opts?.framingScale,
      from: _from,
      to: _to,
    });

    if (this.opts.reducedMotion) return this.jumpTo();

    return this.flights.begin({
      from: _from,
      to: _to,
      camDist0Km,
      camDist1Km,
      targetIndex: toEarth ? -1 : this.targetIndex,
      durationSec: forcedDurationSec ?? opts?.duration,
      extraSwellGain: opts?.swell,
    }).promise;
  }

  private jumpTo(): Promise<void> {
    this.flights.cancel();
    applyImmediateArrival(this.rig, this.targetRig, this.refUp, _to, this.opts.onCrossFade);
    this.pendingArrival?.resolve(); // supersede an un-consumed jump
    this.pendingArrival = makeDeferred();
    return this.pendingArrival.promise;
  }

  update(dtSec: number, frame: FrameState): void {
    const dt = clamp(dtSec, 0, DT_CLAMP_SEC); // a tab-switch delivers a 3 s dt (brief §C.12)
    this.frameRef = frame;

    if (this.pendingArrival) {
      const d = this.pendingArrival;
      this.pendingArrival = null;
      this.dispatch({ type: 'flightArrived' });
      d.resolve();
    }

    switch (this._state.kind) {
      case 'freeOrbit':
        updateFreeOrbitRig(this.rig, this.targetRig, this.refUp, dt);
        break;
      case 'focusFlight':
      case 'exit':
        this.updateFlight(dt);
        break;
      case 'object': {
        const target =
          this.targetIndex >= 0 ? targetPositionAt(this.frameRef, this.targetIndex, this.frameRef.epochMs, _tp) : null;
        updateObjectRig(this.rig, this.targetRig, this.refUp, target, dt);
        break;
      }
    }
    writeCameraFromRig(this.camera, this.rig, this.refUp, this.prevUp);
    this._nearFar = applyNearFar(this.camera, this.rig.radiusKm);
    // Measured AFTER the pose is final, against the object's position NOW
    // rather than the pivot the flight is aiming at.
    if (this.targetIndex >= 0) {
      targetPositionAt(this.frameRef, this.targetIndex, this.frameRef.epochMs, _tp);
      this._targetDistanceKm = this.camera.position.distanceTo(_tp);
    } else {
      this._targetDistanceKm = 0;
    }
  }

  private updateFlight(dt: number): void {
    const tick = this.flights.tick(dt, this.frameRef.epochMs, (t, o) =>
      targetPositionAt(this.frameRef, this.targetIndex, t, o),
    );
    if (!tick) return;
    this.rig.pivotKm.copy(tick.sample.pivotKm);
    deriveAzElRadius(this.rig, tick.sample.positionKm);
    this.targetRig.pivotKm.copy(tick.sample.pivotKm);
    syncTargetAngles(this.targetRig, this.rig);
    this.refUp.copy(tick.sample.refUp);
    if (tick.done) {
      this.flights.finish();
      this.dispatch({ type: 'flightArrived' });
    }
  }

  projectToScreen(posKm: Vector3, out: Vector2): boolean {
    return projectToScreen(this.camera, posKm, out);
  }

  dispose(): void {
    this.flights.cancel();
  }
}

export function createCameraSystem(camera: PerspectiveCamera, opts?: CameraSystemOpts): CameraSystem {
  return new CameraSystemImpl(camera, opts ?? {});
}

export type { CameraState, CameraEvent };
