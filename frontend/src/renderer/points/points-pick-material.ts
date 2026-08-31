import { ShaderMaterial } from 'three';
import { POINTS_VERTEX_SHADER } from './points-shader-core.js';
import { LOD_BAND_PX } from '../lod/lod-band.js';
import { TIER_POINT } from './points-pick-id.js';

const PICK_FRAGMENT_SHADER = /* glsl */ `
precision mediump float;

varying float vEntityId;

vec4 packId(float id, float tierTag) {
  float i = id + 1.0; // 0 reserved for "nothing" (brief §D.2)
  return vec4(mod(i, 256.0),
              mod(floor(i / 256.0), 256.0),
              floor(i / 65536.0),
              tierTag) / 255.0;
}

void main() {
  gl_FragColor = packId(vEntityId, ${TIER_POINT}.0);
}
`;

/**
 * The pick-pass material (brief §D.2). Shares TierZeroPoints.tsx's
 * exact vertex shader — same position, same gl_PointSize, same
 * visibility discard — so a click always lands on what the eye sees.
 * The fragment stage is the only difference: instead of colour+alpha,
 * it encodes this vertex's entity id as an RGBA colour to be read back
 * off-screen. `transparent: false` and no blending, since this target
 * is never displayed and blending would corrupt the packed id.
 */
export function createPickMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: POINTS_VERTEX_SHADER,
    // The shared source computes `smoothstep(uLodLoPx, uLodHiPx, truePx)`,
    // which is undefined in GLSL when edge0 == edge1. Every other uniform in
    // the shared shader is left at its GL default here, but leaving these two
    // at 0 would be undefined behaviour rather than merely a zero, so the pick
    // material reads the same band the display material does.
    uniforms: {
      uLodLoPx: { value: LOD_BAND_PX.loPx },
      uLodHiPx: { value: LOD_BAND_PX.hiPx },
    },
    fragmentShader: PICK_FRAGMENT_SHADER,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });
}
