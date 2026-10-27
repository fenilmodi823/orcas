import { create } from 'zustand';
import type { NoradId } from '../data/catalog-types.js';

/** UI filter-chip/display taxonomy (Design.md's FilterChip vocabulary) —
 * distinct from the physical `OrbitClass` enum in catalog-types.ts: this
 * one folds in `'debris'` (an ObjType, not an orbit shape) with precedence
 * over the underlying orbit class — see `classifyOrbitClass` in
 * points-filters.ts. */
export type FilterClass = 'leo' | 'meo' | 'geo' | 'heo' | 'debris';

export interface SelectableObject {
  id: string;
  name: string;
  noradId: string;
  orbitClass: FilterClass;
  altitudeKm: number;
  velocityKmS: number;
  inclinationDeg: number;
}

/** Watch (conjunction alert): the object the camera follows and the one passing it. */
export interface WatchPair {
  readonly follow: NoradId;
  readonly counterpart: NoradId;
}

interface SelectionState {
  selectedNorad: NoradId | null;
  hoveredNorad: NoradId | null;
  /** A body's id (`renderer/solar/bodies.ts`, S5a): the Sun, a planet or the Moon. Never set with `selectedNorad`. */
  selectedBody: string | null;
  hoveredBody: string | null;
  setSelected: (norad: NoradId | null) => void;
  setHover: (norad: NoradId | null) => void;
  setSelectedBody: (id: string | null) => void;
  setHoverBody: (id: string | null) => void;
  watchPair: WatchPair | null;
  setWatchPair: (pair: WatchPair | null) => void;
  /** Escape, a panel's close, the reset: nothing selected. */
  clearSelection: () => void;
}

/**
 * Identity only — brief §D.7: "no handles, no indices, no positions, no
 * three.js objects. It survives a page reload and serialises into a URL."
 * Resolving a NORAD id into the display shape (SelectableObject) is a
 * separate concern — see points-selection-resolve.ts. One thing is selected
 * at a time: choosing a satellite clears a body, and the reverse.
 */
export const useSelectionStore = create<SelectionState>((set) => ({
  selectedNorad: null,
  hoveredNorad: null,
  selectedBody: null,
  hoveredBody: null,
  watchPair: null,
  // Watch's pair lives only while its followed object stays selected (spec §4).
  setSelected: (selectedNorad) =>
    set((s) => ({
      selectedNorad,
      ...(selectedNorad === null ? {} : { selectedBody: null }),
      ...(selectedNorad === s.watchPair?.follow ? {} : { watchPair: null }),
    })),
  setHover: (hoveredNorad) => set({ hoveredNorad }),
  setSelectedBody: (selectedBody) => set(selectedBody === null ? { selectedBody } : { selectedBody, selectedNorad: null, watchPair: null }),
  setHoverBody: (hoveredBody) => set({ hoveredBody }),
  setWatchPair: (watchPair) => set({ watchPair }),
  clearSelection: () => set({ selectedNorad: null, selectedBody: null, watchPair: null }),
}));

/** The label kept on during Watch: the counterpart, only while the followed object is still selected. */
export function pinnedLabelNorad(state: { selectedNorad: NoradId | null; watchPair: WatchPair | null }): NoradId | null {
  const pair = state.watchPair;
  return pair !== null && state.selectedNorad === pair.follow ? pair.counterpart : null;
}
