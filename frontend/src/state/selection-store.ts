import { create } from 'zustand';

export type OrbitClass = 'leo' | 'meo' | 'geo' | 'heo' | 'debris';

export interface SelectableObject {
  id: string;
  name: string;
  noradId: string;
  orbitClass: OrbitClass;
  altitudeKm: number;
  velocityKmS: number;
  inclinationDeg: number;
}

interface SelectionState {
  selected: SelectableObject | null;
  hovered: SelectableObject | null;
  select: (target: SelectableObject | null) => void;
  hover: (target: SelectableObject | null) => void;
}

/** Selected/hovered object — Architecture.md §5. */
export const useSelectionStore = create<SelectionState>((set) => ({
  selected: null,
  hovered: null,
  select: (selected) => set({ selected }),
  hover: (hovered) => set({ hovered }),
}));
