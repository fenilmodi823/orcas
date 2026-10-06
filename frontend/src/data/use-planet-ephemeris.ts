import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { parsePlanetEphemeris, type PlanetEphemeris } from './planet-ephemeris.js';

const EPHEMERIS_URL = '/ephemeris/planets-de421.bin';

// One fetch for the page: the scene, the camera and the panel all read the same bake (S5a).
let loading: Promise<PlanetEphemeris | null> | null = null;

function loadPlanetEphemeris(): Promise<PlanetEphemeris | null> {
  loading ??= fetch(EPHEMERIS_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    })
    .then(parsePlanetEphemeris)
    .catch((error: unknown) => {
      console.warn(`Planets not drawn: ${EPHEMERIS_URL} could not be loaded.`, error);
      return null;
    });
  return loading;
}

/**
 * The DE421 planet bake (S3), loaded once per page. A ref, not state: the scene reads it
 * per frame and nothing should re-render when it lands. Null until then, and
 * for good if the file fails: the planets are simply not drawn and the rest of
 * the scene runs (Rules.md's error table), with the reason in the console.
 */
export function usePlanetEphemeris(): MutableRefObject<PlanetEphemeris | null> {
  const ref = useRef<PlanetEphemeris | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadPlanetEphemeris().then((ephemeris) => {
      if (!cancelled) ref.current = ephemeris;
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ref;
}

/** The same bake as React state, for UI that renders from it (the body panel, S5a): one re-render when it lands. */
export function usePlanetEphemerisState(): PlanetEphemeris | null {
  const [ephemeris, setEphemeris] = useState<PlanetEphemeris | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadPlanetEphemeris().then((loaded) => {
      if (!cancelled) setEphemeris(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ephemeris;
}
