import { useMemo, useState } from 'react';
import { satrecFromOmm, propagate, temeToJ2000Matrix, applyMat3 } from '@orcas/physics';
import { GlassSurface } from '../ui/GlassSurface.js';
import { TelemetryReadout } from '../ui/TelemetryReadout.js';
import { useCatalog } from '../data/use-catalog.js';
import { buildSegmentChain, sampleChain } from './segment-builder.js';
import { chooseStepSeconds } from './step-size.js';
import './PropagationDebug.css';

const SAMPLE_COUNT = 200;
const CHART_WIDTH = 900;
const CHART_HEIGHT = 240;

function altitudeKm(positionKm: { x: number; y: number; z: number }): number {
  const EARTH_RADIUS_KM = 6371;
  return Math.hypot(positionKm.x, positionKm.y, positionKm.z) - EARTH_RADIUS_KM;
}

function toPath(values: readonly number[], min: number, max: number): string {
  const range = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * CHART_WIDTH;
      const y = CHART_HEIGHT - ((v - min) / range) * CHART_HEIGHT;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * M1.1's debug route (Phase-4 brief §I): no 3D, just proof the Hermite
 * sampler tracks direct SGP4 for one real object across one orbit.
 * Plots both curves, overlaid, plus the residual — the "expected visual
 * result" the milestone spec calls for.
 */
export function PropagationDebug() {
  const { snapshot, loading, error } = useCatalog();
  const object = snapshot?.objects[0];
  // Lazy initializer: React guarantees this runs exactly once, unlike a
  // call inside useMemo's callback (which the rules-of-hooks purity
  // check correctly rejects — Date.now() is impure and useMemo must be
  // idempotent across re-renders).
  const [startMs] = useState(() => Date.now());

  const chart = useMemo(() => {
    if (!object) return null;
    const satrec = satrecFromOmm(object.record);
    const periodMs = (1440 / object.record.MEAN_MOTION) * 60_000;
    const hSeconds = chooseStepSeconds(object.record.MEAN_MOTION, object.record.ECCENTRICITY, 1);
    const chain = buildSegmentChain(satrec, object.norad, startMs, startMs + periodMs, hSeconds * 1000);

    const direct: number[] = [];
    const interpolated: number[] = [];
    let maxResidualM = 0;

    for (let i = 0; i <= SAMPLE_COUNT; i++) {
      const atMs = Math.round(startMs + (periodMs * i) / SAMPLE_COUNT);
      const at = new Date(atMs);
      // buildSegmentChain rotates SGP4's raw TEME output to
      // approximate-J2000 before storing endpoints (see segment-builder.ts),
      // so the "direct" reference must be rotated the same way — for a
      // 2026 epoch that rotation is tens of km, not negligible. Comparing
      // against raw propagate() output here previously showed a
      // spurious ~44km "residual" that was actually just this frame
      // mismatch, not interpolation error (same bug found and fixed in
      // segment-builder.test.ts's residual test).
      const rawDirect = propagate(satrec, at, object.norad);
      const directPositionJ2000 = applyMat3(temeToJ2000Matrix(at), rawDirect.positionEciKm);
      const interpolatedState = sampleChain(chain, atMs);
      direct.push(altitudeKm(directPositionJ2000));
      interpolated.push(altitudeKm(interpolatedState.position));

      const diffKm = Math.hypot(
        directPositionJ2000.x - interpolatedState.position.x,
        directPositionJ2000.y - interpolatedState.position.y,
        directPositionJ2000.z - interpolatedState.position.z,
      );
      maxResidualM = Math.max(maxResidualM, diffKm * 1000);
    }

    const min = Math.min(...direct, ...interpolated);
    const max = Math.max(...direct, ...interpolated);
    return {
      directPath: toPath(direct, min, max),
      interpolatedPath: toPath(interpolated, min, max),
      maxResidualM,
      hSeconds,
    };
  }, [object, startMs]);

  if (loading) {
    return (
      <div className="propagation-debug">
        <GlassSurface variant="floating" elevation={2}>
          <p className="propagation-debug__status">Loading catalogue…</p>
        </GlassSurface>
      </div>
    );
  }

  if (!object || !chart) {
    return (
      <div className="propagation-debug">
        <GlassSurface variant="floating" elevation={2}>
          <p className="propagation-debug__status" data-error>
            No catalogue object available.
            {error && <span className="propagation-debug__error-detail"> ({error})</span>}
          </p>
        </GlassSurface>
      </div>
    );
  }

  return (
    <div className="propagation-debug">
      <GlassSurface variant="floating" elevation={2} className="propagation-debug__panel">
        <div className="propagation-debug__header">
          <h1>Propagation debug — {object.name}</h1>
        </div>

        <div className="propagation-debug__grid">
          <TelemetryReadout label="Step h" value={chart.hSeconds} unit="s" precision={1} />
          <TelemetryReadout label="Max residual" value={chart.maxResidualM} unit="m" precision={3} />
        </div>

        <svg
          className="propagation-debug__chart"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label="Direct SGP4 versus Hermite-interpolated altitude over one orbit"
        >
          <path d={chart.directPath} className="propagation-debug__line propagation-debug__line--direct" />
          <path
            d={chart.interpolatedPath}
            className="propagation-debug__line propagation-debug__line--interpolated"
          />
        </svg>
        <div className="propagation-debug__legend">
          <span className="propagation-debug__legend-item propagation-debug__legend-item--direct">
            Direct SGP4
          </span>
          <span className="propagation-debug__legend-item propagation-debug__legend-item--interpolated">
            Hermite-interpolated
          </span>
        </div>
      </GlassSurface>
    </div>
  );
}
