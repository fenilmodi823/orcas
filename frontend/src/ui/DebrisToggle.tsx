import { useViewStore } from '../state/view-store.js';
import './DebrisToggle.css';

/**
 * P4.D25: debris is a layer, default off — it affects only
 * `OBJECT_TYPE = DEB` objects, never payloads or rocket bodies. A
 * rendering filter like the density slider: the objects stay in the
 * catalogue, only `aFlags` changes. Native checkbox, so keyboard and
 * screen-reader behaviour come for free.
 */
export function DebrisToggle({ count }: { count: number }) {
  const showDebris = useViewStore((state) => state.showDebris);
  const toggleDebris = useViewStore((state) => state.toggleDebris);

  return (
    <label className="debris-toggle">
      <input type="checkbox" checked={showDebris} onChange={toggleDebris} />
      <span className="debris-toggle__label">Show debris</span>
      <span className="debris-toggle__count">{count.toLocaleString()}</span>
    </label>
  );
}
