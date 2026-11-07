import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { BODY_D, MARK_HOLES, MARK_VIEW_BOX, PING, PING_DOTS, RING_D, WAVES_D } from './landing-mark-paths.js';
import {
  landingSequenceHasPlayed,
  markLandingSequencePlayed,
  PING_MS,
  REDUCED_MOTION_FADE_MS,
  TIMELINE,
  type LandingPhase,
} from './landing-timeline.js';
import './LandingSequence.css';
import './LandingReadout.css';
import { useCameraStatus } from '../renderer/camera/camera-status.js';
import { useReducedMotion } from '../state/use-reduced-motion.js';

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

/** Each dot lights when the ping's front reaches it: its distance over the ping's speed. */
const DOT_DELAYS_MS = PING_DOTS.map(([x, y]) => Math.round((Math.hypot(x - PING.x, y - PING.y) / PING.r) * PING_MS));

/**
 * The landing sequence AND the permanent top-left site brand mark are the
 * same component instance for the app's whole lifetime — the settle beat
 * animates this element's own `transform` from "centered, huge" to
 * identity; it is never unmounted and re-mounted elsewhere (Branding.md:
 * "not a cross-fade between two copies").
 */
export function LandingSequence({ onDone }: LandingSequenceProps) {
  const [alreadyPlayed] = useState(() => landingSequenceHasPlayed());
  // One source for the whole app (brief §6.5 note 2), so an in-app override
  // reaches the landing sequence and the camera alike.
  const reduced = useReducedMotion();
  const mode: Mode = alreadyPlayed ? 'skip' : reduced ? 'reduced' : 'full';

  const [phase, setPhase] = useState<LandingPhase>(mode === 'full' ? 'ring' : 'done');
  const [dismissed, setDismissed] = useState(mode === 'skip');
  const [instant, setInstant] = useState(mode === 'skip');
  // "Establishing link NN": decorative, as on the portfolio's loader — it measures nothing (Fenil, 2026-11-03).
  const [percent, setPercent] = useState(0);
  const requestEarth = useCameraStatus((s) => s.requestEarth);
  const ringRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    // getTotalLength isn't implemented in jsdom (no real SVG geometry) —
    // real browsers always have it; tests just skip the dash setup.
    const el = ringRef.current;
    if (el && typeof el.getTotalLength === 'function') {
      el.style.setProperty('--dash', String(el.getTotalLength()));
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

    const ticker = setInterval(() => setPercent((p) => Math.min(99, p + Math.random() * 17)), 130);
    const timers = TIMELINE.filter((step) => step.at > 0).map(({ phase: p, at }) =>
      setTimeout(() => {
        setPhase(p);
        if (p === 'settle') {
          clearInterval(ticker);
          setPercent(100);
        }
        if (p === 'done') {
          markLandingSequencePlayed();
          setDismissed(true);
          onDone?.();
        }
      }, at),
    );
    return () => {
      clearInterval(ticker);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mode/onDone are stable for this component's lifetime
  }, []);

  function handleSkip() {
    setInstant(true);
    setPhase('done');
    setDismissed(true);
    markLandingSequencePlayed();
    onDone?.();
  }

  // Every beat reached so far is a data attribute, so the CSS states each beat once.
  const reachedIndex = TIMELINE.findIndex((step) => step.phase === phase);
  const beats = Object.fromEntries(TIMELINE.map((step, i) => [`data-${step.phase}`, i <= reachedIndex ? '' : undefined]));
  const settled = phase === 'settle' || phase === 'done';
  const showChrome = mode === 'full';

  return (
    <div
      className="landing-sequence"
      data-phase={phase}
      data-mode={mode}
      data-instant={instant ? '' : undefined}
      {...beats}
    >
      {showChrome && <div className="landing-sequence__backdrop" data-dismissed={dismissed ? '' : undefined} />}

      <button
        type="button"
        className="landing-sequence__brand"
        aria-label="ORCAS: back to the Earth"
        disabled={!settled}
        onClick={requestEarth}
        data-settled={settled ? '' : undefined}
      >
        <svg
          className="landing-sequence__mark"
          viewBox={MARK_VIEW_BOX}
          role="img"
          aria-label="ORCAS"
          aria-hidden={showChrome && !dismissed ? true : undefined}
        >
          <path
            ref={ringRef}
            className="landing-sequence__ring"
            fill="none"
            stroke="var(--orca-cyan)"
            strokeWidth="0.8"
            d={RING_D}
          />
          {/* The breach: the body and its markings rise together (transform + opacity only, Rules.md). */}
          <g className="landing-sequence__body">
            <path className="landing-sequence__body-fill" d={BODY_D} />
            {MARK_HOLES.map((d, i) => (
              <path key={i} fill="var(--void)" d={d} />
            ))}
          </g>
          <g className="landing-sequence__fx">
            {WAVES_D.map((d, i) => (
              <path key={i} className="landing-sequence__wave" fill="none" stroke="var(--orca-cyan)" strokeWidth="0.6" d={d} />
            ))}
            {[0, 1].map((i) => (
              <circle key={i} className="landing-sequence__ping" cx={PING.x} cy={PING.y} r={PING.r} fill="none" stroke="var(--orca-cyan)" />
            ))}
            {PING_DOTS.map(([x, y], i) => (
              <circle
                key={i}
                className="landing-sequence__dot"
                cx={x}
                cy={y}
                r="1.1"
                style={{ '--dot-delay': `${DOT_DELAYS_MS[i]}ms` } as CSSProperties}
              />
            ))}
          </g>
        </svg>
        <span className="landing-sequence__word">ORCAS</span>
      </button>

      {showChrome && (
        <div className="landing-sequence__readout" aria-hidden="true">
          <span>Establishing link</span>
          <span className="landing-sequence__bar" />
          <span>{String(Math.floor(percent)).padStart(2, '0')}</span>
        </div>
      )}

      {showChrome && (
        <button
          type="button"
          className="landing-sequence__skip"
          data-dismissed={dismissed ? '' : undefined}
          inert={dismissed}
          onClick={handleSkip}
          aria-label="Skip intro animation"
        >
          Skip
        </button>
      )}
    </div>
  );
}
