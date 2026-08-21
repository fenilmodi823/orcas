import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BODY_D, MARK_HOLES, MARK_VIEW_BOX, RING_D } from './landing-mark-paths.js';
import {
  landingSequenceHasPlayed,
  markLandingSequencePlayed,
  REDUCED_MOTION_FADE_MS,
  TIMELINE,
  type LandingPhase,
} from './landing-timeline.js';
import './LandingSequence.css';

export interface LandingSequenceProps {
  /**
   * Real data readiness, wired up once P4 has something to wait on. The
   * sequence may SHORTEN toward this becoming true; it never lengthens for
   * it. Defaults to true — there is no async load to gate on yet, and this
   * component does not invent one to demonstrate the behaviour.
   */
  dataReady?: boolean;
  onDone?: () => void;
}

type Mode = 'full' | 'reduced' | 'skip';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The landing sequence AND the permanent top-left site brand mark are the
 * same component instance for the app's whole lifetime — the 3.0s beat
 * animates this element's own `transform` from "centered, huge" to
 * identity; it is never unmounted and re-mounted elsewhere (Branding.md:
 * "not a cross-fade between two copies").
 */
export function LandingSequence({ onDone }: LandingSequenceProps) {
  const [alreadyPlayed] = useState(() => landingSequenceHasPlayed());
  const [reduced] = useState(() => prefersReducedMotion());
  const mode: Mode = alreadyPlayed ? 'skip' : reduced ? 'reduced' : 'full';

  const [phase, setPhase] = useState<LandingPhase>(mode === 'full' ? 'point' : 'done');
  const [dismissed, setDismissed] = useState(mode === 'skip');
  const [instant, setInstant] = useState(mode === 'skip');
  const bodyRef = useRef<SVGPathElement>(null);
  const ringRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    // getTotalLength isn't implemented in jsdom (no real SVG geometry) —
    // real browsers always have it; tests just skip the dash setup.
    for (const el of [bodyRef.current, ringRef.current]) {
      if (el && typeof el.getTotalLength === 'function') {
        el.style.setProperty('--dash', String(el.getTotalLength()));
      }
    }
  }, []);

  useEffect(() => {
    if (mode === 'skip') {
      onDone?.();
      return;
    }

    if (mode === 'reduced') {
      const timer = setTimeout(() => {
        markLandingSequencePlayed();
        setDismissed(true);
        onDone?.();
      }, REDUCED_MOTION_FADE_MS);
      return () => clearTimeout(timer);
    }

    const timers = TIMELINE.filter((step) => step.at > 0).map(({ phase: p, at }) =>
      setTimeout(() => {
        setPhase(p);
        if (p === 'done') {
          markLandingSequencePlayed();
          setDismissed(true);
          onDone?.();
        }
      }, at),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mode/onDone are stable for this component's lifetime
  }, []);

  function handleSkip() {
    setInstant(true);
    setPhase('done');
    setDismissed(true);
    markLandingSequencePlayed();
    onDone?.();
  }

  const settled = phase === 'settle' || phase === 'done';
  const showChrome = mode === 'full';

  return (
    <div
      className="landing-sequence"
      data-phase={phase}
      data-mode={mode}
      data-instant={instant ? '' : undefined}
    >
      {showChrome && <div className="landing-sequence__backdrop" data-dismissed={dismissed ? '' : undefined} />}

      <div className="landing-sequence__brand" data-settled={settled ? '' : undefined}>
        <svg
          className="landing-sequence__mark"
          viewBox={MARK_VIEW_BOX}
          role="img"
          aria-label="ORCAS"
          aria-hidden={showChrome && !dismissed ? true : undefined}
        >
          <clipPath id="landing-body-clip">
            <path d={BODY_D} />
          </clipPath>
          <path
            ref={ringRef}
            className="landing-sequence__ring"
            fill="none"
            stroke="var(--orca-cyan)"
            strokeWidth="0.8"
            d={RING_D}
          />
          {/* Two paths, not a fill-colour tween: the stroke draws on, then
              hands off to the fill via opacity only (Rules.md: transform,
              opacity, stroke-dashoffset — never anything else animated). */}
          <path ref={bodyRef} className="landing-sequence__body-stroke" d={BODY_D} />
          <path className="landing-sequence__body-fill" d={BODY_D} />
          {MARK_HOLES.map((d, i) => (
            <path key={i} className="landing-sequence__hole" fill="var(--void)" d={d} />
          ))}
          <g clipPath="url(#landing-body-clip)">
            <rect className="landing-sequence__sweep" x="60" y="40" width="14" height="130" fill="var(--text-hi)" />
          </g>
        </svg>
        <span className="landing-sequence__word">ORCAS</span>
      </div>

      {showChrome && (
        <button
          type="button"
          className="landing-sequence__skip"
          data-dismissed={dismissed ? '' : undefined}
          onClick={handleSkip}
          aria-label="Skip intro animation"
        >
          Skip
        </button>
      )}
    </div>
  );
}
