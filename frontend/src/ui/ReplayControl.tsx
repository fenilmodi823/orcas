import { useState, type FormEvent } from 'react';
import { formatEpochUtc } from '../data/catalog-provenance.js';
import { parseUtcDateTimeLocal, toUtcDateTimeLocal } from './replay-input.js';
import './ReplayControl.css';

export interface ReplayHandle {
  /** The instant being replayed, or null for the present. */
  readonly atMs: number | null;
  /** Why the last replay request failed, in the backend's words. */
  readonly error: string | null;
  readonly start: (atMs: number) => Promise<void>;
  readonly end: () => void;
}

/**
 * Historical replay (Phase 5): load the catalogue as it stood at a past
 * instant — the element sets that existed then — and run the scene from
 * there. History is only as deep as ingestion; when it isn't deep enough,
 * the backend says how far back it goes and that is shown here.
 */
export function ReplayControl({ replay }: { replay: ReplayHandle }) {
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [maxValue] = useState(() => toUtcDateTimeLocal(Date.now()));

  if (replay.atMs !== null) {
    return (
      <div className="replay-control" role="group" aria-label="Historical replay">
        <p className="replay-control__status">
          Replaying the catalogue as it stood at{' '}
          <span className="replay-control__time">{formatEpochUtc(replay.atMs)}</span>
        </p>
        <button type="button" className="replay-control__button" onClick={replay.end}>
          Back to live
        </button>
      </div>
    );
  }

  const atMs = parseUtcDateTimeLocal(value);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (atMs === null) return;
    setPending(true);
    void replay.start(atMs).finally(() => setPending(false));
  };

  return (
    <form className="replay-control" aria-label="Historical replay" onSubmit={submit}>
      <label className="replay-control__label">
        Replay a past moment (UTC)
        <input
          type="datetime-local"
          className="replay-control__input"
          value={value}
          max={maxValue}
          step={60}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button type="submit" className="replay-control__button" disabled={atMs === null || pending}>
        {pending ? 'Loading…' : 'Replay'}
      </button>
      {replay.error && (
        <p className="replay-control__error" role="alert">
          {replay.error}
        </p>
      )}
    </form>
  );
}
