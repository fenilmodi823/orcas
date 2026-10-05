import { useState } from 'react';
import { formatEpochUtc } from '../data/catalog-provenance.js';
import { parseUtcInput } from '../time/utc-input.js';
import './TimeClock.css';

export interface TimeClockProps {
  time: Date;
  /** A typed time, ms since the Unix epoch, UTC. */
  onSetTime: (epochMs: number) => void;
}

/**
 * The dock's clock. Always dated: after a jump a bare time of day reads as
 * today. NASA Eyes lets you click its date and type a time (Reference §4.1);
 * this does the same, in UTC with the zone written out (A.11), and a time it
 * cannot read gets the format, never a guess.
 */
export function TimeClock({ time, onSetTime }: TimeClockProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const label = formatEpochUtc(time.getTime());

  if (draft === null) {
    return (
      <button
        type="button"
        className="time-clock"
        onClick={() => {
          setDraft(label.replace(/ UTC$/, ''));
          setError(false);
        }}
        aria-label={`${label}. Go to another time`}
      >
        {label}
      </button>
    );
  }

  function close() {
    setDraft(null);
    setError(false);
  }

  return (
    <span className="time-clock time-clock--editing">
      <input
        className="time-clock__input"
        aria-label="Go to time (UTC)"
        aria-invalid={error}
        value={draft}
        // Opened by a click on the clock, so focusing the field is expected.
        autoFocus
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={close}
        onKeyDown={(event) => {
          // The scene's own keys (Esc deselects) must not see these.
          event.stopPropagation();
          if (event.key === 'Escape') close();
          if (event.key !== 'Enter') return;
          const ms = parseUtcInput(draft);
          if (ms === null) return setError(true);
          close();
          onSetTime(ms);
        }}
      />
      <span className="time-clock__zone">UTC</span>
      {error && (
        <span role="alert" className="time-clock__error">
          Use YYYY-MM-DD HH:MM:SS (UTC)
        </span>
      )}
    </span>
  );
}
