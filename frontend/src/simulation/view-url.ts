import { RATE_LADDER_S_PER_S } from '../time/rate-ladder.js';
import { parseUtcInput } from '../time/utc-input.js';
import { isBodyId } from '../renderer/solar/bodies.js';

/**
 * The view as a link, NASA Eyes' way (Reference - NASA Eyes §4.1: time and
 * rate live in the URL, so any view can be shared; LIVE clears them):
 * `?t=2026-10-05T00:00:00Z&rate=3600&object=25544`, or `object=jupiter` for a body (S5a). `rate=0` is paused, as in
 * NASA's URLs. Time is UTC (A.11).
 */
export interface ViewState {
  /** Simulated instant, or null when live (the link should open the present). */
  readonly epochMs: number | null;
  /** Signed, simulated seconds per real second. */
  readonly rate: number;
  readonly playing: boolean;
  readonly selected: string | null;
}

/** A copy of `search` with the view written in; other parameters kept. */
export function encodeViewState(search: URLSearchParams, state: ViewState): URLSearchParams {
  const next = new URLSearchParams(search);
  if (state.epochMs === null) {
    next.delete('t');
    next.delete('rate');
  } else {
    next.set('t', `${new Date(state.epochMs).toISOString().slice(0, 19)}Z`);
    next.set('rate', state.playing ? String(state.rate) : '0');
  }
  if (state.selected === null) next.delete('object');
  else next.set('object', state.selected);
  return next;
}

/** What a link asks for. Anything malformed is dropped, never guessed at. */
export function parseViewState(search: URLSearchParams): {
  epochMs: number | null;
  rate: number | null;
  paused: boolean;
  selected: string | null;
} {
  const t = search.get('t');
  const rateText = search.get('rate');
  const rate = rateText === null ? NaN : Number(rateText);
  const onLadder = RATE_LADDER_S_PER_S.includes(Math.abs(rate));
  const object = search.get('object');
  return {
    epochMs: t === null ? null : parseUtcInput(t),
    rate: onLadder ? rate : null,
    paused: rate === 0,
    // NORAD catalogue numbers are decimal strings (P4.D15); a body is one of the ids it knows.
    selected: object !== null && (/^\d{1,9}$/.test(object) || isBodyId(object)) ? object : null,
  };
}
