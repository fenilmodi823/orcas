import { ChevronDown, ChevronUp, Pause, Play } from 'lucide-react';
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
}

function formatUtcClock(date: Date): string {
  return `${date.toISOString().slice(11, 19)}Z`;
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
      <button type="button" className="time-transport__rate" onClick={onCycleRate}>
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
