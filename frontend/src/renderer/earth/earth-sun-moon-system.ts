import { DirectionalLight, Group, Matrix4, Mesh, SphereGeometry, Vector3, type Camera } from 'three';
import { MOON_RADIUS_KM, moonPositionJ2000Km, WGS84_A_KM } from '@orcas/physics';
import { readColorToken } from '../scene-colors.js';
import { earthOrientationMatrix } from './earth-orientation.js';
import {
  ATMOSPHERE_HEIGHT_KM,
  createAtmosphereMaterial,
  createMoonMaterial,
  createSurfaceMaterial,
  loadSceneTextures,
} from './earth-materials.js';
import { createSunSprite, sunSpriteSize } from './sun-sprite.js';
import { createFatLine, ORBIT_SAMPLES, writeOffsetPositions, writeOrbitColours, writeSegments } from '../solar/orbit-line.js';
import { MOON_ORBIT_HOVER_WIDTH_PX, MOON_ORBIT_OPACITY, MOON_ORBIT_WIDTH_PX, writeMoonOrbit } from './moon-orbit.js';
import { layerFade, MOON_LAYER_RADIUS_KM, SATELLITE_LAYER_RADIUS_KM } from '../scale-fade.js';

const _poleToZ = new Matrix4().makeRotationX(Math.PI / 2);
const _moonScale = new Matrix4().makeScale(MOON_RADIUS_KM, MOON_RADIUS_KM, MOON_RADIUS_KM);
const _north = new Vector3(0, 0, 1);
const _toEarth = new Vector3();
const _east = new Vector3();
const _up = new Vector3();

/**
 * The Moon's body frame: tidally locked, so lunar longitude 0 (the texture's
 * centre) faces Earth; north is the scene pole projected perpendicular to
 * that. Libration (±8°) is not modelled. Output: `out`, km, J2000.
 */
export function moonMatrix(positionKm: Vector3, out: Matrix4): Matrix4 {
  _toEarth.copy(positionKm).negate().normalize();
  _up.copy(_north).addScaledVector(_toEarth, -_north.dot(_toEarth)).normalize();
  _east.crossVectors(_up, _toEarth);
  out.makeBasis(_toEarth, _east, _up).setPosition(positionKm);
  return out.multiply(_poleToZ).multiply(_moonScale);
}

export interface Viewport {
  readonly cssWidth: number;
  readonly cssHeight: number;
  /** Device pixels per CSS pixel. */
  readonly dpr: number;
}

export interface EarthSunMoonSystem {
  readonly group: Group;
  /** The Moon's centre as of the last `update`: km, J2000. */
  readonly moonKm: Vector3;
  /**
   * Advance everything to `epochMs` (the SIMULATION clock). Call after the
   * camera is final. `sunKm` is the Sun's true geocentric position (km): it
   * places the Sun's disc and lights the Earth and the Moon.
   */
  update(epochMs: number, camera: Camera, fovDeg: number, viewport: Viewport, sunKm: Vector3, moonHovered?: boolean): void;
  loadTextures(anisotropy: number): void;
  dispose(): void;
}

/**
 * M1.10 + M1.11: the Earth (terminator, night lights, clouds, atmosphere),
 * the Sun and the Moon, as plain three.js objects plus one update. Every
 * position is a pure function of the epoch, so scrubbing and reverse move
 * the terminator, the Sun and the Moon's phase with the satellites and
 * nothing accumulates (Live-Sun-Moon §4).
 */
