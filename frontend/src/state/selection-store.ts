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

interface SelectionState {
  selectedNorad: NoradId | null;
  hoveredNorad: NoradId | null;
  setSelected: (norad: NoradId | null) => void;
  setHover: (norad: NoradId | null) => void;
}

/**
 * Identity only — brief §D.7: "no handles, no indices, no positions, no
 * three.js objects. It survives a page reload and serialises into a URL."
 * Resolving a NORAD id into the display shape (SelectableObject) is a
 * separate concern — see points-selection-resolve.ts.
 */
export const useSelectionStore = create<SelectionState>((set) => ({
  selectedNorad: null,
  hoveredNorad: null,
  setSelected: (selectedNorad) => set({ selectedNorad }),
  setHover: (hoveredNorad) => set({ hoveredNorad }),
}));
