import { create } from 'zustand';
import type { FilterClass } from './selection-store.js';

interface ViewState {
  activeFilters: ReadonlySet<FilterClass>;
  searchOpen: boolean;
  /** P4.D26, 0-100: the density slider's cut, as a percentage of the
   * catalogue (by `significance-rank.ts`'s rank order). 100 = everything,
   * matching today's behaviour with no slider at all. Session state only —
   * never persisted, same as every other view toggle here. */
  density: number;
  /** P4.D29: the `/points` debug panel's collapsed state. Session state
   * only, deliberately not `localStorage` — see the M1.7b design doc. */
  panelCollapsed: boolean;
  /** M1.7c: `OrbitClassLegend`'s dismissed state, same shape as
   * `panelCollapsed` — session only, not `localStorage`. */
  orbitClassLegendDismissed: boolean;
  /** P4.D25: debris visibility layer. Default off; only ever affects
   * `ObjType.Debris` objects, never payloads or rocket bodies. Session
   * state only, like every other view toggle here. */
  showDebris: boolean;
  toggleFilter: (filterClass: FilterClass) => void;
  openSearch: () => void;
  closeSearch: () => void;
  setDensity: (density: number) => void;
  toggleDebris: () => void;
  togglePanel: () => void;
  toggleOrbitClassLegend: () => void;
}

/** Layers, filters, camera mode — Architecture.md §5. Camera mode joins P4. */
export const useViewStore = create<ViewState>((set) => ({
  activeFilters: new Set(),
  searchOpen: false,
  density: 100,
  showDebris: false,
  panelCollapsed: false,
  orbitClassLegendDismissed: false,
  toggleFilter: (filterClass) =>
    set((state) => {
      const next = new Set(state.activeFilters);
      if (next.has(filterClass)) {
        next.delete(filterClass);
      } else {
        next.add(filterClass);
      }
      return { activeFilters: next };
    }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  setDensity: (density) => set({ density }),
  toggleDebris: () => set((state) => ({ showDebris: !state.showDebris })),
  togglePanel: () => set((state) => ({ panelCollapsed: !state.panelCollapsed })),
  toggleOrbitClassLegend: () => set((state) => ({ orbitClassLegendDismissed: !state.orbitClassLegendDismissed })),
}));
