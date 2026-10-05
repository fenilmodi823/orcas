import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { parsePlanetEphemeris, type PlanetEphemeris } from './planet-ephemeris.js';

const EPHEMERIS_URL = '/ephemeris/planets-de421.bin';

/**
 * The DE421 planet bake (S3), loaded once. A ref, not state: the scene reads it
 * per frame and nothing should re-render when it lands. Null until then, and
 * for good if the file fails: the planets are simply not drawn and the rest of
 * the scene runs (Rules.md's error table), with the reason in the console.
 */
export function usePlanetEphemeris(): MutableRefObject<PlanetEphemeris | null> {
  const ref = useRef<PlanetEphemeris | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(EPHEMERIS_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (!cancelled) ref.current = parsePlanetEphemeris(buffer);
      })
      .catch((error: unknown) => {
        if (!cancelled) console.warn(`Planets not drawn: ${EPHEMERIS_URL} could not be loaded.`, error);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return ref;
}
