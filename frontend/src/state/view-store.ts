import { create } from 'zustand';
import type { OrbitClass } from './selection-store.js';

interface ViewState {
  activeFilters: ReadonlySet<OrbitClass>;
  searchOpen: boolean;
  toggleFilter: (orbitClass: OrbitClass) => void;
  openSearch: () => void;
  closeSearch: () => void;
}

/** Layers, filters, camera mode — Architecture.md §5. Camera mode joins P4. */
export const useViewStore = create<ViewState>((set) => ({
  activeFilters: new Set(),
  searchOpen: false,
  toggleFilter: (orbitClass) =>
    set((state) => {
      const next = new Set(state.activeFilters);
      if (next.has(orbitClass)) {
        next.delete(orbitClass);
      } else {
        next.add(orbitClass);
      }
      return { activeFilters: next };
    }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
}));
