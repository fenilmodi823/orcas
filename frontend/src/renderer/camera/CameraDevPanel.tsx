import { GlassSurface } from '../../ui/GlassSurface.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { CAMERA_TUNABLE_DEFAULTS, useCameraTunables, type CameraTunables } from './camera-tunables.js';
import { useCameraStatus } from './camera-status.js';
import './CameraDevPanel.css';

interface SliderSpec {
  readonly key: keyof CameraTunables;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** Log-scale the track. For a value spanning decades a linear slider puts
   *  the whole useful range in the first percent of its travel. */
  readonly log?: boolean;
}

const LOG_STEPS = 1000;

/** Slider position (0..LOG_STEPS) ⇄ value, for a log-scaled track. */
function logToValue({ min, max }: SliderSpec, position: number): number {
  return min * Math.pow(max / min, position / LOG_STEPS);
}
function valueToLog({ min, max }: SliderSpec, value: number): number {
  return (Math.log(value / min) / Math.log(max / min)) * LOG_STEPS;
}

const SLIDERS: readonly SliderSpec[] = [
  { key: 'dragRadPerPx', label: 'drag rad/px', min: 0.001, max: 0.02, step: 0.001 },
  { key: 'wheelLnPerUnit', label: 'wheel ln/unit', min: 0.0002, max: 0.004, step: 0.0002 },

  // Bottoms out at 1e-4 px, measured not guessed: at the default free-orbit
  // view (727 px tall, 35° fov, camera at 42,164 km) a 10 m object subtends
  // ~3e-4 px, so anything coarser can never promote a single object and the
  // slider cannot do the job it exists for. Log-scaled because the useful
  // range spans five decades.
  { key: 'lodLoPx', label: 'lod lo px', min: 0.0001, max: 10, step: 1, log: true },
  { key: 'lodHiPx', label: 'lod hi px', min: 0.0001, max: 10, step: 1, log: true },
];

/** Minimal live-tuning panel for the M1.6 subjective camera review (brief §I
 * DoD). Flight-shape constants (ease gamma, swell, framing k, durations)
 * stay in source — edit + HMR. */
export function CameraDevPanel() {
  const tunables = useCameraTunables();
  const selected = useSelectionStore((s) => s.selectedNorad);

  return (
    <GlassSurface variant="floating" elevation={2} className="camera-dev-panel">
      <h2>Camera</h2>
      <p className="camera-dev-panel__state">{selected === null ? 'free orbit' : `focused · ${selected}`}</p>
      {SLIDERS.map((spec) => (
        <label key={spec.key} className="camera-dev-panel__row">
          <span>{spec.label}</span>
          <input
            type="range"
            min={spec.log ? 0 : spec.min}
            max={spec.log ? LOG_STEPS : spec.max}
            step={spec.step}
            value={spec.log ? valueToLog(spec, tunables[spec.key]) : tunables[spec.key]}
            onChange={(e) =>
              tunables.set(
                spec.key,
                spec.log ? logToValue(spec, Number(e.target.value)) : Number(e.target.value),
              )
            }
          />
          <span className="camera-dev-panel__value">
            {spec.log ? tunables[spec.key].toPrecision(3) : tunables[spec.key]}
          </span>
        </label>
      ))}
      <button
        type="button"
        className="camera-dev-panel__reset"
        onClick={() => {
          tunables.reset();
          // An explicit command, not a side effect of clearing the
          // selection — see the reset subscription in use-camera-controller.
          useCameraStatus.getState().requestReset();
        }}
      >
        Reset view &amp; tunables
      </button>
      <p className="camera-dev-panel__hint">
        defaults: drag {CAMERA_TUNABLE_DEFAULTS.dragRadPerPx}, wheel {CAMERA_TUNABLE_DEFAULTS.wheelLnPerUnit}
      </p>
    </GlassSurface>
  );
}
