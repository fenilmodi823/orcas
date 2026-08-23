import { useEffect, useRef, useState } from 'react';
import { GlassSurface } from '../ui/GlassSurface.js';
import { TimeScrubber } from '../ui/TimeScrubber.js';
import { useCatalog } from '../data/use-catalog.js';
import { useSimulationLoop } from './use-simulation-loop.js';
import { encodeSimulationCoordinate, parseSimulationCoordinate } from '../time/url-state.js';
import { epochMsToTicks } from '../time/clock.js';
import type { ObjectMeta } from '../data/catalog-types.js';
import './SimulationDebug.css';

const TABLE_ROWS = 10;
const POLL_MS = 100; // ≤10Hz mirror into the UI — brief §A.4 rule 4

function readInitialEpochMs(fallbackMs: number): number {
  const parsed = parseSimulationCoordinate(new URLSearchParams(window.location.search));
  return parsed ? (parsed.epochTicks / 1024) * 1000 : fallbackMs;
}

/** M1.2's debug route (brief §I): no 3D — the segment ring's status, a
 * scrubbable time axis, and a live table of ten objects' positions.
 * `useCatalog()` resolves asynchronously (starts empty), so the
 * loop-owning work is split into `SimulationDebugPanel` below and only
 * mounted once real objects exist — `useSimulationLoop`'s `FrameState`
 * buffer is sized once at mount from `objects.length`; mounting it
 * before the catalogue loads would freeze that size at 0. */
export function SimulationDebug() {
  const { snapshot, loading, error } = useCatalog();
  const objects = snapshot?.objects.slice(0, TABLE_ROWS) ?? [];

  if (loading) {
    return (
      <div className="simulation-debug">
        <GlassSurface variant="floating" elevation={2}>
          <p className="simulation-debug__status">Loading catalogue…</p>
        </GlassSurface>
      </div>
    );
  }

  if (objects.length === 0 || snapshot === null) {
    return (
      <div className="simulation-debug">
        <GlassSurface variant="floating" elevation={2}>
          <p className="simulation-debug__status" data-error>
            No catalogue object available.
            {error && <span className="simulation-debug__error-detail"> ({error})</span>}
          </p>
        </GlassSurface>
      </div>
    );
  }

  return <SimulationDebugPanel objects={objects} snapshotVersion={snapshot.version} />;
}

interface SimulationDebugPanelProps {
  readonly objects: readonly ObjectMeta[];
  readonly snapshotVersion: number;
}

/** Only ever mounted with a non-empty, already-loaded `objects` — safe
 * to size `useSimulationLoop`'s buffers from `objects.length` once. */
function SimulationDebugPanel({ objects, snapshotVersion }: SimulationDebugPanelProps) {
  const playingRef = useRef(true);
  const rateRef = useRef(1);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState(1);
  const [startEpochMs] = useState(() => readInitialEpochMs(Date.now()));

  const loop = useSimulationLoop(objects, playingRef, rateRef, startEpochMs);

  const [displayEpochMs, setDisplayEpochMs] = useState(startEpochMs);
  useEffect(() => {
    const interval = setInterval(() => setDisplayEpochMs(loop.frameStateRef.current.epochMs), POLL_MS);
    return () => clearInterval(interval);
  }, [loop.frameStateRef]);

  useEffect(() => {
    const next = encodeSimulationCoordinate(new URLSearchParams(window.location.search), {
      snapshotVersion,
      epochTicks: epochMsToTicks(displayEpochMs),
    });
    window.history.replaceState(null, '', `?${next.toString()}`);
  }, [displayEpochMs, snapshotVersion]);

  const frameState = loop.frameStateRef.current;
  const ring = loop.ringRef.current;

  return (
    <div className="simulation-debug">
      <GlassSurface variant="floating" elevation={2} className="simulation-debug__panel">
        <div className="simulation-debug__header">
          <h1>Simulation core debug</h1>
          <button
            type="button"
            onClick={() => {
              playingRef.current = !playingRef.current;
              setPlaying(playingRef.current);
            }}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = rate === 1 ? 60 : rate === 60 ? -60 : 1;
              rateRef.current = next;
              setRate(next);
            }}
          >
            {rate}×
          </button>
        </div>

        <p className="simulation-debug__ring-status">
          ring generation {ring.generation} · window {new Date(ring.windowT0Ms).toISOString()} →{' '}
          {new Date(ring.windowT1Ms).toISOString()}
        </p>

        <TimeScrubber
          currentTime={new Date(displayEpochMs)}
          rangeStart={new Date(startEpochMs - 3_600_000)}
          rangeEnd={new Date(startEpochMs + 3_600_000)}
          onScrub={(time) => loop.scrubTo(time.getTime())}
        />

        <table className="simulation-debug__table">
          <thead>
            <tr>
              <th>NORAD</th>
              <th>x (km)</th>
              <th>y (km)</th>
              <th>z (km)</th>
            </tr>
          </thead>
          <tbody>
            {objects.map((object, i) => (
              <tr key={object.norad}>
                <td>{object.norad}</td>
                <td>{frameState.positions[i * 3].toFixed(1)}</td>
                <td>{frameState.positions[i * 3 + 1].toFixed(1)}</td>
                <td>{frameState.positions[i * 3 + 2].toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassSurface>
    </div>
  );
}
