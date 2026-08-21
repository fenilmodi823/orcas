import type { ChangeEvent } from 'react';
import { useMemo } from 'react';
import './TimeScrubber.css';

export interface TimeScrubberProps {
  currentTime: Date;
  rangeStart: Date;
  rangeEnd: Date;
  conjunctionMarkers?: readonly Date[];
  onScrub: (time: Date) => void;
}

const RESOLUTION = 1000;

function fractionOf(target: Date, rangeStart: Date, spanMs: number): number {
  if (spanMs <= 0) return 0;
  return Math.min(1, Math.max(0, (target.getTime() - rangeStart.getTime()) / spanMs));
}

/** The scrubber track, with conjunction markers overlaid (Design.md §6, D7). */
export function TimeScrubber({ currentTime, rangeStart, rangeEnd, conjunctionMarkers = [], onScrub }: TimeScrubberProps) {
  const spanMs = rangeEnd.getTime() - rangeStart.getTime();

  const value = useMemo(
    () => Math.round(fractionOf(currentTime, rangeStart, spanMs) * RESOLUTION),
    [currentTime, rangeStart, spanMs],
  );

  const markerPercents = useMemo(
    () => conjunctionMarkers.map((marker) => fractionOf(marker, rangeStart, spanMs) * 100),
    [conjunctionMarkers, rangeStart, spanMs],
  );

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const fraction = Number(event.target.value) / RESOLUTION;
    onScrub(new Date(rangeStart.getTime() + fraction * spanMs));
  }

  return (
    <div className="time-scrubber">
      <input
        type="range"
        className="time-scrubber__track"
        min={0}
        max={RESOLUTION}
        value={value}
        onChange={handleChange}
        aria-label="Scrub simulation time"
      />
      <div className="time-scrubber__markers" aria-hidden>
        {markerPercents.map((percent, index) => (
          <span key={index} className="time-scrubber__marker" style={{ left: `${percent}%` }} />
        ))}
      </div>
    </div>
  );
}
