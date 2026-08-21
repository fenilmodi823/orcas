import { useState } from 'react';
import { DEFAULT_GLASS_OVERRIDE, type GlassOverride } from './glass-override.js';
import './ControlStrip.css';

interface ControlStripProps {
  value: GlassOverride;
  onChange: (value: GlassOverride) => void;
}

/**
 * Live glass controls for the P3.5 contrast audit: vary --glass-fill,
 * --glass-blur and --glass-saturate by eye against the real backdrop.
 */
export function ControlStrip({ value, onChange }: ControlStripProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="control-strip">
      <button type="button" className="control-strip__toggle" onClick={() => setExpanded((v) => !v)}>
        Glass controls {expanded ? '⌄' : '⌃'}
      </button>
      {expanded && (
        <div className="control-strip__body">
          <label>
            Fill {value.fillAlpha}%
            <input
              type="range"
              min={10}
              max={90}
              value={value.fillAlpha}
              onChange={(event) => onChange({ ...value, fillAlpha: Number(event.target.value) })}
            />
          </label>
          <label>
            Blur {value.blurPx}px
            <input
              type="range"
              min={0}
              max={60}
              value={value.blurPx}
              onChange={(event) => onChange({ ...value, blurPx: Number(event.target.value) })}
            />
          </label>
          <label>
            Saturate {value.saturatePercent}%
            <input
              type="range"
              min={100}
              max={260}
              value={value.saturatePercent}
              onChange={(event) => onChange({ ...value, saturatePercent: Number(event.target.value) })}
            />
          </label>
          <button type="button" className="control-strip__reset" onClick={() => onChange(DEFAULT_GLASS_OVERRIDE)}>
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
