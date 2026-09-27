import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from 'three';

/** The Sun's true angular diameter from Earth, degrees (mean; 0.524–0.542 over the year). */
export const SUN_ANGULAR_DIAMETER_DEG = 0.533;

const VERTEX = /* glsl */ `
  uniform vec3 uSunDir;
  uniform float uSpritePx;

  void main() {
    // A direction, not a position: the Sun is drawn at the far plane like the
    // stars (StarSky), but depth-TESTED, so the Earth occludes it.
    vec4 clip = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(uSunDir, 1.0);
    gl_Position = clip;
    #ifdef USE_REVERSED_DEPTH_BUFFER
      gl_Position.z = 0.0;
    #else
      gl_Position.z = clip.w;
    #endif
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
      uSunDir: { value: new Vector3(1, 0, 0) },
      uSpritePx: { value: 96 },
      uDiscFraction: { value: 0.2 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
  });
  const sprite = new Points(geometry, material);
  sprite.frustumCulled = false; // its position attribute is a placeholder; the shader places it
  return sprite;
}

/**
 * Sprite size for the current viewport: the disc at its true angular size,
 * the sprite six times wider for the glow. Input: vertical fov (deg), drawing
 * buffer height (px). Output: sprite px and the disc's fraction of it.
 */
export function sunSpriteSize(fovDeg: number, heightPx: number): { spritePx: number; discFraction: number } {
  const discPx = Math.max(3, (SUN_ANGULAR_DIAMETER_DEG / fovDeg) * heightPx);
  const spritePx = Math.min(512, Math.max(48, discPx * 6));
  return { spritePx, discFraction: discPx / spritePx };
}
