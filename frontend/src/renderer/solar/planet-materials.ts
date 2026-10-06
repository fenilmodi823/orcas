import { Color, ShaderMaterial, Vector2, Vector3 } from 'three';

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
  uniform vec3 uColour;
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform vec3 uSunDir;   // unit vector from this planet toward the Sun, scene frame
  uniform vec3 uPole;     // the planet's IAU north, scene frame
  uniform sampler2D uRingTransmission; // Saturn: exp(-tau) at normal incidence, linear
  uniform float uHasRings;
  uniform vec2 uRingKm;   // the rings' inner and outer radius

  varying vec3 vNormalW;
  varying vec3 vOffsetW;
  varying vec2 vUv;

  void main() {
    vec3 base = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb : uColour;
    // Lambert from the Sun, so each planet shows its true phase; the night side
    // stays dark, as the Earth's does (brief §F.1).
    float lit = max(dot(normalize(vNormalW), uSunDir), 0.0);
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
    gl_FragColor = vec4(base * (0.02 + 0.98 * lit), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * A planet lit from the Sun (S4), with its global map once loaded (S5b) and, for
 * Saturn, its rings' shadow. Until a map arrives, or where none exists, it is
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
      uPole: { value: new Vector3(0, 0, 1) },
      uRingTransmission: { value: null },
      uHasRings: { value: 0 },
      uRingKm: { value: new Vector2(1, 2) },
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
