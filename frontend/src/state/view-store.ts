import { create } from 'zustand';
import type { OrbitClass } from './selection-store.js';

interface ViewState {
  activeFilters: ReadonlySet<OrbitClass>;
  searchOpen: boolean;
  /** P4.D26, 0-100: the density slider's cut, as a percentage of the
   * catalogue (by `significance-rank.ts`'s rank order). 100 = everything,
   * matching today's behaviour with no slider at all. Session state only —
   * never persisted, same as every other view toggle here. */
  density: number;
  /** P4.D29: the `/points` debug panel's collapsed state. Session state
   * only, deliberately not `localStorage` — see the M1.7b design doc. */
  panelCollapsed: boolean;
  toggleFilter: (orbitClass: OrbitClass) => void;
  openSearch: () => void;
  closeSearch: () => void;
  setDensity: (density: number) => void;
  togglePanel: () => void;
}

/** Layers, filters, camera mode — Architecture.md §5. Camera mode joins P4. */
export const useViewStore = create<ViewState>((set) => ({
  activeFilters: new Set(),
  searchOpen: false,
  density: 100,
  panelCollapsed: false,
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
  setDensity: (density) => set({ density }),
  togglePanel: () => set((state) => ({ panelCollapsed: !state.panelCollapsed })),
}));
