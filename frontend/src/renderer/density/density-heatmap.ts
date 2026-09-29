import {
  AdditiveBlending,
  Color,
  HalfFloatType,
  Mesh,
  PlaneGeometry,
  Points,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderTarget,
  type BufferGeometry,
  type Camera,
  type WebGLRenderer,
} from 'three';
import { WGS84_A_KM, WGS84_B_KM } from '@orcas/physics';
import { viridisGlsl } from './viridis.js';

/** Kernel diameter in pixels of the half-resolution target (≈ 2x on screen). */
const KERNEL_PX = 7;

const ACCUMULATE_VERTEX = /* glsl */ `
  attribute float aFlags;
  uniform vec3 uCamPos;
  uniform vec3 uEarthRadii;
  uniform float uKernelPx;
  varying float vWeight;

  void main() {
    if (aFlags < 0.5) {
      // Filtered out: the density is of what the scene shows.
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      vWeight = 0.0;
      return;
    }
    // The Tier 0 occlusion test (brief §F.5): an object behind the Earth is
    // not on screen, so it adds nothing to the density.
    vec3 c = uCamPos / uEarthRadii;
    vec3 p = position / uEarthRadii;
    vec3 d = p - c;
    float t = clamp(dot(-c, d) / dot(d, d), 0.0, 1.0);
    vWeight = smoothstep(0.995, 1.02, length(c + t * d));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uKernelPx;
  }
`;

const ACCUMULATE_FRAGMENT = /* glsl */ `
  varying float vWeight;
  void main() {
    float r = length(gl_PointCoord - vec2(0.5)) * 2.0;
    if (r > 1.0) discard;
    gl_FragColor = vec4(exp(-r * r * 4.0) * vWeight, 0.0, 0.0, 1.0);
  }
`;

const COMPOSITE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const COMPOSITE_FRAGMENT = /* glsl */ `
  uniform sampler2D uDensity;
  uniform float uGain;
  varying vec2 vUv;
  ${viridisGlsl()}
  void main() {
    float density = texture2D(uDensity, vUv).r;
    // Saturating map: one object is faint, a crowded shell is bright.
    float t = 1.0 - exp(-density * uGain);
    float alpha = smoothstep(0.08, 0.6, t) * 0.85;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(viridis(t), alpha);
  }
`;

export interface DensityHeatmap {
  /** The full-screen composite quad; add it to the scene once. */
  readonly overlay: Mesh;
  /** Accumulate the density of `geometry` (Tier 0's) as seen from `camera`;
   * null hides the layer. Call once per frame, before the scene renders. */
  update(
    renderer: WebGLRenderer,
    camera: Camera,
    geometry: BufferGeometry | null,
    widthPx: number,
    heightPx: number,
  ): void;
  dispose(): void;
}

/**
 * Phase 5's density heatmap, as the brief designs it (Part 6.4): the same
 * Tier 0 points, drawn again into a half-resolution half-float target with
 * additive Gaussian kernels and no colour, then colour-mapped full screen
 * with viridis. What the brightness means is exactly "how many catalogued
 * objects project onto this part of the screen" — relative, not per km³.
 */
export function createDensityHeatmap(): DensityHeatmap {
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, format: RGBAFormat, depthBuffer: false });
  const accumulate = new ShaderMaterial({
    vertexShader: ACCUMULATE_VERTEX,
    fragmentShader: ACCUMULATE_FRAGMENT,
    uniforms: {
      uCamPos: { value: new Vector3() },
      uEarthRadii: { value: new Vector3(WGS84_A_KM, WGS84_A_KM, WGS84_B_KM) },
      uKernelPx: { value: KERNEL_PX },
    },
    blending: AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const composite = new ShaderMaterial({
    vertexShader: COMPOSITE_VERTEX,
    fragmentShader: COMPOSITE_FRAGMENT,
    uniforms: { uDensity: { value: target.texture }, uGain: { value: 0.35 } },
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const overlay = new Mesh(new PlaneGeometry(2, 2), composite);
  overlay.frustumCulled = false;
  overlay.renderOrder = 1000; // after everything else in the scene
  overlay.visible = false;

  const scene = new Scene();
  const points = new Points(undefined, accumulate);
  points.frustumCulled = false;
  scene.add(points);
  const savedClear = new Color();
  const transparentBlack = new Color(0, 0, 0);

  return {
    overlay,
    update(renderer, camera, geometry, widthPx, heightPx) {
      overlay.visible = geometry !== null;
      if (geometry === null) return;
      const w = Math.max(1, Math.floor(widthPx / 2));
      const h = Math.max(1, Math.floor(heightPx / 2));
      if (target.width !== w || target.height !== h) target.setSize(w, h);
      points.geometry = geometry;
      accumulate.uniforms.uCamPos.value.copy(camera.position);

      const previousTarget = renderer.getRenderTarget();
      renderer.getClearColor(savedClear);
      const savedAlpha = renderer.getClearAlpha();
      renderer.setRenderTarget(target);
      renderer.setClearColor(transparentBlack, 0);
      renderer.clear(true, false, false);
      renderer.render(scene, camera);
      renderer.setRenderTarget(previousTarget);
      renderer.setClearColor(savedClear, savedAlpha);
    },
    dispose() {
      target.dispose();
      accumulate.dispose();
      composite.dispose();
      overlay.geometry.dispose();
    },
  };
}
