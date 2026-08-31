import { create } from 'zustand';
import { LOD_BAND_PX } from '../lod/lod-band.js';

/**
 * The camera constants most likely to need a subjective tweak, exposed
 * through CameraDevPanel on /points (brief risk mitigation: "expose every
 * constant through a dev panel, as orcas-glass-lab.html did"). The
 * flight-shape constants (ease gamma, swell gain, framing k, durations)
 * live in source — edit + HMR to tune them; the plan's Global Constraints
 * hold the defaults and rationale.
 */
export interface CameraTunables {
  dragRadPerPx: number;
  wheelLnPerUnit: number;
  lodLoPx: number;
  lodHiPx: number;
}

export const CAMERA_TUNABLE_DEFAULTS: CameraTunables = {
  dragRadPerPx: 0.005,
  wheelLnPerUnit: 0.001,
  // Referenced, never restated: a second copy of 3 and 6 is exactly the
  // drift brief §F.7 warns about.
  lodLoPx: LOD_BAND_PX.loPx,
  lodHiPx: LOD_BAND_PX.hiPx,
};

interface Store extends CameraTunables {
  set<K extends keyof CameraTunables>(key: K, value: CameraTunables[K]): void;
  reset(): void;
}

export const useCameraTunables = create<Store>((set) => ({
  ...CAMERA_TUNABLE_DEFAULTS,
  set: (key, value) => set({ [key]: value } as Partial<CameraTunables>),
  reset: () => set({ ...CAMERA_TUNABLE_DEFAULTS }),
}));
