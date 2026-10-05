import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from 'three';
import { SUN_RADIUS_KM } from '@orcas/physics';

const VERTEX = /* glsl */ `
  uniform float uSpritePx;

  void main() {
    // At the Sun's true place (S4): the object sits at the Sun, and three forms
    // modelViewMatrix in float64, so the GPU sees it camera-relative. Depth-tested
    // at its centre, so a body in front of the Sun hides it.
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSpritePx;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uDiscFraction; // the disc's radius as a fraction of the sprite's

  void main() {
    float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float disc = 1.0 - smoothstep(uDiscFraction * 0.85, uDiscFraction, d);
    float glow = exp(-d * d * 9.0) * 0.35 + exp(-d * 40.0) * 0.4;
    // ~6500 K: near-white, never yellow (brief §F.1).
    vec3 colour = vec3(1.0, 0.98, 0.95) * (disc * 6.0 + glow);
    if (disc + glow < 0.004) discard;
    gl_FragColor = vec4(colour, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** One-vertex Points drawing the Sun's disc and a restrained glow. */
export function createSunSprite(): Points<BufferGeometry, ShaderMaterial> {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(3), 3));
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uSpritePx: { value: 96 },
      uDiscFraction: { value: 0.2 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
  });
  const sprite = new Points(geometry, material);
  sprite.frustumCulled = false; // a one-vertex bounding sphere is no use for a 512 px sprite
  return sprite;
}

/**
 * Sprite size for the current viewport: the disc at its true angular size from
 * `distanceKm` (never under 3 px), the sprite six times wider for the glow.
 * Input: camera-to-Sun distance (km), vertical fov (deg), drawing buffer height
 * (px). Output: sprite px and the disc's fraction of it.
 */
export function sunSpriteSize(distanceKm: number, fovDeg: number, heightPx: number): { spritePx: number; discFraction: number } {
  const diameterDeg = (2 * Math.asin(Math.min(1, SUN_RADIUS_KM / distanceKm)) * 180) / Math.PI;
  const discPx = Math.max(3, (diameterDeg / fovDeg) * heightPx);
  const spritePx = Math.min(512, Math.max(48, discPx * 6));
  return { spritePx, discFraction: discPx / spritePx };
}
