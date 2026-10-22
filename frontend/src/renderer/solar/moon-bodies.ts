// frontend/src/renderer/solar/moon-bodies.ts
import { BufferAttribute, BufferGeometry, Group, Mesh, Points, SphereGeometry, Vector3, type Camera } from 'three';
import { SUN_RADIUS_KM, visibleDiskFraction } from '@orcas/physics';
import type { PlanetEphemeris } from '../../data/planet-ephemeris.js';
import { MOON_SYSTEMS, moonSystem, requestMoonSystem, type MoonSystemId } from '../../data/moon-systems.js';
import { readColorToken } from '../scene-colors.js';
import { layerFade } from '../scale-fade.js';
import { taperLine } from '../live/line-taper.js';
import type { Occluder } from '../earth/body-label-layout.js';
import { meanRadiusKm, MOONS, moonSystemOf, SYSTEM_RADIUS_KM } from './moons.js';
import { PLANETS } from './planets.js';
import { horizonsGeocentricKm } from './system-centres.js';
import { createFatLine, writeOffsetPositions, writeSegments } from './orbit-line.js';
import { TRAIL_ALPHA, TRAIL_HOVER_WIDTH_PX, TRAIL_SAMPLES, TRAIL_WIDTH_PX, writeMoonTrail, writeTrailColours } from './moon-trails.js';
import { createPlanetDotMaterial, createPlanetMaterial } from './planet-materials.js';
import type { Viewport } from './planet-bodies.js';

const DOT_CSS_PX = 2;
/** Natural bodies' token (P4.D30): a moon is flat in it until S6b2 gives it a real map. */
const MOON_TOKEN = '--moon';
const MOON_FALLBACK = '#e6dcc6';
/** NASA's `DefaultVisibleFar` fades over half its size again (blur 0.5); ORCAS starts at its 20 px label rule. */
const OWN_TRAIL_FROM_PX = 20;
const OWN_TRAIL_TO_PX = 30;
const _toSun = new Vector3();
const _toPlanet = new Vector3();
const _offset = new Vector3();

const planetIndexOf = (system: MoonSystemId) => PLANETS.findIndex((p) => p.name.toLowerCase() === system);

/** How much of a moon system to draw: S4's rule for the satellites, the system's extent seen from its planet. */
export function moonSystemFade(system: MoonSystemId, cameraToPlanetKm: number): number {
  return layerFade(SYSTEM_RADIUS_KM[system], cameraToPlanetKm);
}

/** A moon's own trail goes as its disc grows from 20 to 30 px, as NASA hides a large body's trail and label. */
export function ownTrailFade(discPx: number): number {
  return Math.min(1, Math.max(0, (OWN_TRAIL_TO_PX - discPx) / (OWN_TRAIL_TO_PX - OWN_TRAIL_FROM_PX)));
}

/**
 * The fraction of the Sun's disc a moon sees past its planet: the conical model Tier 1 uses for the Earth
 * (`visibleDiskFraction`), the planet a sphere of its equatorial radius, which the moons cross near its equator.
 * Input: geocentric km. Output: 0 in the umbra, 1 in full Sun.
 */
export function moonSunlitFraction(moonKm: Vector3, planetKm: Vector3, planetRadiusKm: number, sunKm: Vector3): number {
  _toSun.copy(sunKm).sub(moonKm);
  _toPlanet.copy(planetKm).sub(moonKm);
  const planetDistKm = _toPlanet.length();
  if (planetDistKm <= planetRadiusKm) return 0;
  const a = Math.asin(Math.min(1, SUN_RADIUS_KM / _toSun.length()));
  const b = Math.asin(planetRadiusKm / planetDistKm);
  return visibleDiskFraction(a, b, _toSun.angleTo(_toPlanet));
}

