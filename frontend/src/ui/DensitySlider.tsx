import type { ChangeEvent } from 'react';
import { useViewStore } from '../state/view-store.js';
import './DensitySlider.css';

/**
 * P4.D26: 0-100%, filtering the Tier 0 draw by `significance-rank.ts`'s
 * order (a rendering filter — every object still exists in the
 * catalogue, only the shader's `aFlags` discard changes). Native
 * `<input type="range">`, same shape as `TimeScrubber.tsx` — nothing
 * here needs more than what the browser already gives for free.
 */
export function DensitySlider() {
  const density = useViewStore((state) => state.density);
  const setDensity = useViewStore((state) => state.setDensity);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setDensity(Number(event.target.value));
  }

  return (
    <label className="density-slider">
      <span className="density-slider__label">Density</span>
      <input
        type="range"
        className="density-slider__track"
        min={0}
        max={100}
        value={density}
        onChange={handleChange}
        aria-label="Object density"
        aria-valuetext={`${density}%`}
      />
      <span className="density-slider__value">{density}%</span>
    </label>
  );
}
