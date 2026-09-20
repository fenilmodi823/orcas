import { useEffect, useState } from 'react';
import { describeProvenance } from './catalog-provenance.js';
import type { CatalogProvenance } from './catalog-provenance.js';
import type { CatalogOrigin } from './use-catalog.js';
import type { CatalogSnapshot } from './catalog-types.js';

/** How often the staleness readout re-reads the clock. */
const TICK_MS = 30_000;

/**
 * Catalogue provenance against a slowly-ticking clock.
 *
 * The clock is the point. A readout frozen at mount would still say "2 min
 * ago" after four hours at the desk, which is presenting stale data as fresh —
 * the thing Rules.md bans. Ticking every 30 s keeps the age honest for the
 * price of one setState a minute; the readout is measured in minutes and
 * hours, so nothing finer would be visible anyway. Deliberately not tied to
 * useFrame: this is UI state, and per-frame React updates are banned.
 */
export function useProvenance(
  snapshot: CatalogSnapshot,
  origin: CatalogOrigin,
): CatalogProvenance {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return describeProvenance(snapshot, origin, nowMs);
}
