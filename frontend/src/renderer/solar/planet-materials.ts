import { Color, ShaderMaterial, Vector3 } from 'three';

// modelViewMatrix, not viewMatrix × modelMatrix: three forms it on the CPU in
// float64, so a planet 30 AU out reaches the GPU camera-relative (B.21).
const SPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormalW;

  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 uColour;
  uniform vec3 uSunDir; // unit vector from this planet toward the Sun, scene frame

  varying vec3 vNormalW;

  void main() {
    // Lambert from the Sun, so each planet shows its true phase; the night side
    // stays dark, as the Earth's does (brief §F.1).
    float lit = max(dot(normalize(vNormalW), uSunDir), 0.0);
    gl_FragColor = vec4(uColour * (0.02 + 0.98 * lit), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * An untextured planet, lit from the Sun. Textures arrive in S5, when a planet
 * can be approached; until then a planet covers a few pixels at most (B.21).
 */
export function createPlanetMaterial(colour: Color): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SPHERE_VERTEX,
    fragmentShader: SPHERE_FRAGMENT,
    uniforms: { uColour: { value: colour }, uSunDir: { value: new Vector3(1, 0, 0) } },
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
