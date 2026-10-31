import { useState } from 'react';
import { formatEpochUtc } from '../data/catalog-provenance.js';
import { dataAsOf, isPastPublishedWindow, isStaticSite, presentMs } from '../data/site-mode.js';
import './SiteNotices.css';

const DISMISSED_KEY = 'orcas.desktop-notice-dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch (err) {
    console.warn('[site-notices] localStorage unavailable:', err);
    return false;
  }
}

/** A one-time hint on phones: the full simulation is built for a desktop browser. */
function DesktopNotice() {
  const [hidden, setHidden] = useState(() => readDismissed() || !window.matchMedia('(max-width: 767px)').matches);
  if (hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch (err) {
      console.warn('[site-notices] dismissal not remembered:', err);
    }
  };
  return (
    <p className="site-notice" role="note">
      Best experienced on a desktop browser.{' '}
      <button type="button" className="site-notice__button" onClick={dismiss}>
        Dismiss
      </button>
    </p>
  );
}

function StaleNotice({ nowMs }: { nowMs: number }) {
  const asOf = dataAsOf();
  if (!isStaticSite() || asOf === null || !isPastPublishedWindow(nowMs)) return null;
  return (
    <p className="site-notice" role="status">
      This site’s orbit data covers up to <span className="site-notice__num">{formatEpochUtc(presentMs(nowMs))}</span>{' '}
      (data as of <span className="site-notice__num">{formatEpochUtc(asOf)}</span>).
    </p>
  );
}

/** Lines only the public site needs (spec §4–§5). Each says what is true, once. */
export function SiteNotices({ nowMs }: { nowMs: number }) {
  return (
    <>
      <DesktopNotice />
      <StaleNotice nowMs={nowMs} />
    </>
  );
}
