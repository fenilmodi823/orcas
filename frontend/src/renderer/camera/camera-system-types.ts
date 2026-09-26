import type { Vector2, Vector3 } from 'three';
import type { FrameState } from '../../simulation/frame-state.js';
import type { FlyOpts } from './flight.js';
import type { ManualInput } from './manual-input.js';
import type { CameraState } from './camera-state-machine.js';

export interface CameraSystemOpts {
  reducedMotion?: boolean;
  onCrossFade?: () => void;
}

/** The camera's public contract — implemented by `camera-system.ts`. */
export interface CameraSystem {
  readonly state: Readonly<CameraState>;
  /** Live distance from the pivot, km. Read by the dev panel: tuning the
   * flight curve is impossible without seeing the number it shapes. */
  readonly radiusKm: number;
  /** Live distance from the camera to the TARGET OBJECT, km — which is
   * NOT `radiusKm` during a flight. The pivot leads the object by the
   * predictive retarget (§C.10), so the camera can be metres from the
   * rendezvous point while the object is still kilometres away. This is
   * the distance that decides whether anything is visible on screen. */
  readonly targetDistanceKm: number;
  /** Where the flight's radius curve sits between geometric and
   * reciprocal — flight-path.ts's `blendRadiusKm`. Settable mid-flight so
   * the dev panel can retune a move that is already playing. */
  approachBlend: number;
  /** Live, because the OS preference can be toggled mid-session and an
   * in-app override can be flipped at any time (brief §6.5 note 1). Settable
   * rather than a constructor option so a change does not tear down and
   * rebuild the camera, which would throw away where the user is looking. */
  reducedMotion: boolean;
  update(dtSec: number, frame: FrameState): void;
  applyManualInput(input: ManualInput): void;
  projectToScreen(posKm: Vector3, out: Vector2): boolean;
  readonly nearFarKm: Readonly<{ nearKm: number; farKm: number }>; // km — the controller applies it

  flyTo(targetIndex: number, opts?: FlyOpts): Promise<void>;
  flyToEarth(opts?: FlyOpts): Promise<void>;
  exitToFree(): Promise<void>;
  dispose(): void;
}
