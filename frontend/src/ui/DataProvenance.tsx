import {
  describeOrigin,
  formatAge,
  formatEpochUtc,
  isStale,
} from '../data/catalog-provenance.js';
import type { CatalogProvenance } from '../data/catalog-provenance.js';
import './DataProvenance.css';

/**
 * What the catalogue on screen is, where it came from, and how old it is.
 *
 * Rules.md bans presenting stale data as live and requires the element-set
 * epoch always to be shown; RA14.D3/D5 make source attribution a hard
 * requirement now that CelesTrak and Space-Track both feed the catalogue.
 * This is the one place that obligation is met, so it renders whether the
 * data is live or not — a live badge is as much a claim as a stale one.
 *
 * Snapshot age and element-set epoch are shown as two separate rows, never
 * merged into one number (RA14.D6): a freshly fetched snapshot can still
 * carry week-old elements.
 */
export function DataProvenance({ provenance }: { provenance: CatalogProvenance }) {
  const {
    origin,
    sources,
    objectCount,
    rejectedCount,
    newestEpochMs,
    newestEpochAgeMs,
    newestEpochIsAhead,
    fetchedAgeMs,
  } = provenance;

  return (
    <section
      className={`data-provenance${isStale(origin) ? ' data-provenance--stale' : ''}`}
      aria-label="Catalogue data provenance"
    >
      <p className="data-provenance__origin">
        <span className="data-provenance__dot" aria-hidden="true" />
        {describeOrigin(origin)}
      </p>

      <dl className="data-provenance__facts">
        <div>
          <dt>Objects</dt>
          <dd>{objectCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Source</dt>
          {/* Attribution, not decoration — RA14.D3. */}
          <dd>{sources.length > 0 ? sources.join(' + ') : '—'}</dd>
        </div>
        <div>
          <dt>Newest element set</dt>
          <dd>
            <span>{formatEpochUtc(newestEpochMs)}</span>
            <span className="data-provenance__age">
              {newestEpochIsAhead ? 'published ahead of now' : formatAge(newestEpochAgeMs)}
            </span>
          </dd>
        </div>
        <div>
          <dt>Snapshot fetched</dt>
          <dd>{formatAge(fetchedAgeMs)}</dd>
        </div>
        {rejectedCount > 0 && (
          <div>
            <dt>Rejected</dt>
            {/* Never a silent drop: malformed upstream records are counted
                where a reader can see them. */}
            <dd>{rejectedCount.toLocaleString()} records failed validation</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
