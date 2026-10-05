import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { satrecFromOmm } from '@orcas/physics';
import type { Group } from 'three';
import type { Line2 } from 'three-stdlib';
import type { FrameState } from '../../simulation/frame-state.js';
import type { ObjectMeta } from '../../data/catalog-types.js';
import { useSelectionStore } from '../../state/selection-store.js';
import { readOrbitClassColor } from './path-orbit-class-tint.js';
import { readCyanToken } from '../scene-colors.js';
import { featuredIndices, FEATURED_OBJECT_IDS } from './featured-norads.js';
import { sampleOrbitPath, DEFAULT_PATH_SAMPLES } from './orbit-path.js';
import { writePathBuffers } from './path-geometry.js';
import {
  BOOTSTRAP_COLORS,
  BOOTSTRAP_POINTS,
  FEATURED_LINE_WIDTH_PX,
  SELECTION_LINE_WIDTH_PX,
  featuredLineWidthPx,
  makeSlot,
  type PathSlot,
} from './path-slot.js';
import { subtractCameraOffset } from '../camera-relative.js';
import { layerFade, SATELLITE_LAYER_RADIUS_KM } from '../scale-fade.js';
import { patchLineMaterial } from '../live/line-trim.js';

interface Props {
  readonly frameStateRef: MutableRefObject<FrameState>;
  readonly objects: readonly ObjectMeta[];
  readonly byNorad: Readonly<Record<string, number>>;
}

/** Brief §F.6: resample at 0.2 Hz — never per frame. Also resample when
 * the sim clock has jumped further than RESAMPLE_EPOCH_DRIFT_MS (a scrub,
 * or a fast rate outrunning the wall-clock cadence), so the span stays
 * centred on the object. */
const RESAMPLE_INTERVAL_MS = 5_000;
const RESAMPLE_EPOCH_DRIFT_MS = 60_000;

/**
 * Permanent orbit paths for the featured set, plus one for the current
 * selection (brief §I M1.7, §F.6). Each path is one fat line (drei
 * <Line> -> Line2), propagated through SGP4 in J2000, resampled at
 * 0.2 Hz. Featured lines are tinted by orbit class (P4.D24); the
 * selection line is --orca-cyan.
 *
 * Zero re-renders after mount — fixed JSX, every update an imperative
 * write into the Line2 geometry inside useFrame, exactly the shape of
 * Tier1Objects / TierZeroPoints. Selection arrives through a store
 * subscription into a ref.
 *
 * ponytail: one draw call per line (~15-20), well inside the §G budget
 * (Q9.3 raises it to 60). Batch into one LineSegments2 only if draw
 * calls bite at M1.8.
 *
 * Camera-relative (found live 2026-09-12: flickering points behind a
 * followed satellite, same class of bug Tier1Objects/Trails were fixed
 * for). `positions` holds the absolute km from the last resample (0.2 Hz
 * — real SGP4 work, deliberately throttled); every frame, cheaply copies
 * that into `cameraRelative`, subtracts the camera, and re-uploads —
 * 180 floats, not the expensive part. `line.position` tracks the camera
 * every frame this way, not just at resample time, so the anchor never
 * goes more than one frame stale even while a resample is 5 s away.
 * `computeLineDistances()` only needs to run once per resample: it reads
 * relative distances between consecutive points, which a uniform
 * per-frame translation never changes.
 */
