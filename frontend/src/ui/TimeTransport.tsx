import { ChevronDown, ChevronUp, Pause, Play, Rewind } from 'lucide-react';
import './TimeTransport.css';

export interface TimeTransportProps {
  playing: boolean;
  rate: number;
  currentTime: Date;
  expanded: boolean;
  onTogglePlay: () => void;
  onCycleRate: () => void;
  onJumpToNow: () => void;
  onToggleExpanded: () => void;
  /** Time runs backwards. With `onToggleDirection`, shows a direction toggle
   * and signs the rate label ("−10×"). */
  reversed?: boolean;
  onToggleDirection?: () => void;
}

/** Always with the date. Scrubbing moves the clock by days, and a bare time of
 * day after a jump of a week reads as *today* — the same trap as an undated
 * data epoch. NASA Eyes' own clock carries the date for this reason
 * (Rules.md §10 defers UX to it). */
function formatUtcClock(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}Z`;
}

/** The persistent transport row — always visible, mode="time" (Design.md §6, D7). */
export function TimeTransport({
  playing,
  rate,
  currentTime,
  expanded,
  onTogglePlay,
  onCycleRate,
  onJumpToNow,
  onToggleExpanded,
  reversed = false,
  onToggleDirection,
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
      {onToggleDirection && (
        <button
          type="button"
          className="time-transport__icon"
          data-active={reversed ? '' : undefined}
          onClick={onToggleDirection}
          aria-label={reversed ? 'Run time forwards' : 'Run time backwards'}
          aria-pressed={reversed}
        >
          <Rewind aria-hidden size={16} />
        </button>
      )}
      <button type="button" className="time-transport__rate" onClick={onCycleRate}>
        {reversed ? '−' : ''}
        {rate}×
      </button>
      <span className="time-transport__clock">{formatUtcClock(currentTime)}</span>
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
