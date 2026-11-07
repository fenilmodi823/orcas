// frontend/src/renderer/solar/spacecraft-bodies.ts
import { BufferAttribute, BufferGeometry, Group, Points, Vector3, type Camera } from 'three';
import type { Line2 } from 'three-stdlib';
import type { PlanetEphemeris } from '../../data/planet-ephemeris.js';
import { flownBoundary, jumpSpans, type HorizonsManifest } from '../../data/horizons-manifest.js';
import type { Span } from '../../data/horizons-index.js';
import { loadHorizonsManifest, horizonsManifestNow } from '../../data/use-horizons-manifest.js';
import { moonSystem, requestMoonSystem } from '../../data/moon-systems.js';
import { readColorToken } from '../scene-colors.js';
import { layerFade } from '../scale-fade.js';
import { taperLine } from '../live/line-taper.js';
import { createFatLine } from './orbit-line.js';
import { createPlanetDotMaterial } from './planet-materials.js';
import type { Viewport } from './planet-bodies.js';
import { writeSegmentAlpha } from './segment-alpha.js';
import { SPACECRAFT } from './spacecraft.js';
import { MISSION_PATH_MAX_POINTS, writeMissionPath } from './spacecraft-path.js';
import { createPathLine, writeOffsetSegments } from './spacecraft-path-line.js';
import { SPACECRAFT_TRAIL_SAMPLES, writeSpacecraftTrail } from './spacecraft-trail.js';
import { createCentreCache, createTrailCache, needsResample } from './spacecraft-trail-cache.js';
import { horizonsRelativeState } from './system-centres.js';

/** Fetch the data (decision 2) only past this distance from the origin, km, or for a spacecraft hovered or selected. */
export const SPACECRAFT_LOAD_DISTANCE_KM = 2e6;
const TOKEN = '--spacecraft';
const FALLBACK = '#d6dde8';
const DOT_CSS_PX = 2;
const TRAIL_ALPHA = 0.7;
const TRAIL_WIDTH_PX = 2;
const TRAIL_HOVER_WIDTH_PX = 4;
const LAST = SPACECRAFT_TRAIL_SAMPLES - 1;
const baseAlpha = (i: number): number => (TRAIL_ALPHA * i) / LAST;

export interface SpacecraftDeps {
  request?: (id: 'spacecraft') => void;
  loadManifest?: () => Promise<unknown>;
  manifestNow?: () => HorizonsManifest | null | undefined;
}

export interface SpacecraftBodies {
  readonly group: Group;
  /** In `SPACECRAFT` order: each one's place, geocentric km, valid where `drawn`. */
  readonly scKm: readonly Vector3[];
  readonly drawn: readonly boolean[];
  readonly trails: readonly Line2[];
  /** The selected spacecraft's whole path (visible only while one is selected and has data). */
  readonly path: Line2;
  /** `${naifId}:${centre}` of the path now built, or null. */
  selectedPathKey(): string | null;
  update(
    epochMs: number,
    planets: PlanetEphemeris | null,
    camera: Camera,
    viewport: Viewport,
    hoveredId: string | null,
    selectedId: string | null,
  ): void;
  dispose(): void;
}

/**
 * S6c1: the spacecraft beyond Earth orbit as 2 px dots, each with its trail (flown solid, predicted dashed, breaks
 * hidden) and, for the selected one, its whole path in the frame it is in now. Everything reaches the GPU
 * camera-relative (B.21). Without the manifest (loading or failed) the dots draw and the trails do not: without
 * the flown date and the jumps a trail could show a predicted path as flown. Fetching is lazy and injected.
 */
