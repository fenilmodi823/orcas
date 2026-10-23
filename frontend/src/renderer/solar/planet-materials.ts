import { Color, ShaderMaterial, Vector2, Vector3, Vector4 } from 'three';
import { SUN_RADIUS_KM } from '@orcas/physics';

/** The most moons one planet's shader shadows: Saturn's seven (S6b2). */
export const MAX_SHADOW_MOONS = 7;

// modelViewMatrix, not viewMatrix × modelMatrix: three forms it on the CPU in
// float64, so a planet 30 AU out reaches the GPU camera-relative (B.21).
// mat3(modelMatrix) has no translation, so vOffsetW stays small and exact.
const SPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vOffsetW;
  varying vec2 vUv;

  void main() {
    // The inverse transpose: the mesh is a unit sphere scaled to the IAU ellipsoid (S5b).
    vNormalW = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
    vOffsetW = mat3(modelMatrix) * position;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SPHERE_FRAGMENT = /* glsl */ `
  #define MAX_SHADOW_MOONS ${MAX_SHADOW_MOONS}
  uniform vec3 uColour;
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform vec3 uSunDir;   // unit vector from this planet toward the Sun, scene frame
  uniform float uSunlit;  // the fraction of the Sun this body sees (S6b: a moon in its planet's shadow)
  uniform vec3 uPole;     // the planet's IAU north, scene frame
  uniform sampler2D uRingTransmission; // Saturn: exp(-tau) at normal incidence, linear
  uniform float uHasRings;
  uniform vec2 uRingKm;   // the rings' inner and outer radius
  uniform vec3 uSunKm;    // the Sun's centre from this planet's, km, scene frame
  uniform vec4 uMoons[MAX_SHADOW_MOONS]; // S6b2: a moon's centre from this planet's (xyz, km) and its radius (w, km)
  uniform int uMoonCount;

  varying vec3 vNormalW;
  varying vec3 vOffsetW;
  varying vec2 vUv;

  // The fraction of a disc of angular radius a left visible by a disc of radius b whose centre is c away, all
  // radians: @orcas/physics visibleDiskFraction, the conical model, line for line.
  float visibleDiskFraction(float a, float b, float c) {
    if (c >= a + b) return 1.0;
    if (c <= b - a) return 0.0;
    if (c <= a - b) return 1.0 - (b * b) / (a * a);
    float x = (c * c + a * a - b * b) / (2.0 * c);
    float y = sqrt(max(0.0, a * a - x * x));
    float overlap = a * a * acos(clamp(x / a, -1.0, 1.0)) + b * b * acos(clamp((c - x) / b, -1.0, 1.0)) - c * y;
    return clamp(1.0 - overlap / (3.14159265 * a * a), 0.0, 1.0);
  }

  void main() {
    vec3 base = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb : uColour;
    // Lambert from the Sun, so each planet shows its true phase; the night side
    // stays dark, as the Earth's does (brief §F.1).
    float lit = max(dot(normalize(vNormalW), uSunDir), 0.0) * uSunlit;
    if (uHasRings > 0.5 && lit > 0.0) {
      // The rings' shadow: follow the ray to the Sun to the ring plane, and dim by
      // the light the rings let through on that slant, exp(-tau / mu0).
      float sinSun = dot(uSunDir, uPole);
      float t = -dot(vOffsetW, uPole) / sinSun;
      float u = (length(vOffsetW + t * uSunDir) - uRingKm.x) / (uRingKm.y - uRingKm.x);
      if (t > 0.0 && u >= 0.0 && u <= 1.0) {
        lit *= pow(max(texture2D(uRingTransmission, vec2(u, 0.5)).r, 1e-4), 1.0 / abs(sinSun));
      }
    }
    if (lit > 0.0) {
      // The moons' shadows (S6b2): how much of the Sun each moon covers, seen from this point.
      vec3 toSun = uSunKm - vOffsetW;
      float a = asin(min(1.0, ${SUN_RADIUS_KM.toFixed(1)} / length(toSun)));
      for (int i = 0; i < MAX_SHADOW_MOONS; i++) {
        if (i >= uMoonCount) break;
        vec3 toMoon = uMoons[i].xyz - vOffsetW;
        float b = asin(min(1.0, uMoons[i].w / length(toMoon)));
        float c = atan(length(cross(toSun, toMoon)), dot(toSun, toMoon)); // exact at small angles, unlike acos
        lit *= visibleDiskFraction(a, b, c);
      }
    }
    gl_FragColor = vec4(base * (0.02 + 0.98 * lit), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * A planet lit from the Sun (S4), with its global map once loaded (S5b), its
 * moons' shadows (S6b2) and, for Saturn, its rings' shadow. Until a map arrives, or where none exists, it is
 * drawn in its flat token colour.
 */
export function createPlanetMaterial(colour: Color): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SPHERE_VERTEX,
    fragmentShader: SPHERE_FRAGMENT,
    uniforms: {
      uColour: { value: colour },
      uMap: { value: null },
      uHasMap: { value: 0 },
      uSunDir: { value: new Vector3(1, 0, 0) },
      uSunlit: { value: 1 },
      uPole: { value: new Vector3(0, 0, 1) },
      uRingTransmission: { value: null },
      uHasRings: { value: 0 },
      uRingKm: { value: new Vector2(1, 2) },
      uSunKm: { value: new Vector3(1, 0, 0) },
      uMoons: { value: Array.from({ length: MAX_SHADOW_MOONS }, () => new Vector4()) },
      uMoonCount: { value: 0 },
    },
  });
}

const DOT_VERTEX = /* glsl */ `
  attribute vec3 colour;
  uniform float uDotPx;
  varying vec3 vColour;

  void main() {
    vColour = colour;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uDotPx;
  }
`;

const DOT_FRAGMENT = /* glsl */ `
  varying vec3 vColour;

  void main() {
    if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
    gl_FragColor = vec4(vColour, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * A planet seen from too far for its sphere to cover a pixel still shows, as a
 * dot at its centre. Depth-tested at the centre, so once the sphere is larger
 * than the dot its near side hides it. `uDotPx` is in device pixels.
 */
export function createPlanetDotMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: DOT_VERTEX,
    fragmentShader: DOT_FRAGMENT,
    uniforms: { uDotPx: { value: 2 } },
  });
}
