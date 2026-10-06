import { BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, Points, SphereGeometry, Vector3, type Camera } from 'three';
import type { InterleavedBufferAttribute, Texture } from 'three';
import { Line2, LineGeometry, LineMaterial } from 'three-stdlib';
import { iauBodyAxesJ2000, writeOsculatingEllipse } from '@orcas/physics';
import { bodyStateKm, type PlanetEphemeris } from '../../data/planet-ephemeris.js';
import { readColorToken } from '../scene-colors.js';
import type { Occluder } from '../earth/body-label-layout.js';
import { EARTH_NAIF_ID, PLANETS, SUN_NAIF_ID } from './planets.js';
import { ORBIT_LINE_HOVER_WIDTH_PX, ORBIT_LINE_WIDTH_PX, ORBIT_SAMPLES, writeOffsetPositions, writeOrbitColours } from './orbit-line.js';
import { createPlanetDotMaterial, createPlanetMaterial } from './planet-materials.js';
import { patchLineMaterial } from '../live/line-trim.js';
import { loadPlanetMap, PLANET_MAPS } from './planet-maps.js';
import { createSaturnRings, ringDistanceKm } from './saturn-rings.js';

/** NASA's planet orbit lines are drawn at 0.75 opacity (Reference §4.3). */
const ORBIT_OPACITY = 0.75;
const DOT_CSS_PX = 2;
/** A planet's map is fetched once its disc passes this radius, or once it is hovered or selected (S5b). */
const MAP_LOAD_PX = 1;
const SATURN_NAIF_ID = 6;
const _poleToZ = new Matrix4().makeRotationX(Math.PI / 2); // three's sphere has its pole on +Y
const _basis = new Matrix4();
const _x = new Vector3();
const _y = new Vector3();
const _z = new Vector3();

export interface Viewport {
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly dpr: number;
}

export interface PlanetBodies {
  readonly group: Group;
  /** The Sun's centre, geocentric km (ICRF ≈ J2000), as of the last `update`. */
  readonly sunKm: Vector3;
  /** Each planet's centre in `PLANETS` order, geocentric km; the Earth's is the origin. */
  readonly planetKm: readonly Vector3[];
  /** Every planet but the Earth, as spheres: what hides a label (S4) and bounds the near plane. */
  readonly occluders: readonly Occluder[];
  /** False before the ephemeris loads, or outside DE421's span: nothing above is current then. */
  readonly placed: boolean;
  /** The camera's distance from Saturn's rings as of the last `update`, km, for the near plane; Infinity unplaced. */
  readonly ringDistanceKm: number;
  /**
   * `hoveredIndex`, `selectedIndex`: the planet whose label is under the pointer and the one selected, in
   * `PLANETS` order, or −1.
   */
  update(
    epochMs: number,
    ephemeris: PlanetEphemeris | null,
    camera: Camera,
    viewport: Viewport,
    hoveredIndex?: number,
    selectedIndex?: number,
  ): void;
  dispose(): void;
}

/** Write a line's consecutive points into its existing segment buffer, rather than re-allocating it each frame. */
function writeSegments(geometry: LineGeometry, points: Float32Array, count: number): void {
  const data = (geometry.getAttribute('instanceStart') as InterleavedBufferAttribute).data;
  const segments = data.array as Float32Array;
  for (let i = 0; i < count - 1; i++) {
    segments.set(points.subarray(i * 3, i * 3 + 6), i * 6);
  }
  data.needsUpdate = true;
}

/**
 * S4: the Sun's place and the planets, from the DE421 bake (S3). Each planet is
 * an IAU ellipsoid turned to its IAU pole and prime meridian, lit from the Sun
 * and mapped once approached (S5b); a dot when it is smaller than one; and
 * NASA Eyes' orbit line: the osculating ellipse through its heliocentric state.
 * Saturn has its rings. Everything reaches the GPU camera-relative (B.21).
 */
