import { useEffect, useState } from 'react';
import { satrecFromOmm, propagate, temeToJ2000Matrix, applyMat3 } from '@orcas/physics';
import type { ObjectMeta } from '../../data/catalog-types.js';
import type { SimulationLoopHandle } from '../../simulation/use-simulation-loop.js';
import { computePointShading } from './points-shading.js';
import { PLACEHOLDER_RADIUS_KM } from './points-attributes.js';

const CROSS_CHECK_COUNT = 10;
const POLL_MS = 100; // matches SimulationDebug.tsx's existing ≤10Hz UI-mirror pattern

interface Vec3Km {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CrossCheckRow {
  readonly norad: string;
  readonly renderedKm: Vec3Km;
  readonly directKm: Vec3Km;
  readonly deltaM: number;
  readonly drawPx: number;
}

/**
 * The milestone's "cross-check ten known objects' screen positions
 * against an independent tracker" requirement (brief §I) — reusing the
 * exact direct-SGP4 reference PropagationDebug.tsx already established
 * and live-verified against a real ISS record in M1.1, rather than a new
 * external tracker dependency.
 */
function buildCrossCheckRows(
  objects: readonly ObjectMeta[],
  frameState: { positions: Float32Array; epochMs: number },
  pixelsPerRadian: number,
): CrossCheckRow[] {
  const rows: CrossCheckRow[] = [];
  const at = new Date(frameState.epochMs);

  for (let i = 0; i < Math.min(CROSS_CHECK_COUNT, objects.length); i++) {
    const object = objects[i];
    const satrec = satrecFromOmm(object.record);
    const rawDirect = propagate(satrec, at, object.norad);
    const directKm = applyMat3(temeToJ2000Matrix(at), rawDirect.positionEciKm);

    const renderedKm: Vec3Km = {
      x: frameState.positions[i * 3],
      y: frameState.positions[i * 3 + 1],
      z: frameState.positions[i * 3 + 2],
    };

    const deltaM =
      Math.hypot(directKm.x - renderedKm.x, directKm.y - renderedKm.y, directKm.z - renderedKm.z) * 1000;

    const distanceKm = Math.hypot(directKm.x, directKm.y, directKm.z);
    const { drawPx } = computePointShading(PLACEHOLDER_RADIUS_KM, distanceKm, pixelsPerRadian, 1.5, 1, 0.05);

    rows.push({ norad: object.norad, renderedKm, directKm, deltaM, drawPx });
  }

  return rows;
}

export function useCrossCheck(objects: readonly ObjectMeta[], loop: SimulationLoopHandle): CrossCheckRow[] {
  const [crossCheck, setCrossCheck] = useState<CrossCheckRow[]>([]);

  useEffect(() => {
    // Display-only estimate (fixed 60deg FOV assumption) for the table's
    // "expected drawPx" column — the live shader (TierZeroPoints.tsx)
    // computes its own from the real camera every frame; this only needs
    // to be in the right ballpark for a human comparing the table against
    // the rendered image.
    const assumedFovRad = (60 * Math.PI) / 180;
    const assumedPixelsPerRadian = window.innerHeight / assumedFovRad;
    const interval = setInterval(() => {
      const frameState = loop.frameStateRef.current;
      // FrameState starts at epochMs 0 (createFrameState's initial value)
      // until the simulation loop's first rAF tick writes a real epoch.
      // Propagating any 2026-fitted element set to the Unix epoch is
      // legitimately outside SGP4's valid range and throws — skip this
      // poll rather than crash; the next one lands after the real tick.
      if (frameState.epochMs <= 0) return;
      setCrossCheck(buildCrossCheckRows(objects, frameState, assumedPixelsPerRadian));
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [objects, loop.frameStateRef]);

  return crossCheck;
}