export interface MoonBodies {
  readonly group: Group;
  /** In `MOONS` order: each moon's centre, geocentric km, valid where `drawn`. */
  readonly moonKm: readonly Vector3[];
  readonly drawn: readonly boolean[];
  /** Each moon's system fade, 0 when not drawn: its label's opacity. */
  readonly fade: readonly number[];
  /** Each moon's sphere, drawn or not, for its own label's `self`. */
  readonly occluderOf: readonly Occluder[];
  /** The drawn moons' spheres: they hide labels (NASA: only bodies do) and bound the near plane. */
  readonly occluders: readonly Occluder[];
  update(
    epochMs: number,
    planets: PlanetEphemeris | null,
    planetKm: readonly Vector3[] | null,
    sunKm: Vector3,
    camera: Camera,
    viewport: Viewport,
    hoveredId: string | null,
    selectedId: string | null,
  ): void;
  dispose(): void;
}

/**
 * S6b: the major moons. Each is a lit sphere of its mean radius in the `--moon` token, dimmed in its planet's
 * shadow; a 2 px dot when smaller; and NASA's trail, one orbit in its planet's hue, tapered. A system is drawn
 * by S4's fade rule from its planet, and its file is fetched when it fades in or one of its bodies is hovered
 * or selected. Everything reaches the GPU camera-relative (B.21).
 */