export function createPlanetBodies(anisotropy = 1): PlanetBodies {
  const group = new Group();
  const sphere = new SphereGeometry(1, 64, 32);
  const sunKm = new Vector3();
  const planetKm = PLANETS.map(() => new Vector3());
  const occluders: Occluder[] = [];
  const textures: Texture[] = [];
  const mapRequested = PLANETS.map(() => false);
  const saturn = PLANETS.find((p) => p.naifId === SATURN_NAIF_ID);
  const rings = saturn ? createSaturnRings(saturn.equatorialRadiusKm, saturn.polarRadiusKm) : null;
  if (rings) group.add(rings.mesh);
  let ringDistance = Infinity;

  const meshes = PLANETS.map((planet, i) => {
    if (planet.naifId === EARTH_NAIF_ID) return null; // the Earth is drawn by EarthSunMoon
    const mesh = new Mesh(sphere, createPlanetMaterial(readColorToken(planet.token, planet.fallback)));
    mesh.matrixAutoUpdate = false;
    occluders.push({ centreKm: planetKm[i] ?? new Vector3(), radiusKm: planet.radiusKm });
    group.add(mesh);
    return mesh;
  });
  // The unit sphere (pole on +Y) to the IAU ellipsoid: equatorial radius in x and z, polar in y.
  const scales = PLANETS.map((p) => new Matrix4().makeScale(p.equatorialRadiusKm, p.polarRadiusKm, p.equatorialRadiusKm));

  /** Fetch a planet's map, and Saturn's rings with Saturn's, once. */
  function requestMap(i: number): void {
    const planet = PLANETS[i];
    const material = meshes[i]?.material;
    if (mapRequested[i] || !planet || !material) return;
    mapRequested[i] = true;
    const map = PLANET_MAPS[planet.name.toLowerCase()];
    if (map) {
      loadPlanetMap(map.url, anisotropy, (texture) => {
        textures.push(texture);
        material.uniforms.uMap.value = texture;
        material.uniforms.uHasMap.value = 1;
      });
    }
    if (planet.naifId === SATURN_NAIF_ID && rings) {
      rings.load(anisotropy, (transmission) => {
        material.uniforms.uRingTransmission.value = transmission;
        material.uniforms.uRingKm.value.copy(rings.mesh.material.uniforms.uRingKm.value);
        material.uniforms.uHasRings.value = 1;
      });
    }
  }

  const ellipse = new Float64Array(ORBIT_SAMPLES * 3);
  const linePoints = new Float32Array(ORBIT_SAMPLES * 3);
  const lines = PLANETS.map((planet) => {
    const geometry = new LineGeometry();
    geometry.setPositions(linePoints); // sizes the segment buffer once
    const colours = new Float32Array(ORBIT_SAMPLES * 4);
    const c = readColorToken(planet.token, planet.fallback);
    writeOrbitColours({ r: c.r, g: c.g, b: c.b }, colours);
    geometry.setColors(colours, 4);
    const material = new LineMaterial({
      vertexColors: true,
      transparent: true,
      opacity: ORBIT_OPACITY,
      linewidth: ORBIT_LINE_WIDTH_PX,
      depthWrite: false, // depth-tested, so a body hides the far side; never hides another line (Reference §4.3)
    });
    patchLineMaterial(material);
    const line = new Line2(geometry, material);
    line.frustumCulled = false; // the segment buffer is rewritten every frame
    group.add(line);
    return line;
  });

  const dotGeometry = new BufferGeometry();
  const dotPositions = new Float32Array(PLANETS.length * 3);
  dotGeometry.setAttribute('position', new BufferAttribute(dotPositions, 3));
  const dotColours = new Float32Array(PLANETS.length * 3);
  PLANETS.forEach((planet, i) => readColorToken(planet.token, planet.fallback).toArray(dotColours, i * 3));
  dotGeometry.setAttribute('colour', new BufferAttribute(dotColours, 3));
  const dots = new Points(dotGeometry, createPlanetDotMaterial());
  dots.frustumCulled = false;
  group.add(dots);

  const offset = new Vector3();
  let placed = false;

  return {
    group,
    sunKm,
    planetKm,
    occluders,
    get placed() {
      return placed;
    },
    get ringDistanceKm() {
      return ringDistance;
    },
    update(epochMs, ephemeris, camera, viewport, hoveredIndex = -1, selectedIndex = -1) {
      const earth = ephemeris && bodyStateKm(ephemeris, EARTH_NAIF_ID, epochMs);
      const sun = ephemeris && bodyStateKm(ephemeris, SUN_NAIF_ID, epochMs);
      placed = Boolean(earth && sun);
      group.visible = placed;
      ringDistance = Infinity;
      if (!ephemeris || !earth || !sun) return;

      const when = new Date(epochMs);
      const pxPerRadian = (camera.projectionMatrix.elements[5] ?? 1) * 0.5 * viewport.cssHeight; // [5] = 1 / tan(fov / 2)
      const cam = camera.position;
      sunKm.set(sun.position.x - earth.position.x, sun.position.y - earth.position.y, sun.position.z - earth.position.z);
      offset.copy(sunKm).sub(cam); // Sun − camera: the orbit lines' camera-relative origin
      dots.position.copy(cam);
      dots.material.uniforms.uDotPx.value = DOT_CSS_PX * viewport.dpr;

      PLANETS.forEach((planet, i) => {
        const state = planet.naifId === EARTH_NAIF_ID ? earth : bodyStateKm(ephemeris, planet.naifId, epochMs);
        const at = planetKm[i];
        const line = lines[i];
        if (!state || !at || !line) return; // every body shares the Earth's span
        at.set(state.position.x - earth.position.x, state.position.y - earth.position.y, state.position.z - earth.position.z);
        dotPositions[i * 3] = at.x - cam.x;
        dotPositions[i * 3 + 1] = at.y - cam.y;
        dotPositions[i * 3 + 2] = at.z - cam.z;

        const mesh = meshes[i];
        if (mesh) {
          const axes = iauBodyAxesJ2000(planet.bodyNaifId, when);
          if (axes) _basis.makeBasis(_x.copy(axes.x), _y.copy(axes.y), _z.copy(axes.z));
          else _basis.identity();
          const u = mesh.material.uniforms;
          u.uSunDir.value.copy(sunKm).sub(at).normalize();
          u.uPole.value.set(0, 0, 1).transformDirection(_basis);
          _basis.setPosition(at);
          if (planet.naifId === SATURN_NAIF_ID && rings) {
            rings.update(_basis, at, u.uSunDir.value, u.uPole.value, cam);
            ringDistance = ringDistanceKm(cam, at, u.uPole.value);
          }
          mesh.matrix.copy(_basis).multiply(_poleToZ).multiply(scales[i] ?? _poleToZ);
          mesh.matrixWorldNeedsUpdate = true;
          const discPx = (planet.equatorialRadiusKm / cam.distanceTo(at)) * pxPerRadian;
          if (discPx > MAP_LOAD_PX || i === hoveredIndex || i === selectedIndex) requestMap(i);
        }

        const r = { x: state.position.x - sun.position.x, y: state.position.y - sun.position.y, z: state.position.z - sun.position.z };
        const v = { x: state.velocity.x - sun.velocity.x, y: state.velocity.y - sun.velocity.y, z: state.velocity.z - sun.velocity.z };
        line.visible = writeOsculatingEllipse(r, v, planet.muKm3S2, ORBIT_SAMPLES, ellipse);
        if (!line.visible) return;
        writeOffsetPositions(ellipse, ORBIT_SAMPLES, offset, linePoints);
        writeSegments(line.geometry, linePoints, ORBIT_SAMPLES);
        line.position.copy(cam);
        line.material.resolution.set(viewport.cssWidth * viewport.dpr, viewport.cssHeight * viewport.dpr);
        const hovered = i === hoveredIndex;
        line.material.linewidth = hovered ? ORBIT_LINE_HOVER_WIDTH_PX : ORBIT_LINE_WIDTH_PX;
        line.material.opacity = hovered ? 1 : ORBIT_OPACITY;
      });
      dotGeometry.getAttribute('position').needsUpdate = true;
    },
    dispose() {
      sphere.dispose();
      rings?.dispose();
      for (const texture of textures) texture.dispose();
      for (const mesh of meshes) mesh?.material.dispose();
      for (const line of lines) {
        line.geometry.dispose();
        line.material.dispose();
      }
      dotGeometry.dispose();
      dots.material.dispose();
    },
  };
}
