// frontend/src/renderer/solar/moon-bodies.ts
import { BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, Points, SphereGeometry, Vector3, type Camera, type Texture } from 'three';
import { iauBodyAxesJ2000, SUN_RADIUS_KM, visibleDiskFraction } from '@orcas/physics';
import type { PlanetEphemeris } from '../../data/planet-ephemeris.js';
import { MOON_SYSTEMS, moonSystem, requestMoonSystem, type MoonSystemId } from '../../data/moon-systems.js';
import { readColorToken } from '../scene-colors.js';
import { layerFade } from '../scale-fade.js';
import { taperLine } from '../live/line-taper.js';
import type { Occluder } from '../earth/body-label-layout.js';
import { MOONS, moonSystemOf, SYSTEM_RADIUS_KM } from './moons.js';
import { MOON_MAPS } from './moon-maps.js';
import { loadPlanetMap } from './planet-maps.js';
import { PLANETS } from './planets.js';
import { horizonsGeocentricKm } from './system-centres.js';
import { createFatLine, writeOffsetPositions, writeSegments } from './orbit-line.js';
import { TRAIL_ALPHA, TRAIL_HOVER_WIDTH_PX, TRAIL_SAMPLES, TRAIL_WIDTH_PX, writeMoonTrail, writeTrailColours } from './moon-trails.js';
import { createPlanetDotMaterial, createPlanetMaterial } from './planet-materials.js';
import type { Viewport } from './planet-bodies.js';

const DOT_CSS_PX = 2;
/** Natural bodies' token (P4.D30): a moon is flat in it until its map loads, and Deimos always (S6b2). */
const MOON_TOKEN = '--moon';
const MOON_FALLBACK = '#e6dcc6';
/** Titan's haze, measured from Cassini's natural-colour PIA06230 by scripts/data/bake_moon_textures.py (B.29). */
const TITAN_TOKEN = '--titan';
const TITAN_FALLBACK = '#c09d3c';
/** As the planets: a map is fetched once a moon covers a pixel, or is hovered or selected. */
const MAP_LOAD_PX = 1;
const _poleToZ = new Matrix4().makeRotationX(Math.PI / 2); // three's sphere has its pole on +Y
const _basis = new Matrix4();
const _x = new Vector3();
const _y = new Vector3();
const _z = new Vector3();
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
 * S6b: the major moons. Each is its IAU ellipsoid turned by its IAU pole and prime meridian, lit and dimmed in
 * its planet's shadow, with its real map once approached (S6b2) and flat until then; a 2 px dot when smaller;
 * and NASA's trail, one orbit in its planet's hue, tapered. A system is drawn by S4's fade rule from its planet,
 * and its file is fetched when it fades in or one of its bodies is hovered or selected. Everything reaches the
 * GPU camera-relative (B.21). `loadMap` is injected so tests can see the map requests.
 */
export function createMoonBodies(anisotropy = 1, loadMap: typeof loadPlanetMap = loadPlanetMap): MoonBodies {
  const group = new Group();
  const sphere = new SphereGeometry(1, 48, 24);
  const colour = readColorToken(MOON_TOKEN, MOON_FALLBACK);
  const moonKm = MOONS.map(() => new Vector3());
  const drawn = MOONS.map(() => false);
  const fade = MOONS.map(() => 0);
  // The largest radius, so a label or the near plane never cuts the long axis (S6b2).
  const occluderOf: Occluder[] = MOONS.map((m, i) => ({ centreKm: moonKm[i] ?? new Vector3(), radiusKm: m.radiiKm[0] }));
  const occluders: Occluder[] = [];
  const systemFade = new Map<MoonSystemId, number>();
  const textures: Texture[] = [];
  const mapRequested = MOONS.map(() => false);

  const meshes = MOONS.map((m) => {
    const flat = m.id === 'titan' ? readColorToken(TITAN_TOKEN, TITAN_FALLBACK) : colour.clone();
    const mesh = new Mesh(sphere, createPlanetMaterial(flat));
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  });
  // The unit sphere to the IAU ellipsoid: a along its x (to body x), c along its pole (to body z), b along its z.
  const scales = MOONS.map((m) => new Matrix4().makeScale(m.radiiKm[0], m.radiiKm[2], m.radiiKm[1]));

  function requestMap(i: number): void {
    const moon = MOONS[i];
    const material = meshes[i]?.material;
    const map = moon && MOON_MAPS[moon.id];
    if (mapRequested[i] || !map || !material) return;
    mapRequested[i] = true;
    loadMap(map.url, anisotropy, (texture) => {
      textures.push(texture);
      material.uniforms.uMap.value = texture;
      material.uniforms.uHasMap.value = 1;
    });
  }
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
  meshes.forEach((mesh, i) => mesh.material.uniforms.uColour.value.toArray(dotColours, i * 3)); // Titan's: its haze
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
      const when = new Date(epochMs);
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
        const scale = scales[i];
        // Hidden first, so an early return never leaves a moon drawn at a stale place (B.26).
        drawn[i] = false;
        fade[i] = 0;
        if (mesh) mesh.visible = false;
        if (trail) trail.visible = false;
        if (!at || !mesh || !trail || !occluder || !planet || !planetAt || !scale) return;
        const f = systemFade.get(moon.system) ?? 0;
        const placed = f > 0 && horizonsGeocentricKm(moon.system, moon.naifId, epochMs, planets, at) !== null;
        drawn[i] = placed;
        fade[i] = placed ? f : 0;
        mesh.visible = placed;
        trail.visible = false;
        if (!placed) return;
        occluders.push(occluder);

        const r = occluder.radiusKm;
        const axes = iauBodyAxesJ2000(moon.naifId, when);
        if (axes) _basis.makeBasis(_x.copy(axes.x), _y.copy(axes.y), _z.copy(axes.z));
        else _basis.identity();
        mesh.matrix.copy(_basis.setPosition(at)).multiply(_poleToZ).multiply(scale);
        mesh.matrixWorldNeedsUpdate = true;
        const discPx = (r / Math.max(cam.distanceTo(at), r)) * pxPerRadian;
        if (discPx > MAP_LOAD_PX || moon.id === hoveredId || moon.id === selectedId) requestMap(i);
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
      for (const texture of textures) texture.dispose();
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
