import { DirectionalLight, Group, Matrix4, Mesh, SphereGeometry, Vector3, type Camera } from 'three';
import { Line2, LineGeometry, LineMaterial } from 'three-stdlib';
import { MOON_RADIUS_KM, moonPositionJ2000Km, sunDirectionJ2000, WGS84_A_KM } from '@orcas/physics';
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
import { MOON_TRAIL_SAMPLES, writeMoonTrail } from './moon-trail.js';
import { bodyScreenPosition, type BodyScreenPosition } from './body-screen.js';

/** Resample the Moon's trail once the clock has moved this far. The Moon covers
 * ~0.09° (~600 km) in 10 simulated minutes, so the trail never visibly lags it. */
const TRAIL_RESAMPLE_MS = 10 * 60_000;
const MOON_TRAIL_WIDTH_PX = 2.5; // thicker than a satellite path (1.5 / 2 px) — item 13
/** Where the Sun's label is projected from: a point this far along its direction. */
const SUN_LABEL_DISTANCE_KM = 1e8;

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
  /** Screen positions for the Sun and Moon labels, written by `update`. */
  readonly labels: { readonly sun: BodyScreenPosition; readonly moon: BodyScreenPosition };
  /** Advance everything to `epochMs` (the SIMULATION clock). Call after the camera is final. */
  update(epochMs: number, camera: Camera, fovDeg: number, viewport: Viewport): void;
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

  const trailGeometry = new LineGeometry();
  const trailMaterial = new LineMaterial({ vertexColors: true, transparent: true, linewidth: MOON_TRAIL_WIDTH_PX });
  const trail = new Line2(trailGeometry, trailMaterial);
  trail.frustumCulled = false;
  trail.visible = false; // until the first sample
  const moonRgb = readColorToken('--moon', '#e6dcc6');
  const trailPositions = new Float32Array(MOON_TRAIL_SAMPLES * 3);
  const trailColours = new Float32Array(MOON_TRAIL_SAMPLES * 4);
  let trailSampledAtMs = Number.NaN;

  const group = new Group();
  group.add(light, sun, earth, atmosphere, moon, trail);

  const sunDir = new Vector3();
  const moonPosition = new Vector3();
  const sunLabelPoint = new Vector3();
  const labels = {
    sun: { xPx: 0, yPx: 0, visible: false },
    moon: { xPx: 0, yPx: 0, visible: false },
  };
  let disposeTextures = () => {};

  return {
    group,
    labels,
    loadTextures(anisotropy) {
      disposeTextures = loadSceneTextures(surface, moonMaterial, anisotropy);
    },
    update(epochMs, camera, fovDeg, viewport) {
      const at = new Date(epochMs);
      const widthPx = viewport.cssWidth * viewport.dpr;
      const heightPx = viewport.cssHeight * viewport.dpr;

      earthOrientationMatrix(at, earth.matrix);
      earth.matrixWorldNeedsUpdate = true;

      const s = sunDirectionJ2000(at);
      sunDir.set(s.x, s.y, s.z);
      surface.uniforms.uSunDir.value.copy(sunDir);
      atmosphereMaterial.uniforms.uSunDir.value.copy(sunDir);
      atmosphereMaterial.uniforms.uCamPos.value.copy(camera.position);
      light.position.copy(sunDir); // shines from its position toward its target, the origin
      sun.material.uniforms.uSunDir.value.copy(sunDir);
      const sprite = sunSpriteSize(fovDeg, heightPx);
      sun.material.uniforms.uSpritePx.value = sprite.spritePx;
      sun.material.uniforms.uDiscFraction.value = sprite.discFraction;

      const m = moonPositionJ2000Km(at);
      moonPosition.set(m.x, m.y, m.z);
      moonMatrix(moonPosition, moon.matrix);
      moon.matrixWorldNeedsUpdate = true;

      trailMaterial.resolution.set(widthPx, heightPx);
      if (!(Math.abs(epochMs - trailSampledAtMs) < TRAIL_RESAMPLE_MS)) {
        writeMoonTrail(epochMs, moonRgb, trailPositions, trailColours);
        trailGeometry.setPositions(trailPositions);
        trailGeometry.setColors(trailColours, 4);
        trail.computeLineDistances();
        trail.visible = true;
        trailSampledAtMs = epochMs;
      }

      sunLabelPoint.copy(camera.position).addScaledVector(sunDir, SUN_LABEL_DISTANCE_KM);
      bodyScreenPosition(sunLabelPoint, camera, viewport.cssWidth, viewport.cssHeight, labels.sun);
      bodyScreenPosition(moonPosition, camera, viewport.cssWidth, viewport.cssHeight, labels.moon);
    },
    dispose() {
      disposeTextures();
      for (const mesh of [earth, atmosphere, moon]) mesh.geometry.dispose();
      for (const material of [surface, atmosphereMaterial, moonMaterial, trailMaterial, sun.material]) material.dispose();
      sun.geometry.dispose();
      trailGeometry.dispose();
    },
  };
}
