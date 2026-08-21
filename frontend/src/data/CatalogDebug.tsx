import { GlassSurface } from '../ui/GlassSurface.js';
import { StatusPill } from '../ui/StatusPill.js';
import { TelemetryReadout } from '../ui/TelemetryReadout.js';
import { computeCatalogStats } from './catalog-stats.js';
import { useCatalog } from './use-catalog.js';
import './CatalogDebug.css';

const REGIME_LABELS = { leo: 'LEO', meo: 'MEO', geo: 'GEO', heo: 'HEO', unknown: 'Unknown' } as const;
const AGE_BUCKET_LABELS = {
  underOneDay: '< 1 day',
  oneToSevenDays: '1–7 days',
  sevenToThirtyDays: '7–30 days',
  overThirtyDays: '> 30 days',
} as const;

/**
 * M1.0's debug route (Phase-4 brief): no 3D, just the numbers — object
 * count, regime histogram, epoch-age histogram, rejected-record count
 * with reasons, snapshot version and fetch time. Proves the ingest +
 * validate + freeze + persist pipeline is real before any rendering work
 * starts on top of it.
 */
export function CatalogDebug() {
  const { snapshot, origin, loading, error } = useCatalog();

  if (loading) {
    return (
      <div className="catalog-debug">
        <GlassSurface variant="floating" elevation={2}>
          <p className="catalog-debug__status">Loading catalogue…</p>
        </GlassSurface>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="catalog-debug">
        <GlassSurface variant="floating" elevation={2}>
          <p className="catalog-debug__status" data-error>
            No catalogue available — live fetch and cached snapshot both failed.
            {error && <span className="catalog-debug__error-detail"> ({error})</span>}
          </p>
        </GlassSurface>
      </div>
    );
  }

  const stats = computeCatalogStats(snapshot);

  return (
    <div className="catalog-debug">
      <GlassSurface variant="floating" elevation={2} className="catalog-debug__panel">
        <div className="catalog-debug__header">
          <h1>Catalog debug</h1>
          <StatusPill epoch={new Date(snapshot.fetchedAtMs)} stale={origin === 'cached'} />
        </div>

        <div className="catalog-debug__grid">
          <TelemetryReadout label="Objects" value={stats.objectCount} />
          <TelemetryReadout label="Rejected" value={stats.rejectedCount} />
          <TelemetryReadout label="Version" value={snapshot.version} />
          <TelemetryReadout label="Origin" value={origin} />
        </div>

        <section>
          <h2>Regime</h2>
          <ul className="catalog-debug__histogram">
            {Object.entries(stats.regimeCounts).map(([key, count]) => (
              <li key={key}>
                <span>{REGIME_LABELS[key as keyof typeof REGIME_LABELS]}</span>
                <span>{count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Element-set age</h2>
          <ul className="catalog-debug__histogram">
            {Object.entries(stats.epochAgeBuckets).map(([key, count]) => (
              <li key={key}>
                <span>{AGE_BUCKET_LABELS[key as keyof typeof AGE_BUCKET_LABELS]}</span>
                <span>{count}</span>
              </li>
            ))}
          </ul>
        </section>

        {stats.rejectedCount > 0 && (
          <section>
            <h2>Rejection reasons</h2>
            <ul className="catalog-debug__histogram">
              {Object.entries(stats.rejectionCounts).map(([reason, count]) => (
                <li key={reason}>
                  <span>{reason}</span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </GlassSurface>
    </div>
  );
}
