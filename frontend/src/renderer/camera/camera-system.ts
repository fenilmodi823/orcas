import { PerspectiveCamera, Vector2, Vector3 } from 'three';
import type { FrameState } from '../../simulation/frame-state.js';
import { clamp, damp } from './easing.js';
import { clampElevation, createRig, deriveAzElRadius, rigCameraPosition, type CameraRig } from './camera-rig.js';
import { ECI_UP, lookRotation, refUpForFreeOrbit } from './look-rotation.js';
import { clampFreeOrbitRadiusKm, R_EARTH_A_KM, softRepulsionScale } from './collision.js';
import { computeNearFarKm } from './near-far.js';
import { CancelledError } from './errors.js';
import { INITIAL_CAMERA_STATE, reduceCameraState, type CameraEvent, type CameraState } from './camera-state-machine.js';

const DT_CLAMP_SEC = 0.1;
const HALF_LIFE_AZIMUTH_MS = 90;
const HALF_LIFE_RADIUS_MS = 130;
const HALF_LIFE_ROLL_MS = 250;
const FREE_ORBIT_MIN_RADIUS_KM = R_EARTH_A_KM + 120;

export { CancelledError };

export interface CameraSystemOpts {
  reducedMotion?: boolean;
  onCrossFade?: () => void;
}

export interface ManualInput {
  readonly dAzimuthRad: number;
  readonly dElevationRad: number;
  readonly dLnRadius: number;
}

export interface CameraSystem {
  readonly state: Readonly<CameraState>;
  update(dtSec: number, frame: FrameState): void;
  applyManualInput(input: ManualInput): void;
  projectToScreen(posKm: Vector3, out: Vector2): boolean;
  /** Near/far the controller should apply to the camera this frame (km). */
  readonly nearFarKm: Readonly<{ nearKm: number; farKm: number }>;
  dispose(): void;
  // Commands are added in Tasks 11–12:
  // flyTo(targetIndex, opts?): Promise<void>;
  // flyToEarth(opts?): Promise<void>;
  // exitToFree(): Promise<void>;
}

const _pos = new Vector3();
const _fwd = new Vector3();
const _view = new Vector3();

class CameraSystemImpl implements CameraSystem {
  private _state: CameraState = INITIAL_CAMERA_STATE;
  private readonly rig: CameraRig = createRig();
  private readonly targetRig: CameraRig = createRig(); // manual input writes here; rig damps toward it
  private readonly prevUp = new Vector3().copy(ECI_UP);
  private readonly refUp = new Vector3().copy(ECI_UP);
  private _nearFar = { nearKm: 1, farKm: 1e6 };
  protected lastDt = 1 / 60;
  /** Structurally typed so this task needs no import from flight.ts; Task 11
   * widens it to `Flight | null` in place. */
  protected flight: { cancel(): void; done: boolean; resolveOnArrival(): void } | null = null;
  /** Assigned at the top of every update() so Task 11's command methods can
   * read target positions. */
  protected frameRef!: FrameState;

  constructor(
    protected readonly camera: PerspectiveCamera,
    protected readonly opts: CameraSystemOpts = {},
  ) {
    this.camera.fov = this.rig.fovDeg;
  }

  get state(): Readonly<CameraState> {
    return this._state;
  }

  get nearFarKm(): Readonly<{ nearKm: number; farKm: number }> {
    return this._nearFar;
  }

  /** Feed an event through the reducer. Tasks 11–12 wrap flight start/cancel
   * around this in the command methods. */
  protected dispatch(event: CameraEvent): void {
    this._state = reduceCameraState(this._state, event);
  }

  protected setState(next: CameraState): void {
    this._state = next;
  }

