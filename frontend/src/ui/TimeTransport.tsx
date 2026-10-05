import { ChevronDown, ChevronUp, FastForward, Pause, Play, Rewind } from 'lucide-react';
import { formatRate } from '../time/rate-ladder.js';
import { TimeClock } from './TimeClock.js';
import './TimeTransport.css';

export interface TimeTransportProps {
  playing: boolean;
  /** Signed: simulated seconds per real second, negative running backwards. */
  rate: number;
  currentTime: Date;
  expanded: boolean;
  onTogglePlay: () => void;
  /** ▶▶ (+1) and ◀◀ (−1): one step along NASA Eyes' rate ladder. */
  onStepRate: (direction: 1 | -1) => void;
  /** A typed time from the clock (UTC, ms). */
  onSetTime: (epochMs: number) => void;
  onJumpToNow: () => void;
  onToggleExpanded: () => void;
}

/** The persistent transport row — always visible, mode="time" (Design.md §6, D7).
 * Pause on its own, then ◀◀ [rate] ▶▶ — NASA Eyes' controls (Reference §4.1):
 * a ladder from real time to 3 years per second, and one ◀◀ press from real
 * time runs time backwards at 1 s/s. */
export function TimeTransport({
  playing,
  rate,
  currentTime,
  expanded,
  onTogglePlay,
  onStepRate,
  onSetTime,
  onJumpToNow,
  onToggleExpanded,
}: TimeTransportProps) {
  return (
    <div className="time-transport">
      <button
        type="button"
        className="time-transport__icon"
        onClick={onTogglePlay}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause aria-hidden size={16} /> : <Play aria-hidden size={16} />}
      </button>
      <button type="button" className="time-transport__icon" onClick={() => onStepRate(-1)} aria-label="Slower">
        <Rewind aria-hidden size={16} />
      </button>
      <span className="time-transport__rate" aria-live="polite">
        {formatRate(rate)}
      </span>
      <button type="button" className="time-transport__icon" onClick={() => onStepRate(1)} aria-label="Faster">
        <FastForward aria-hidden size={16} />
      </button>
      <TimeClock time={currentTime} onSetTime={onSetTime} />
      <button type="button" className="time-transport__now" onClick={onJumpToNow}>
        NOW
      </button>
      <button
        type="button"
        className="time-transport__icon"
        onClick={onToggleExpanded}
        aria-label={expanded ? 'Collapse' : 'Expand'}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown aria-hidden size={16} /> : <ChevronUp aria-hidden size={16} />}
      </button>
    </div>
  );
}
