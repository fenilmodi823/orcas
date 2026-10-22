import { useSyncExternalStore } from 'react';
import { moonSystemsVersion, subscribeMoonSystems } from './moon-systems.js';

/** One re-render whenever a moon system loads or fails: the panel's pending line becomes the moon (S6b). */
export function useMoonSystemsVersion(): number {
  return useSyncExternalStore(subscribeMoonSystems, moonSystemsVersion);
}