  applyManualInput(input: ManualInput): void {
    // Any manual input during a flight is a grab (brief §C.11): seed the
    // target rig from the CURRENT interpolated pose so input continues from
    // where the flight was, then drop to freeOrbit.
    if (this._state.kind === 'focusFlight' || this._state.kind === 'exit') {
      this.flight?.cancel();
      this.flight = null;
      this.targetRig.pivotKm.set(0, 0, 0);
      deriveAzElRadius(this.targetRig, this.camera.position);
      this.dispatch({ type: 'grabInput' });
    }
    this.targetRig.azimuthRad += input.dAzimuthRad;
    this.targetRig.elevationRad = clampElevation(this.targetRig.elevationRad + input.dElevationRad);

    if (input.dLnRadius !== 0) {
      let nextRadius = this.targetRig.radiusKm * Math.exp(input.dLnRadius);
      if (input.dLnRadius < 0) {
        // zooming IN: soft repulsion near the floor (brief §C.8)
        const scale = softRepulsionScale(this.targetRig.radiusKm, FREE_ORBIT_MIN_RADIUS_KM);
        const delta = nextRadius - this.targetRig.radiusKm;
        nextRadius = this.targetRig.radiusKm + delta * scale;
      }
      this.targetRig.radiusKm = clampFreeOrbitRadiusKm(nextRadius);
    }
  }

  update(dtSec: number, frame: FrameState): void {
    const dt = clamp(dtSec, 0, DT_CLAMP_SEC); // a tab-switch delivers a 3 s dt (brief §C.12)
    this.lastDt = dt;
    this.frameRef = frame;
    switch (this._state.kind) {
      case 'freeOrbit':
        this.updateFreeOrbit(dt);
        break;
      default:
        // Tasks 11–12 replace this with `case 'focusFlight'/'exit'/'object'`.
        throw new Error(`unhandled camera state: ${this._state.kind}`);
    }
    this.writeCameraFromRig();
    this.recomputeNearFar();
  }

  protected updateFreeOrbit(dt: number): void {
    this.targetRig.pivotKm.set(0, 0, 0); // Earth centre
    this.rig.pivotKm.copy(this.targetRig.pivotKm);
    this.rig.frame.copy(this.targetRig.frame);
    this.rig.azimuthRad = damp(this.rig.azimuthRad, this.targetRig.azimuthRad, HALF_LIFE_AZIMUTH_MS / 1000, dt);
    this.rig.elevationRad = damp(this.rig.elevationRad, this.targetRig.elevationRad, HALF_LIFE_AZIMUTH_MS / 1000, dt);
    // damp ln(radius), never the raw radius (brief §C.12)
    const lnR = damp(Math.log(this.rig.radiusKm), Math.log(this.targetRig.radiusKm), HALF_LIFE_RADIUS_MS / 1000, dt);
    this.rig.radiusKm = clampFreeOrbitRadiusKm(Math.exp(lnR));
    this.rig.rollRad = damp(this.rig.rollRad, 0, HALF_LIFE_ROLL_MS / 1000, dt);
    refUpForFreeOrbit(this.refUp);
  }

  protected writeCameraFromRig(): void {
    rigCameraPosition(this.rig, _pos);
    this.camera.position.copy(_pos);
    _fwd.copy(this.rig.pivotKm).sub(_pos);
    lookRotation(_fwd, this.refUp, this.prevUp, this.camera.quaternion);
    if (this.camera.fov !== this.rig.fovDeg) {
      this.camera.fov = this.rig.fovDeg;
      this.camera.updateProjectionMatrix();
    }
    // keep matrixWorld / matrixWorldInverse current so projectToScreen works
    // right after update() with no separate updateMatrixWorld() call.
    this.camera.updateMatrixWorld(true);
  }

  protected recomputeNearFar(): void {
    const camDist = this.camera.position.length();
    const nearestSurface =
      this._state.kind === 'object' ? Math.max(0.001, this.rig.radiusKm) : Math.max(0.001, camDist - R_EARTH_A_KM);
    this._nearFar = computeNearFarKm(nearestSurface, camDist);
  }

  projectToScreen(posKm: Vector3, out: Vector2): boolean {
    // View space: three cameras look down −Z, so a point is in front when
    // its view-space z is negative.
    _view.copy(posKm).applyMatrix4(this.camera.matrixWorldInverse);
    _pos.copy(posKm).project(this.camera);
    out.set(_pos.x, _pos.y);
    return _view.z < 0;
  }

  dispose(): void {
    this.flight?.cancel();
    this.flight = null;
  }
}

export function createCameraSystem(camera: PerspectiveCamera, opts?: CameraSystemOpts): CameraSystem {
  return new CameraSystemImpl(camera, opts ?? {});
}

export { CameraSystemImpl };
export type { CameraState, CameraEvent };
