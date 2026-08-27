import { GlassSurface } from '../../ui/GlassSurface.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { CAMERA_TUNABLE_DEFAULTS, useCameraTunables, type CameraTunables } from './camera-tunables.js';
import './CameraDevPanel.css';

interface SliderSpec {
  readonly key: keyof CameraTunables;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

const SLIDERS: readonly SliderSpec[] = [
  { key: 'dragRadPerPx', label: 'drag rad/px', min: 0.001, max: 0.02, step: 0.001 },
  { key: 'wheelLnPerUnit', label: 'wheel ln/unit', min: 0.0002, max: 0.004, step: 0.0002 },
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
      {SLIDERS.map(({ key, label, min, max, step }) => (
        <label key={key} className="camera-dev-panel__row">
          <span>{label}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={tunables[key]}
            onChange={(e) => tunables.set(key, Number(e.target.value))}
          />
          <span className="camera-dev-panel__value">{tunables[key]}</span>
        </label>
      ))}
      <button
        type="button"
        className="camera-dev-panel__reset"
        onClick={() => {
          tunables.reset();
          useSelectionStore.getState().setSelected(null); // fly back to Earth
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
