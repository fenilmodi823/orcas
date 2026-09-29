import { useViewStore } from '../state/view-store.js';
import { viridis } from '../renderer/density/viridis.js';
import './DebrisToggle.css';
import './HeatmapToggle.css';

/** The ramp's own colours, sampled from the same function the shader uses. */
const RAMP = `linear-gradient(to right, ${Array.from({ length: 9 }, (_, i) => {
  const [r, g, b] = viridis(i / 8).map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255));
  return `rgb(${r} ${g} ${b})`;
}).join(', ')})`;

/**
 * The crowding heatmap (Phase 5). What it shows is stated in the label:
 * how many catalogued objects project onto each part of the screen,
 * relative — not objects per km³, and not the density slider, which sets
 * how many objects are drawn at all.
 */
export function HeatmapToggle() {
  const showHeatmap = useViewStore((state) => state.showHeatmap);
  const toggleHeatmap = useViewStore((state) => state.toggleHeatmap);

  return (
    <>
      <label className="debris-toggle">
        <input type="checkbox" checked={showHeatmap} onChange={toggleHeatmap} />
        <span className="debris-toggle__label">Crowding heatmap (projected, relative)</span>
      </label>
      {showHeatmap && (
        <div className="heatmap-key" aria-hidden>
          <span>fewer</span>
          <span className="heatmap-key__ramp" style={{ background: RAMP }} />
          <span>more objects on screen</span>
        </div>
      )}
    </>
  );
}