export function createEarthSunMoon(): EarthSunMoonSystem {
  const surface = createSurfaceMaterial();
  const atmosphereMaterial = createAtmosphereMaterial();
  const moonMaterial = createMoonMaterial();

  const earth = new Mesh(new SphereGeometry(1, 128, 64), surface);
  earth.matrixAutoUpdate = false;
  const atmosphere = new Mesh(new SphereGeometry(WGS84_A_KM + ATMOSPHERE_HEIGHT_KM + 1, 96, 48), atmosphereMaterial);
  atmosphere.renderOrder = 1; // after the opaque Earth (brief §F.2)
  const moon = new Mesh(new SphereGeometry(1, 64, 32), moonMaterial);
  moon.matrixAutoUpdate = false;
  const sun = createSunSprite();
  const light = new DirectionalLight(undefined, 2.2);

  // NASA's Moon: the planets' orbit line, brightest at the Moon and fading to the far side (S6b, decision 15).
  const moonRgb = readColorToken('--moon', '#e6dcc6');
  const orbitColours = new Float32Array(ORBIT_SAMPLES * 4);
  writeOrbitColours({ r: moonRgb.r, g: moonRgb.g, b: moonRgb.b }, orbitColours);
  const orbit = createFatLine(ORBIT_SAMPLES, orbitColours, MOON_ORBIT_OPACITY, MOON_ORBIT_WIDTH_PX);
  orbit.visible = false;
  const orbitKm = new Float64Array(ORBIT_SAMPLES * 3);
  const orbitPoints = new Float32Array(ORBIT_SAMPLES * 3);
  const minusCamera = new Vector3();

  const group = new Group();
  group.add(light, sun, earth, atmosphere, moon, orbit);

  const sunDir = new Vector3();
  const moonPosition = new Vector3();
  let disposeTextures = () => {};

  return {
    group,
    moonKm: moonPosition,
    loadTextures(anisotropy) {
      disposeTextures = loadSceneTextures(surface, moonMaterial, anisotropy);
    },
    update(epochMs, camera, fovDeg, viewport, sunKm, moonHovered = false) {
      const at = new Date(epochMs);
      const widthPx = viewport.cssWidth * viewport.dpr;
      const heightPx = viewport.cssHeight * viewport.dpr;

      earthOrientationMatrix(at, earth.matrix);
      earth.matrixWorldNeedsUpdate = true;

      sunDir.copy(sunKm).normalize();
      surface.uniforms.uSunDir.value.copy(sunDir);
      atmosphereMaterial.uniforms.uSunDir.value.copy(sunDir);
      atmosphereMaterial.uniforms.uCamPos.value.copy(camera.position);
      light.position.copy(sunDir); // shines from its position toward its target, the origin
      sun.position.copy(sunKm);
      const sprite = sunSpriteSize(sun.position.distanceTo(camera.position), fovDeg, heightPx);
      sun.material.uniforms.uSpritePx.value = sprite.spritePx;
      sun.material.uniforms.uDiscFraction.value = sprite.discFraction;

      const m = moonPositionJ2000Km(at);
      moonPosition.set(m.x, m.y, m.z);
      moonMatrix(moonPosition, moon.matrix);
      moon.matrixWorldNeedsUpdate = true;

      // Earth-scale layers fade as they shrink onto the Earth's pixel (B.21).
      const camDistKm = camera.position.length();
      atmosphere.visible = layerFade(SATELLITE_LAYER_RADIUS_KM, camDistKm) > 0;
      // The Moon's orbit outlasts the satellites by exactly its size (S4's rule); it is camera-relative, as the planets' are.
      const fade = layerFade(MOON_LAYER_RADIUS_KM, camDistKm);
      orbit.visible = fade > 0 && writeMoonOrbit(epochMs, orbitKm);
      if (orbit.visible) {
        writeOffsetPositions(orbitKm, ORBIT_SAMPLES, minusCamera.copy(camera.position).negate(), orbitPoints);
        writeSegments(orbit.geometry, orbitPoints, ORBIT_SAMPLES);
        orbit.position.copy(camera.position);
        orbit.material.opacity = fade * (moonHovered ? 1 : MOON_ORBIT_OPACITY); // hover: full, as NASA's
        orbit.material.linewidth = moonHovered ? MOON_ORBIT_HOVER_WIDTH_PX : MOON_ORBIT_WIDTH_PX;
        orbit.material.resolution.set(widthPx, heightPx);
      }
    },
    dispose() {
      disposeTextures();
      for (const mesh of [earth, atmosphere, moon]) mesh.geometry.dispose();
      for (const material of [surface, atmosphereMaterial, moonMaterial, orbit.material, sun.material]) material.dispose();
      sun.geometry.dispose();
      orbit.geometry.dispose();
    },
  };
}
