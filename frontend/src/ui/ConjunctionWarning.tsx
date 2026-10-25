import { X } from 'lucide-react';
import type { Conjunction } from '../data/conjunction-client.js';
import { AlertBadge } from './AlertBadge.js';
import { GlassSurface } from './GlassSurface.js';
import { warningKey } from './conjunction-warning.js';
import { DERIVATION, DISCLAIMER, HEADLINE, quietLine, warningText } from './conjunction-warning-text.js';
import type { WarningView } from './use-conjunction-warning.js';
import './ConjunctionWarning.css';

export interface ConjunctionWarningProps {
  readonly view: WarningView;
  readonly simulationMs: number;
  /** Real time now, for "screened N days ago". */
  readonly wallNowMs: number;
  readonly onWatch: (c: Conjunction) => void;
  readonly onGoThere: () => void;
  readonly onDismiss: (key: string) => void;
  /** Why the last Watch or Go there failed, in Replay's words; null otherwise. */
  readonly error: string | null;
}

const Num = ({ children }: { children: string }) => <span className="conjunction-warning__num">{children}</span>;

/**
 * The close-approach warning (conjunction-alert spec §3.3–§3.6): one message
 * at a time, or one quiet line. A visually hidden polite region announces
 * each new pass once; the ticking countdown is never in it.
 */
export function ConjunctionWarning({ view, simulationMs, wallNowMs, onWatch, onGoThere, onDismiss, error }: ConjunctionWarningProps) {
  if (view.kind === 'loading') return null;
  const failure = error ? <p className="conjunction-warning__error">{error}</p> : null;

  if (view.kind !== 'message') {
    const line = quietLine(view.kind === 'idle' ? { kind: 'idle', run: view.run, simulationMs } : view, wallNowMs);
    return (
      <div className="conjunction-warning conjunction-warning--quiet">
        <p className="conjunction-warning__quiet">
          {line.text}
          {line.goThere && (
            <button type="button" className="conjunction-warning__button" onClick={onGoThere}>Go there</button>
          )}
        </p>
        {failure}
        <p className="conjunction-warning__announce" aria-live="polite" />
      </div>
    );
  }

  const { conjunction } = view.pick;
  const t = warningText(view.pick, view.run, simulationMs);
  return (
    <GlassSurface variant="floating" className="conjunction-warning">
      <div className="conjunction-warning__head">
        <AlertBadge message={HEADLINE} role={null} />
        <Num>{t.countdown}</Num>
        <button type="button" className="conjunction-warning__icon" aria-label="Dismiss this close approach" onClick={() => onDismiss(warningKey(conjunction))}>
          <X aria-hidden size={16} />
        </button>
      </div>
      <p className="conjunction-warning__line">{t.pair} · <Num>{t.miss}</Num> apart at <Num>{t.speed}</Num></p>
      <p className="conjunction-warning__line">
        Maximum P_c <Num>{t.maximumPc}</Num>: an upper bound, for a <Num>{t.aspectRatio}</Num> ellipse and a <Num>{t.hardBodyRadius}</Num> hard-body radius.
      </p>
      <p className="conjunction-warning__note">{DERIVATION}</p>
      <p className="conjunction-warning__note">
        Screened <Num>{t.windowStart}</Num> → <Num>{t.windowEnd}</Num> · orbit records <Num>{t.recordAge}</Num> old at closest approach
      </p>
      <div className="conjunction-warning__foot">
        <p className="conjunction-warning__note">{DISCLAIMER}</p>
        <button type="button" className="conjunction-warning__button" onClick={() => onWatch(conjunction)}>Watch</button>
      </div>
      {failure}
      <p className="conjunction-warning__announce" aria-live="polite">{t.announcement}</p>
    </GlassSurface>
  );
}
