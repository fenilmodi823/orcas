/** Objects on this THREE.Layers bit are rendered by the pick pass;
 * objects that stay off it — Earth's plain sphereGeometry, which has
 * none of the custom attributes this vertex shader reads — are
 * excluded. `scene.overrideMaterial` applies scene-wide, and the pick
 * material only declares the point geometry's custom attributes
 * (aEntityId etc.), so rendering Earth through it would be a real
 * attribute-mismatch bug, not a hypothetical one. */
export const PICK_LAYER = 1;

/**
 * The Tier 0 vertex shader (brief §B.3, §F.5, §I) — shared, byte-
 * identical, between the display material (TierZeroPoints.tsx) and the
 * pick material (points-pick-material.ts). The brief's own warning: "If
 * they drift, you get objects you can see but cannot click... the worst
 * possible bug because it is intermittent." This is the ONE place this
 * source exists — never copy it.
 */
export const POINTS_VERTEX_SHADER = /* glsl */ `
attribute float aEntityId;
attribute float aRegime;
attribute float aRadius;
attribute float aFlags;
attribute float aStale;

uniform float uPixelsPerRadian;
uniform float uMinPointPx;
uniform float uDpr;
uniform float uBaseBrightness;
uniform float uFloorBrightness;
uniform float uDimFactor;
uniform float uLodLoPx;
uniform float uLodHiPx;
uniform float uFocusActive;
uniform float uSelectedEntityId;
uniform vec3 uCamPos;
uniform vec3 uEarthRadii;

varying float vBrightness;
varying float vEntityId;

void main() {
  vEntityId = aEntityId;

  if (aFlags < 0.5) {
    // Filtered-out objects are moved off clip space in the shader, not
    // culled on the CPU (brief §B.3).
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vBrightness = 0.0;
    return;
  }

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float dist = max(length(mvPosition.xyz), 1e-6);

  // Earth occlusion (brief §F.5): segment from camera to this object versus
  // the Earth ellipsoid, in ellipsoid-normalised space so one sphere test
  // is exact. Analytic, per-vertex, zero CPU cost.
  vec3 c = uCamPos / uEarthRadii;
  vec3 p = position / uEarthRadii;
  vec3 d = p - c;
  float t = clamp(dot(-c, d) / dot(d, d), 0.0, 1.0);
  float closest = length(c + t * d);
  float occlusionFade = mix(0.06, 1.0, smoothstep(0.995, 1.02, closest));

  // 1. apparent size, with a floor that does NOT flatten brightness.
  float truePx = aRadius * uPixelsPerRadian / dist;
  float drawPx = max(truePx, uMinPointPx);
  gl_PointSize = drawPx * uDpr;

  // 2. compensate: an object drawn larger than reality is dimmed by the
  //    area ratio, so distant debris stays visible but recedes.
  float brightness = uBaseBrightness * min(1.0, (truePx * truePx) / (drawPx * drawPx));
  brightness = max(brightness, uFloorBrightness);
  brightness *= occlusionFade;
  brightness *= mix(1.0, 0.4, aStale); // brief §I: stale objects render at 40%

  // 3. D6 focus dim — everything except the selected object dims to
  //    uDimFactor while a selection is active. isSelected uses a small
  //    epsilon because aEntityId/uSelectedEntityId are floats carrying
  //    integer indices, not because exact float equality is unsafe here
  //    (both sides are small whole numbers with no accumulated error).
  float isSelected = step(abs(aEntityId - uSelectedEntityId), 0.5);
  brightness *= mix(1.0, mix(uDimFactor, 1.0, isSelected), uFocusActive);
  // 4. Tier 0 / Tier 1 cross-fade (brief §B.6). Tier 1 uses the SAME band
  //    via lod-band.ts's tier1Alpha, so the two alphas sum to 1 and the eye
  //    sees no event at the crossover. The band arrives as uniforms exactly
  //    so it cannot drift from the TypeScript side (§F.7).
  brightness *= 1.0 - smoothstep(uLodLoPx, uLodHiPx, truePx);

  vBrightness = brightness;
  gl_Position = projectionMatrix * mvPosition;
}
`;
