import { formatEpochUtc } from '../data/catalog-provenance.js';
import { dataAsOf, isPastPublishedWindow, isStaticSite, presentMs } from '../data/site-mode.js';
import './SiteNotices.css';

/** Lines only the public site needs (spec §4–§5). Each says what is true, once. */
export function SiteNotices({ nowMs }: { nowMs: number }) {
  const asOf = dataAsOf();
  if (!isStaticSite() || asOf === null || !isPastPublishedWindow(nowMs)) return null;
  return (
    <p className="site-notice" role="status">
      Showing {formatEpochUtc(presentMs(nowMs))} — the latest moment this site’s orbit data covers (data as of{' '}
      {formatEpochUtc(asOf)}).
    </p>
  );
}