export function createMoonBodies(): MoonBodies {
  const group = new Group();
  const sphere = new SphereGeometry(1, 48, 24);
  const colour = readColorToken(MOON_TOKEN, MOON_FALLBACK);
  const moonKm = MOONS.map(() => new Vector3());
  const drawn = MOONS.map(() => false);
  const fade = MOONS.map(() => 0);
  const occluderOf: Occluder[] = MOONS.map((m, i) => ({ centreKm: moonKm[i] ?? new Vector3(), radiusKm: meanRadiusKm(m) }));
  const occluders: Occluder[] = [];
  const systemFade = new Map<MoonSystemId, number>();

  const meshes = MOONS.map(() => {
    const mesh = new Mesh(sphere, createPlanetMaterial(colour.clone()));
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  });
  const trails = MOONS.map((m) => {
    const planet = PLANETS[planetIndexOf(m.system)];
    const c = readColorToken(planet?.token ?? MOON_TOKEN, planet?.fallback ?? MOON_FALLBACK);
    const colours = new Float32Array(TRAIL_SAMPLES * 4);
    writeTrailColours({ r: c.r, g: c.g, b: c.b }, TRAIL_ALPHA, colours);
    const line = createFatLine(TRAIL_SAMPLES, colours, 1, TRAIL_WIDTH_PX);
    taperLine(line.material, line.geometry, TRAIL_SAMPLES);
    line.visible = false;
    group.add(line);
    return line;
  });
  const trailKm = new Float64Array(TRAIL_SAMPLES * 3);
  const linePoints = new Float32Array(TRAIL_SAMPLES * 3);

  const dotGeometry = new BufferGeometry();
  const dotPositions = new Float32Array(MOONS.length * 3);
  dotGeometry.setAttribute('position', new BufferAttribute(dotPositions, 3));
  const dotColours = new Float32Array(MOONS.length * 3);
  MOONS.forEach((_, i) => colour.toArray(dotColours, i * 3));
  dotGeometry.setAttribute('colour', new BufferAttribute(dotColours, 3));
  const dots = new Points(dotGeometry, createPlanetDotMaterial());
  dots.frustumCulled = false;
  group.add(dots);

  return {
    group,
    moonKm,
    drawn,
    fade,
    occluderOf,
    occluders,
    update(epochMs, planets, planetKm, sunKm, camera, viewport, hoveredId, selectedId) {
      const cam = camera.position;
      const pxPerRadian = (camera.projectionMatrix.elements[5] ?? 1) * 0.5 * viewport.cssHeight;
      const wanted = [moonSystemOf(hoveredId), moonSystemOf(selectedId)];
      for (const system of MOON_SYSTEMS) {
        const planetAt = planetKm?.[planetIndexOf(system)];
        const f = planetAt ? moonSystemFade(system, cam.distanceTo(planetAt)) : 0;
        if (f > 0 || wanted.includes(system)) requestMoonSystem(system);
        systemFade.set(system, moonSystem(system) ? f : 0);
      }
      occluders.length = 0;
      let dotCount = 0;
      dots.position.copy(cam);
      dots.material.uniforms.uDotPx.value = DOT_CSS_PX * viewport.dpr;
      MOONS.forEach((moon, i) => {
        const at = moonKm[i];
        const mesh = meshes[i];
        const trail = trails[i];
        const occluder = occluderOf[i];
        const planet = PLANETS[planetIndexOf(moon.system)];
        const planetAt = planetKm?.[planetIndexOf(moon.system)];
        // Hidden first, so an early return never leaves a moon drawn at a stale place (B.26).
        drawn[i] = false;
        fade[i] = 0;
        if (mesh) mesh.visible = false;
        if (trail) trail.visible = false;
        if (!at || !mesh || !trail || !occluder || !planet || !planetAt) return;
        const f = systemFade.get(moon.system) ?? 0;
        const placed = f > 0 && horizonsGeocentricKm(moon.system, moon.naifId, epochMs, planets, at) !== null;
        drawn[i] = placed;
        fade[i] = placed ? f : 0;
        mesh.visible = placed;
        trail.visible = false;
        if (!placed) return;
        occluders.push(occluder);

        const r = occluder.radiusKm;
        mesh.matrix.makeScale(r, r, r).setPosition(at);
        mesh.matrixWorldNeedsUpdate = true;
        const u = mesh.material.uniforms;
        u.uSunDir.value.copy(sunKm).sub(at).normalize();
        u.uSunlit.value = moonSunlitFraction(at, planetAt, planet.equatorialRadiusKm, sunKm);
        dotPositions[dotCount * 3] = at.x - cam.x;
        dotPositions[dotCount * 3 + 1] = at.y - cam.y;
        dotPositions[dotCount * 3 + 2] = at.z - cam.z;
        dotCount += 1;

        if (!writeMoonTrail(moon.system, moon.naifId, epochMs, planet.gmKm3S2, trailKm)) return;
        // The trail is centre-relative and ends at the moon now, so the centre is the moon less its last point.
        const last = (TRAIL_SAMPLES - 1) * 3;
        _offset.set(at.x - (trailKm[last] ?? 0) - cam.x, at.y - (trailKm[last + 1] ?? 0) - cam.y, at.z - (trailKm[last + 2] ?? 0) - cam.z);
        writeOffsetPositions(trailKm, TRAIL_SAMPLES, _offset, linePoints);
        writeSegments(trail.geometry, linePoints, TRAIL_SAMPLES);
        trail.position.copy(cam);
        const hovered = moon.id === hoveredId;
        const discPx = (r / Math.max(cam.distanceTo(at), r)) * pxPerRadian;
        trail.material.opacity = f * ownTrailFade(discPx) * (hovered ? 1 / TRAIL_ALPHA : 1); // hover: full opacity, NASA's
        trail.material.linewidth = hovered ? TRAIL_HOVER_WIDTH_PX : TRAIL_WIDTH_PX;
        trail.material.resolution.set(viewport.cssWidth * viewport.dpr, viewport.cssHeight * viewport.dpr);
        trail.visible = trail.material.opacity > 0;
      });
      dotGeometry.setDrawRange(0, dotCount);
      dotGeometry.getAttribute('position').needsUpdate = true;
    },
    dispose() {
      sphere.dispose();
      for (const mesh of meshes) mesh.material.dispose();
      for (const line of trails) {
        line.geometry.dispose();
        line.material.dispose();
      }
      dotGeometry.dispose();
      dots.material.dispose();
    },
  };
}
