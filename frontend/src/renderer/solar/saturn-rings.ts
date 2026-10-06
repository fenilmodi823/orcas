import { DoubleSide, Matrix4, Mesh, NoColorSpace, RingGeometry, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector2, Vector3 } from 'three';
import type { Texture } from 'three';

/** The radial profiles' span, km from Saturn's centre: the bake's RING_INNER_KM and RING_OUTER_KM. */
export const RING_INNER_KM = 74_500;
export const RING_OUTER_KM = 141_000;
/** Restores the albedo profile's brightest bin from 1: printed by bake_planet_textures.py, 2026-10-06. */
const ALBEDO_GAIN = 3.5051;

const URLS = { albedo: '/textures/saturn-rings-albedo.png', transmission: '/textures/saturn-rings-transmission.png' } as const;

const RING_VERTEX = /* glsl */ `
  varying vec3 vOffsetW;

  void main() {
    vOffsetW = mat3(modelMatrix) * position; // from Saturn's centre, km, scene axes
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAGMENT = /* glsl */ `
  uniform sampler2D uAlbedo;
  uniform sampler2D uTransmission; // exp(-tau) at normal incidence, linear
  uniform float uGain;
  uniform vec3 uSunDir;    // Saturn toward the Sun, unit
  uniform vec3 uPole;      // Saturn's IAU north: the ring plane's normal
  uniform vec3 uCamOffset; // camera minus Saturn, km
  uniform vec2 uRingKm;
  uniform vec2 uRadiiKm;   // Saturn's equatorial and polar radii

  varying vec3 vOffsetW;

  void main() {
    float u = (length(vOffsetW) - uRingKm.x) / (uRingKm.y - uRingKm.x);
    if (u < 0.0 || u > 1.0) discard;
    float tau = -log(max(texture2D(uTransmission, vec2(u, 0.5)).r, 1e-3));
    vec3 toCam = uCamOffset - vOffsetW;
    float viewSide = dot(toCam, uPole);
    float sunSide = dot(uSunDir, uPole);
    float mu = max(abs(viewSide) / length(toCam), 1e-3);
    float mu0 = max(abs(sunSide), 1e-3);

    // Single scattering in a thin slab of optical depth tau: the lit face, or the
    // light let through to the unlit face. The phase function is taken as flat.
    float scatter;
    if (viewSide * sunSide > 0.0) scatter = mu0 / (mu + mu0) * (1.0 - exp(-tau * (1.0 / mu + 1.0 / mu0)));
    else if (abs(mu - mu0) < 1e-3) scatter = mu0 * tau / (mu * mu) * exp(-tau / mu);
    else scatter = mu0 / (mu - mu0) * (exp(-tau / mu) - exp(-tau / mu0));

    // Saturn's shadow: stretch the polar axis so the planet is a sphere, then ask
    // whether the ray toward the Sun meets it ahead.
    float k = uRadiiKm.x / uRadiiKm.y;
    vec3 p = vOffsetW + (k - 1.0) * dot(vOffsetW, uPole) * uPole;
    vec3 d = normalize(uSunDir + (k - 1.0) * sunSide * uPole);
    float b = dot(p, d);
    float shadow = (b < 0.0 && b * b - dot(p, p) + uRadiiKm.x * uRadiiKm.x > 0.0) ? 0.0 : 1.0;

    vec3 albedo = texture2D(uAlbedo, vec2(u, 0.5)).rgb * uGain;
    // Premultiplied: the light the ring scatters, over the fraction it hides.
    gl_FragColor = vec4(albedo * scatter * shadow, 1.0 - exp(-tau / mu));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface SaturnRings {
  readonly mesh: Mesh<RingGeometry, ShaderMaterial>;
  /** Null until loaded; Saturn's own material reads it for the rings' shadow. */
  readonly transmission: Texture | null;
  /** Fetch the two profiles; `onLoad` runs once both are in. A failure leaves the rings undrawn. */
  load(anisotropy: number, onLoad: (transmission: Texture) => void): void;
  /** `body`: Saturn's IAU frame as a rotation, placed at its centre (scene km). */
  update(body: Matrix4, saturnKm: Vector3, sunDir: Vector3, pole: Vector3, cameraKm: Vector3): void;
  dispose(): void;
}

function loadTexture(loader: TextureLoader, url: string, srgb: boolean, anisotropy: number): Promise<Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (t) => {
        t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
        t.anisotropy = anisotropy;
        resolve(t);
      },
      undefined,
      () => reject(new Error(`ring profile failed to load: ${url}`)),
    );
  });
}

