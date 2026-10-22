import { parseHorizonsEphemeris } from './horizons-ephemeris.js';
import { createHorizonsIndex, type HorizonsIndex } from './horizons-index.js';

/** The planets whose major moons the S6a export carries (B.17), by body id; each is one file. */
export const MOON_SYSTEMS = ['mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const;
export type MoonSystemId = (typeof MOON_SYSTEMS)[number];
export type MoonSystemStatus = 'idle' | 'loading' | 'ready' | 'failed';
type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

export const moonSystemUrl = (id: MoonSystemId): string => `/ephemeris/horizons/moons-${id}.bin`;

const loaded = new Map<MoonSystemId, HorizonsIndex>();
const status = new Map<MoonSystemId, MoonSystemStatus>();
const listeners = new Set<() => void>();
let version = 0;

function notifyListeners(): void {
  version += 1;
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.warn('Listener threw during moon system notification:', error);
    }
  }
}

/** A system's index once its file has loaded; null before, and for good if it failed. */
export function moonSystem(id: MoonSystemId): HorizonsIndex | null {
  return loaded.get(id) ?? null;
}

export function moonSystemStatus(id: MoonSystemId): MoonSystemStatus {
  return status.get(id) ?? 'idle';
}

/**
 * Fetch a system's moons once per page (S6b), as the planet maps load (S5b): the scene asks when the system
 * fades in or one of its bodies is hovered or selected. A failure is final for the page: the moons are not
 * drawn, the panel says why, the console has the reason (Rules §4). A malformed file fails the same way.
 */
export function requestMoonSystem(id: MoonSystemId, fetcher: Fetcher = (url) => fetch(url)): void {
  if (status.has(id)) return;
  status.set(id, 'loading');
  const url = moonSystemUrl(id);
  void Promise.resolve()
    .then(() => fetcher(url))
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    })
    .then((buffer) => {
      loaded.set(id, createHorizonsIndex(parseHorizonsEphemeris(buffer)));
      status.set(id, 'ready');
      notifyListeners();
    })
    .catch((error: unknown) => {
      console.warn(`Moons of ${id} not drawn: ${url} could not be loaded.`, error);
      status.set(id, 'failed');
      notifyListeners();
    });
}

/** Run `fn` once the system has loaded or failed, at once if it already has; asks for it. Returns a cancel. */
export function whenMoonSystemSettles(id: MoonSystemId, fn: () => void, fetcher?: Fetcher): () => void {
  requestMoonSystem(id, fetcher);
  const settled = () => moonSystemStatus(id) === 'ready' || moonSystemStatus(id) === 'failed';
  if (settled()) {
    fn();
    return () => undefined;
  }
  const off = subscribeMoonSystems(() => {
    if (!settled()) return;
    off();
    fn();
  });
  return off;
}

/** Bumped each time a system settles: what the panel re-renders on. */
export function moonSystemsVersion(): number {
  return version;
}

export function subscribeMoonSystems(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests only: forget every system, or start with some already loaded. */
export function resetMoonSystems(preloaded: Partial<Record<MoonSystemId, HorizonsIndex>> = {}): void {
  loaded.clear();
  status.clear();
  for (const id of MOON_SYSTEMS) {
    const index = preloaded[id];
    if (!index) continue;
    loaded.set(id, index);
    status.set(id, 'ready');
  }
  notifyListeners();
}