export function OrbitPaths({ frameStateRef, objects, byNorad }: Props): React.ReactElement {
  const { camera } = useThree();

  const cyan = useMemo(() => {
    const c = readCyanToken();
    return { r: c.r, g: c.g, b: c.b };
  }, []);

  const featuredSlots = useMemo<PathSlot[]>(() => {
    const buf = new Uint32Array(FEATURED_OBJECT_IDS.size);
    const n = featuredIndices(objects, buf);
    const slots: PathSlot[] = [];
    for (let k = 0; k < n; k++) {
      const i = buf[k];
      const c = readOrbitClassColor(objects[i].orbitClass);
      slots.push(
        makeSlot(i, objects[i].norad, satrecFromOmm(objects[i].record), { r: c.r, g: c.g, b: c.b }),
      );
    }
    return slots;
  }, [objects]);

  const groupRef = useRef<Group>(null);
  const featuredLineRefs = useRef<(Line2 | null)[]>([]);
  const selectionLineRef = useRef<Line2 | null>(null);

  const selectedNoradRef = useRef<string | null>(null);
  const hoveredNoradRef = useRef<string | null>(null);
  useEffect(() => {
    const read = (s: { selectedNorad: string | null; hoveredNorad: string | null }) => {
      selectedNoradRef.current = s.selectedNorad;
      hoveredNoradRef.current = s.hoveredNorad;
    };
    read(useSelectionStore.getState());
    return useSelectionStore.subscribe(read);
  }, []);
  const selectedSlotRef = useRef<PathSlot | null>(null);

  function pushGeometry(line: Line2, slot: PathSlot): void {
    patchLineMaterial(line.material); // the reversed-depth near trim; a no-op after the first time
    line.geometry.setPositions(slot.positions);
    line.geometry.setColors(slot.colors, 4);
    line.geometry.instanceCount = DEFAULT_PATH_SAMPLES - 1;
    line.computeLineDistances();
    line.visible = true;
    slot.drawn = true;
  }

  function applyCameraRelative(line: Line2, slot: PathSlot, camX: number, camY: number, camZ: number): void {
    slot.cameraRelative.set(slot.positions);
    subtractCameraOffset(slot.cameraRelative, DEFAULT_PATH_SAMPLES, camX, camY, camZ);
    line.geometry.setPositions(slot.cameraRelative);
    line.position.set(camX, camY, camZ);
  }

  function resampleIfDue(slot: PathSlot, line: Line2 | null, wallMs: number, epochMs: number): void {
    if (!line) return;
    const due =
      !slot.drawn ||
      wallMs - slot.lastWallMs >= RESAMPLE_INTERVAL_MS ||
      Math.abs(epochMs - slot.lastEpochMs) >= RESAMPLE_EPOCH_DRIFT_MS;
    if (!due) return;
    try {
      sampleOrbitPath({
        satrec: slot.satrec,
        record: objects[slot.index].record,
        noradId: slot.noradId,
        atMs: epochMs,
        out: slot.sample,
      });
      writePathBuffers(slot.sample, DEFAULT_PATH_SAMPLES, slot.rgb, slot.positions, slot.colors);
      pushGeometry(line, slot);
      slot.lastWallMs = wallMs;
      slot.lastEpochMs = epochMs;
    } catch {
      // Decayed / unpropagatable — hide the line, keep the object's point.
      line.visible = false;
      slot.drawn = false;
    }
  }

  useFrame(() => {
    const wallMs = performance.now();
    const epochMs = frameStateRef.current.epochMs;
    if (epochMs <= 0) return; // the sim clock has not ticked yet
    // S4 (B.21): the paths fade with the satellites as the shell shrinks onto the Earth's pixel.
    const fade = layerFade(SATELLITE_LAYER_RADIUS_KM, camera.position.length());
    if (groupRef.current) groupRef.current.visible = fade > 0;
    if (fade === 0) return;
    const camX = camera.position.x;
    const camY = camera.position.y;
    const camZ = camera.position.z;

    for (let k = 0; k < featuredSlots.length; k++) {
      const slot = featuredSlots[k];
      const line = featuredLineRefs.current[k] ?? null;
      resampleIfDue(slot, line, wallMs, epochMs);
      if (!line || !slot.drawn) continue;
      applyCameraRelative(line, slot, camX, camY, camZ);
      // Hovering the object or its label thickens its path (S1, NASA Eyes).
      line.material.linewidth = featuredLineWidthPx(slot.noradId === hoveredNoradRef.current);
      line.material.opacity = fade;
    }

    const norad = selectedNoradRef.current;
    const line = selectionLineRef.current;
    if (norad === null) {
      selectedSlotRef.current = null;
      if (line) line.visible = false;
    } else if (selectedSlotRef.current?.noradId !== norad) {
      const i = byNorad[norad];
      selectedSlotRef.current =
        i === undefined ? null : makeSlot(i, norad, satrecFromOmm(objects[i].record), cyan);
      if (line) line.visible = false;
    }
    if (selectedSlotRef.current) {
      resampleIfDue(selectedSlotRef.current, line, wallMs, epochMs);
      if (line && selectedSlotRef.current.drawn) {
        applyCameraRelative(line, selectedSlotRef.current, camX, camY, camZ);
        line.material.opacity = fade;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {featuredSlots.map((slot, k) => (
        <Line
          key={slot.noradId}
          ref={(l) => {
            featuredLineRefs.current[k] = l as Line2 | null;
          }}
          points={BOOTSTRAP_POINTS}
          vertexColors={BOOTSTRAP_COLORS}
          lineWidth={FEATURED_LINE_WIDTH_PX}
        />
      ))}
      <Line
        ref={(l) => {
          selectionLineRef.current = l as Line2 | null;
        }}
        points={BOOTSTRAP_POINTS}
        vertexColors={BOOTSTRAP_COLORS}
        lineWidth={SELECTION_LINE_WIDTH_PX}
      />
    </group>
  );
}
