import { useEffect, useState } from 'react';
import { parseHorizonsManifest, type HorizonsManifest } from './horizons-manifest.js';

const MANIFEST_URL = '/ephemeris/horizons/manifest.json';
let loading: Promise<HorizonsManifest | null> | null = null;

function loadHorizonsManifest(): Promise<HorizonsManifest | null> {
  loading ??= fetch(MANIFEST_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<unknown>;
    })
    .then(parseHorizonsManifest)
    .catch((error: unknown) => {
      console.warn(`Horizons export details not shown: ${MANIFEST_URL} could not be loaded.`, error);
      return null;
    });
  return loading;
}

/** The export's manifest, fetched once and only once a moon's panel needs it: undefined while it loads, null if it failed. */
export function useHorizonsManifest(enabled: boolean): HorizonsManifest | null | undefined {
  const [manifest, setManifest] = useState<HorizonsManifest | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadHorizonsManifest().then((m) => {
      if (!cancelled) setManifest(m);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return manifest;
}