/**
 * Saturn's rings (S5b) in its equatorial plane. Each radius takes its optical depth from Cassini UVIS and its
 * colour from Cassini's PIA11142, so the rings are as transparent as measured from wherever they are seen, are
 * dark from their unlit face where they are dense, and fall into Saturn's shadow.
 */
export function createSaturnRings(equatorialKm: number, polarKm: number): SaturnRings {
  const material = new ShaderMaterial({
    vertexShader: RING_VERTEX,
    fragmentShader: RING_FRAGMENT,
    uniforms: {
      uAlbedo: { value: null },
      uTransmission: { value: null },
      uGain: { value: ALBEDO_GAIN },
      uSunDir: { value: new Vector3(1, 0, 0) },
      uPole: { value: new Vector3(0, 0, 1) },
      uCamOffset: { value: new Vector3() },
      uRingKm: { value: new Vector2(RING_INNER_KM, RING_OUTER_KM) },
      uRadiiKm: { value: new Vector2(equatorialKm, polarKm) },
    },
    side: DoubleSide,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
  });
  const mesh = new Mesh(new RingGeometry(RING_INNER_KM, RING_OUTER_KM, 512, 1), material);
  mesh.matrixAutoUpdate = false;
  mesh.visible = false; // until both profiles are in
  const loaded: Texture[] = [];
  let transmission: Texture | null = null;
  let disposed = false;

  return {
    mesh,
    get transmission() {
      return transmission;
    },
    load(anisotropy, onLoad) {
      const loader = new TextureLoader();
      Promise.all([loadTexture(loader, URLS.albedo, true, anisotropy), loadTexture(loader, URLS.transmission, false, anisotropy)]).then(
        ([albedo, trans]) => {
          loaded.push(albedo, trans);
          if (disposed) return void loaded.forEach((t) => t.dispose());
          material.uniforms.uAlbedo.value = albedo;
          material.uniforms.uTransmission.value = trans;
          transmission = trans;
          mesh.visible = true;
          onLoad(trans);
        },
        (error: unknown) => console.warn('[saturn] drawing no rings:', error),
      );
    },
    update(body, saturnKm, sunDir, pole, cameraKm) {
      mesh.matrix.copy(body);
      mesh.matrixWorldNeedsUpdate = true;
      material.uniforms.uSunDir.value.copy(sunDir);
      material.uniforms.uPole.value.copy(pole);
      material.uniforms.uCamOffset.value.copy(cameraKm).sub(saturnKm);
    },
    dispose() {
      disposed = true;
      mesh.geometry.dispose();
      material.dispose();
      for (const t of loaded) t.dispose();
    },
  };
}

/** The camera's distance from the rings' annulus, km: what the near plane must stay inside. */
export function ringDistanceKm(cameraKm: Vector3, saturnKm: Vector3, pole: Vector3): number {
  const q = _q.copy(cameraKm).sub(saturnKm);
  const z = q.dot(pole);
  const rho = Math.sqrt(Math.max(q.lengthSq() - z * z, 0));
  const edge = Math.min(Math.max(rho, RING_INNER_KM), RING_OUTER_KM);
  return Math.hypot(rho - edge, z);
}

const _q = new Vector3();
