import { BufferAttribute, BufferGeometry, Group, Mesh, Points, SphereGeometry, Vector3, type Camera } from 'three';
import type { InterleavedBufferAttribute } from 'three';
import { Line2, LineGeometry, LineMaterial } from 'three-stdlib';
import { writeOsculatingEllipse } from '@orcas/physics';
import { bodyStateKm, type PlanetEphemeris } from '../../data/planet-ephemeris.js';
import { readColorToken } from '../scene-colors.js';
import type { Occluder } from '../earth/body-label-layout.js';
import { EARTH_NAIF_ID, PLANETS, SUN_NAIF_ID } from './planets.js';
import { ORBIT_LINE_HOVER_WIDTH_PX, ORBIT_LINE_WIDTH_PX, ORBIT_SAMPLES, writeOffsetPositions, writeOrbitColours } from './orbit-line.js';
import { createPlanetDotMaterial, createPlanetMaterial } from './planet-materials.js';
import { patchLineMaterial } from '../live/line-trim.js';

/** NASA's planet orbit lines are drawn at 0.75 opacity (Reference §4.3). */
const ORBIT_OPACITY = 0.75;
const DOT_CSS_PX = 2;

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
  /** `hoveredIndex`: the planet whose label is under the pointer, in `PLANETS` order, or −1. */
  update(epochMs: number, ephemeris: PlanetEphemeris | null, camera: Camera, viewport: Viewport, hoveredIndex?: number): void;
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
 * a true-size sphere lit from the Sun, a dot when it is smaller than one, and
 * NASA Eyes' orbit line: the osculating ellipse through its heliocentric state.
 * Everything reaches the GPU camera-relative (B.21).
 */
export function createPlanetBodies(): PlanetBodies {
  const group = new Group();
  const sphere = new SphereGeometry(1, 48, 24);
  const sunKm = new Vector3();
  const planetKm = PLANETS.map(() => new Vector3());
  const occluders: Occluder[] = [];

  const meshes = PLANETS.map((planet, i) => {
    if (planet.naifId === EARTH_NAIF_ID) return null; // the Earth is drawn by EarthSunMoon
    const mesh = new Mesh(sphere, createPlanetMaterial(readColorToken(planet.token, planet.fallback)));
    mesh.scale.setScalar(planet.radiusKm);
    occluders.push({ centreKm: planetKm[i] ?? new Vector3(), radiusKm: planet.radiusKm });
    group.add(mesh);
    return mesh;
  });

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
    update(epochMs, ephemeris, camera, viewport, hoveredIndex = -1) {
      const earth = ephemeris && bodyStateKm(ephemeris, EARTH_NAIF_ID, epochMs);
      const sun = ephemeris && bodyStateKm(ephemeris, SUN_NAIF_ID, epochMs);
      placed = Boolean(earth && sun);
      group.visible = placed;
      if (!ephemeris || !earth || !sun) return;

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
          mesh.position.copy(at);
          mesh.material.uniforms.uSunDir.value.copy(sunKm).sub(at).normalize();
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
