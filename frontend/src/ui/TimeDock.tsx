import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GlassSurface } from './GlassSurface.js';
import { TimeTransport } from './TimeTransport.js';
import { TimeScrubber } from './TimeScrubber.js';
import { ObjectSummary } from './ObjectSummary.js';
import { ObjectDetail, type ObjectDetailData } from './ObjectDetail.js';
import { FilterChip } from './FilterChip.js';
import type { SelectableObject, OrbitClass } from '../state/selection-store.js';
import './TimeDock.css';

/** Design.md §5: panels spring, stiffness 220 / damping 26. */
const PANEL_SPRING = { type: 'spring', stiffness: 220, damping: 26 } as const;

export interface FilterOption {
  orbitClass: OrbitClass;
  label: string;
  count: number;
  active: boolean;
}

export interface TimeDockTimeProps {
  mode: 'time';
  playing: boolean;
  rate: number;
  currentTime: Date;
  rangeStart: Date;
  rangeEnd: Date;
  conjunctionMarkers?: readonly Date[];
  filters: readonly FilterOption[];
  onTogglePlay: () => void;
  onCycleRate: () => void;
  onJumpToNow: () => void;
  onScrub: (time: Date) => void;
  onToggleFilter: (orbitClass: OrbitClass) => void;
}

export interface TimeDockObjectProps {
  mode: 'object';
  object: SelectableObject;
  detail: ObjectDetailData;
  onBack: () => void;
}

export type TimeDockProps = TimeDockTimeProps | TimeDockObjectProps;

/**
 * The interface (Design.md §6, D7) — the most-attended component in the
 * inventory. Two modes: `time` (persistent transport + scrubber, expands
 * upward into filters) and `object` (identity + telemetry, expands into the
 * full detail grid). Split from a single file per the P3.2 brief.
 */
export function TimeDock(props: TimeDockProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (props.mode !== 'object') return;
    const onBack = props.onBack;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onBack();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [props]);

  return (
    <GlassSurface variant="docked" elevation={3} className="time-dock">
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="expanded"
            className="time-dock__expanded"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={PANEL_SPRING}
          >
            {props.mode === 'time' ? (
              <div className="time-dock__filters">
                {props.filters.map((filter) => (
                  <FilterChip
                    key={filter.orbitClass}
                    orbitClass={filter.orbitClass}
                    label={filter.label}
                    count={filter.count}
                    active={filter.active}
                    onToggle={() => props.onToggleFilter(filter.orbitClass)}
                  />
                ))}
              </div>
            ) : (
              <ObjectDetail detail={props.detail} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {props.mode === 'time' ? (
        <>
          <TimeTransport
            playing={props.playing}
            rate={props.rate}
            currentTime={props.currentTime}
            expanded={expanded}
            onTogglePlay={props.onTogglePlay}
            onCycleRate={props.onCycleRate}
            onJumpToNow={props.onJumpToNow}
            onToggleExpanded={() => setExpanded((value) => !value)}
          />
          <TimeScrubber
            currentTime={props.currentTime}
            rangeStart={props.rangeStart}
            rangeEnd={props.rangeEnd}
            conjunctionMarkers={props.conjunctionMarkers}
            onScrub={props.onScrub}
          />
        </>
      ) : (
        // aria-live announces the selection change and its telemetry to
        // screen readers (Design.md §9) — the "more information" toggle
        // itself is a direct user action, so it doesn't need the live
        // region; only the object *becoming* selected does.
        <div role="region" aria-live="polite" aria-label={`Selected object: ${props.object.name}`}>
          <ObjectSummary
            object={props.object}
            detailOpen={expanded}
            onToggleDetail={() => setExpanded((value) => !value)}
            onBack={props.onBack}
          />
        </div>
      )}
    </GlassSurface>
  );
}
