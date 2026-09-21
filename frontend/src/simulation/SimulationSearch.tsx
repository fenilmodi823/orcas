import { useMemo } from 'react';
import { SearchPanel, type SearchableObject } from '../ui/SearchPanel.js';
import { GlassSurface } from '../ui/GlassSurface.js';
import { useViewStore } from '../state/view-store.js';
import { useSelectionStore } from '../state/selection-store.js';
import type { ObjectMeta } from '../data/catalog-types.js';
import './SimulationSearch.css';

/**
 * Search, summoned by `/` (Design.md §7) and gone again once used.
 *
 * Choosing a result only sets the selection. The camera controller already
 * subscribes to selection and flies to whatever becomes selected, and the dock
 * switches to object mode on the same signal — so search needs no camera code
 * of its own, and a search-driven selection is indistinguishable from a click.
 */
export function SimulationSearch({ objects }: { objects: readonly ObjectMeta[] }) {
  const searchOpen = useViewStore((s) => s.searchOpen);
  const closeSearch = useViewStore((s) => s.closeSearch);
  const setSelected = useSelectionStore((s) => s.setSelected);

  const items = useMemo<SearchableObject[]>(
    () => objects.map((o) => ({ id: o.norad, name: o.name, noradId: o.norad })),
    [objects],
  );

  if (!searchOpen) return null;

  return (
    <div className="simulation-search">
      <GlassSurface variant="floating" elevation={3}>
        <SearchPanel
          items={items}
          autoFocus
          onClose={closeSearch}
          onSelect={(norad) => {
            setSelected(norad as ObjectMeta['norad']);
            closeSearch();
          }}
        />
      </GlassSurface>
    </div>
  );
}
