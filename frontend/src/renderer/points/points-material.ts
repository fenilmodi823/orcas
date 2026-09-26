import { AdditiveBlending, ShaderMaterial, Vector3 } from 'three';
import { WGS84_A_KM, WGS84_B_KM } from '@orcas/physics';
import { OrbitClass } from '../../data/catalog-types.js';
import { POINTS_VERTEX_SHADER } from './points-shader-core.js';
import { LOD_BAND_PX } from '../lod/lod-band.js';
import { readCyanToken } from '../scene-colors.js';
import { readOrbitClassColor } from '../paths/path-orbit-class-tint.js';

const FRAGMENT_SHADER = /* glsl */ `
precision mediump float;

varying float vBrightness;
varying vec3 vTint;

void main() {
  // Soft radial falloff on gl_PointCoord: a Gaussian-ish core plus a
  // faint halo (brief §B.3). The 4.0 / 0.12 constants below are chosen
  // empirically for this task and tuned live in Task 7 — not spec values.
  vec2 fromCenter = gl_PointCoord - vec2(0.5);
  float d = length(fromCenter) * 2.0; // 0 at center, 1 at edge
  float core = exp(-d * d * 4.0);
  float halo = smoothstep(1.0, 0.0, d) * 0.12;
  float alpha = clamp(core + halo, 0.0, 1.0) * vBrightness;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(vTint, alpha);
}
`;

/** Indexed by the OrbitClass enum (LEO=0..Unknown=4) — the same order the
 * vertex shader's `uOrbitClassColors[int(aOrbitClass)]` lookup assumes. */
const ORBIT_CLASS_ORDER: readonly OrbitClass[] = [
  OrbitClass.LEO,
  OrbitClass.MEO,
  OrbitClass.GEO,
  OrbitClass.HEO,
  OrbitClass.Unknown,
];

/**
 * Tier 0's point material. Colours are read from tokens.css once, here —
 * a GLSL uniform can't reference a CSS variable, so this is the one-time
 * bridge that keeps colour literals out of the renderer (Rules.md).
 */
export function createPointsMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: POINTS_VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uPixelsPerRadian: { value: 0 },
      uMinPointPx: { value: 1.5 }, // chosen empirically, tune in Task 7
      uDpr: { value: Math.min(window.devicePixelRatio, 2) }, // Rules.md perf ceiling: dpr capped at 2
      uBaseBrightness: { value: 1.0 },
      // 0.6, not 0.05: with PLACEHOLDER_RADIUS_KM this small, truePx is
      // always many orders of magnitude below uMinPointPx for every
      // object at any real-world distance, so the area-ratio
      // compensation always crushes brightness to this floor — verified
      // live in Task 7 (a 0.05 floor rendered as an invisible ~2px,
      // 5%-alpha additive dot, indistinguishable from the background).
      // Once real per-object sizes exist, most objects will draw well
      // above the floor and this value matters far less.
      uFloorBrightness: { value: 0.6 },
      uDimFactor: { value: 0.45 }, // P4.D27 supersedes D6's 0.3 — a readable floor, not a blackout
      uLodLoPx: { value: LOD_BAND_PX.loPx },
      uLodHiPx: { value: LOD_BAND_PX.hiPx },
      uFocusActive: { value: 0.0 },
      uSelectedEntityId: { value: -1 }, // never matches a real 0-based index while nothing is selected
      // P4.D23/24: read once — orbit-class colour is a per-vertex GPU
      // lookup, not a per-frame CPU one.
      uOrbitClassColors: { value: ORBIT_CLASS_ORDER.map((orbitClass) => readOrbitClassColor(orbitClass)) },
      uSelectedColor: { value: readCyanToken() },
      uCamPos: { value: new Vector3() },
      uEarthRadii: { value: new Vector3(WGS84_A_KM, WGS84_A_KM, WGS84_B_KM) },
    },
  });
}