export function createSpacecraftBodies(deps: SpacecraftDeps = {}): SpacecraftBodies {
  const request = deps.request ?? requestMoonSystem;
  const loadManifest = deps.loadManifest ?? loadHorizonsManifest;
  const manifestNow = deps.manifestNow ?? horizonsManifestNow;
  const group = new Group();
  const colour = readColorToken(TOKEN, FALLBACK);
  const scKm = SPACECRAFT.map(() => new Vector3());
  const drawn = SPACECRAFT.map(() => false);

  const colours = new Float32Array(SPACECRAFT_TRAIL_SAMPLES * 4);
  for (let i = 0; i < SPACECRAFT_TRAIL_SAMPLES; i++) colours.set([colour.r, colour.g, colour.b, 1], i * 4);
  const trails = SPACECRAFT.map(() => {
    const line = createFatLine(SPACECRAFT_TRAIL_SAMPLES, colours, 1, TRAIL_WIDTH_PX);
    taperLine(line.material, line.geometry, SPACECRAFT_TRAIL_SAMPLES);
    line.visible = false;
    group.add(line);
    return line;
  });
  const caches = SPACECRAFT.map(createTrailCache);
  const centres = createCentreCache();
  const rel6 = new Float64Array(6); // the craft's state relative to its centre, km and km/s
  const lengthOut = new Float64Array(1); // the trail length a resample used, s
  const pathKm = new Float64Array(MISSION_PATH_MAX_POINTS * 3);
  const pathKinds = new Uint8Array(MISSION_PATH_MAX_POINTS - 1);
  const pathLine = createPathLine(colour, TRAIL_WIDTH_PX);
  group.add(pathLine.line);
  let pathNaif = NaN;
  let pathCentre = NaN;
  let pathKey: string | null = null; // built only when the pair changes
  let pathCount = 0;

  const dotGeometry = new BufferGeometry();
  const dotPositions = new Float32Array(SPACECRAFT.length * 3);
  dotGeometry.setAttribute('position', new BufferAttribute(dotPositions, 3));
  const dotColours = new Float32Array(SPACECRAFT.length * 3);
  for (let i = 0; i < SPACECRAFT.length; i++) colour.toArray(dotColours, i * 3);
  dotGeometry.setAttribute('colour', new BufferAttribute(dotColours, 3));
  const dots = new Points(dotGeometry, createPlanetDotMaterial());
  dots.frustumCulled = false;
  group.add(dots);

  // The flown date and jumps per spacecraft, read from the manifest once.
  let cachedFor: HorizonsManifest | null = null;
  const flownOf = SPACECRAFT.map(() => 0);
  const jumpsOf: Span[][] = SPACECRAFT.map(() => []);
  const _centre = new Vector3();
  const _offset = new Vector3();

  return {
    group,
    scKm,
    drawn,
    trails,
    path: pathLine.line,
    selectedPathKey: () => pathKey,
    update(epochMs, planets, camera, viewport, hoveredId, selectedId) {
      // Hidden first, so an early return never leaves a stale dot or line (B.26).
      for (let i = 0; i < SPACECRAFT.length; i++) {
        drawn[i] = false;
        const trail = trails[i];
        if (trail) trail.visible = false;
      }
      pathLine.line.visible = false;
      dotGeometry.setDrawRange(0, 0);
      const cam = camera.position;
      let hovered = -1;
      let selected = -1;
      for (let i = 0; i < SPACECRAFT.length; i++) {
        if (SPACECRAFT[i]?.id === hoveredId) hovered = i;
        if (SPACECRAFT[i]?.id === selectedId) selected = i;
      }
      if (cam.length() > SPACECRAFT_LOAD_DISTANCE_KM || hovered >= 0 || selected >= 0) {
        request('spacecraft');
        void loadManifest();
      }
      const index = moonSystem('spacecraft');
      if (!index) return;
      const manifest = manifestNow() ?? null; // still loading and failed alike: no trail, no path
      if (manifest && manifest !== cachedFor) {
        cachedFor = manifest;
        SPACECRAFT.forEach((s, i) => {
          flownOf[i] = flownBoundary(manifest, s.naifId).utcMs;
          jumpsOf[i] = jumpSpans(manifest, s.naifId);
        });
      }
      centres.reset();
      dots.position.copy(cam);
      dots.material.uniforms.uDotPx.value = DOT_CSS_PX * viewport.dpr;
      let dotCount = 0;
      for (let i = 0; i < SPACECRAFT.length; i++) {
        const sc = SPACECRAFT[i];
        const at = scKm[i];
        const trail = trails[i];
        if (!sc || !at || !trail) continue;
        const centre = horizonsRelativeState('spacecraft', sc.naifId, epochMs, rel6);
        const centreAt = centre === null ? null : centres.get(centre, epochMs, planets);
        if (centre === null || !centreAt) continue;
        at.set(centreAt.x + (rel6[0] ?? NaN), centreAt.y + (rel6[1] ?? NaN), centreAt.z + (rel6[2] ?? NaN));
        drawn[i] = true;
        dotPositions[dotCount * 3] = at.x - cam.x;
        dotPositions[dotCount * 3 + 1] = at.y - cam.y;
        dotPositions[dotCount * 3 + 2] = at.z - cam.z;
        dotCount += 1;
        if (!manifest) continue;

        const cache = caches[i];
        if (!cache) continue;
        const { trailKm, kinds } = cache;
        if (needsResample(cache, centre, manifest, epochMs)) {
          if (writeSpacecraftTrail(index, sc.naifId, epochMs, flownOf[i] ?? 0, jumpsOf[i] ?? [], trailKm, kinds, lengthOut) === null) continue;
          cache.valid = true;
          cache.epochMs = epochMs;
          cache.centre = centre;
          cache.manifest = manifest;
          cache.lengthS = lengthOut[0] ?? 0;
          let extentKm = 0;
          for (let k = 0; k < SPACECRAFT_TRAIL_SAMPLES; k++) {
            extentKm = Math.max(extentKm, Math.hypot(trailKm[k * 3] ?? 0, trailKm[k * 3 + 1] ?? 0, trailKm[k * 3 + 2] ?? 0));
          }
          cache.extentKm = extentKm;
          writeSegmentAlpha(trail.geometry, kinds, SPACECRAFT_TRAIL_SAMPLES, baseAlpha); // kinds and base alpha only: not hover
        } else {
          trailKm.set(rel6.subarray(0, 3), LAST * 3); // the end follows the spacecraft; the other 180 points stay
        }
        _centre.copy(centreAt);
        const fade = centre === 0 ? 1 : layerFade(cache.extentKm, cam.distanceTo(_centre));
        const isHovered = i === hovered;
        trail.material.opacity = fade * (isHovered ? 1 / TRAIL_ALPHA : 1); // hover: full opacity, NASA's
        trail.material.linewidth = isHovered ? TRAIL_HOVER_WIDTH_PX : TRAIL_WIDTH_PX;
        trail.material.resolution.set(viewport.cssWidth * viewport.dpr, viewport.cssHeight * viewport.dpr);
        _offset.copy(_centre).sub(cam);
        writeOffsetSegments(trail.geometry, trailKm, SPACECRAFT_TRAIL_SAMPLES, _offset);
        trail.position.copy(cam);
        trail.visible = trail.material.opacity > 0;

        if (i !== selected) continue;
        if (sc.naifId !== pathNaif || centre !== pathCentre) {
          pathNaif = sc.naifId;
          pathCentre = centre;
          pathKey = `${sc.naifId}:${centre}`;
          pathCount = writeMissionPath(index, sc.naifId, centre, flownOf[i] ?? 0, jumpsOf[i] ?? [], pathKm, pathKinds);
          if (pathCount >= 2) pathLine.rebuild(pathKinds, pathCount, pathKm);
        }
        if (pathCount < 2) continue;
        // Perspective: projectionMatrix[5] is 1 / tan(fov / 2). Measured at the nearer of the craft and the centre: in
        // cruise the centre is the barycentre, so beside Voyager 1 its 172 AU would make 1,500 px dashes.
        const nearKm = Math.min(_offset.length(), cam.distanceTo(at));
        const pxPerKm = ((camera.projectionMatrix.elements[5] ?? 1) * viewport.cssHeight) / 2 / Math.max(nearKm, 1);
        pathLine.place(pathKm, pathCount, _offset, cam, pxPerKm);
        pathLine.line.material.resolution.copy(trail.material.resolution);
        pathLine.line.visible = true;
      }
      dotGeometry.setDrawRange(0, dotCount);
      dotGeometry.getAttribute('position').needsUpdate = true;
    },
    dispose() {
      for (const line of [...trails, pathLine.line]) {
        line.geometry.dispose();
        line.material.dispose();
      }
      dotGeometry.dispose();
      dots.material.dispose();
    },
  };
}
