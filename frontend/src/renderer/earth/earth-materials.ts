import {
  AdditiveBlending,
  BackSide,
  MeshStandardMaterial,
  NoColorSpace,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
  type ColorSpace,
} from 'three';
import { WGS84_A_KM, WGS84_B_KM } from '@orcas/physics';
import { readColorToken } from '../scene-colors.js';
import { ATMOSPHERE_FRAGMENT, ATMOSPHERE_VERTEX, SURFACE_FRAGMENT, SURFACE_VERTEX } from './earth-shaders.js';

/** Top of the rendered atmosphere, km above the equatorial radius. */
export const ATMOSPHERE_HEIGHT_KM = 100;

const TEXTURES = {
  day: '/textures/earth-day-4096.jpg',
  night: '/textures/earth-night-3600.jpg',
  clouds: '/textures/earth-clouds-2048.jpg',
  moon: '/textures/moon-2048.jpg',
} as const;

/** Credit for the imagery the scene draws (textures/ASSETS.md). */
export const EARTH_IMAGERY_CREDIT =
  'Earth and Moon imagery: NASA (Blue Marble, Black Marble, LRO). Clouds are a fixed composite, not current weather.';

export function createSurfaceMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    uniforms: {
      uDay: { value: null },
      uNight: { value: null },
      uClouds: { value: null },
      uReady: { value: 0 },
      uFallback: { value: readColorToken('--deep', '#0e1626') },
      uSunDir: { value: new Vector3(1, 0, 0) },
      uSunIntensity: { value: 1.4 },
      uNightGain: { value: 0.9 },
    },
  });
}

export function createAtmosphereMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    uniforms: {
      uCamPos: { value: new Vector3() },
      uSunDir: { value: new Vector3(1, 0, 0) },
      uRe: { value: WGS84_A_KM },
      uRa: { value: WGS84_A_KM + ATMOSPHERE_HEIGHT_KM },
      uPolarStretch: { value: WGS84_A_KM / WGS84_B_KM },
      uSunIntensity: { value: 10 },
    },
    // Back faces, so the shell is drawn whether the camera is outside it or in
    // it; no depth test, because the shader clips itself analytically.
    side: BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
}

export function createMoonMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ roughness: 1, metalness: 0 });
}

function load(loader: TextureLoader, url: string, colorSpace: ColorSpace, anisotropy: number): Promise<Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = colorSpace;
        texture.anisotropy = anisotropy;
        resolve(texture);
      },
      undefined,
      () => reject(new Error(`texture failed to load: ${url}`)),
    );
  });
}

/**
 * Loads the maps and hands them to the materials. Until they arrive — or if
 * they never do — the Earth is drawn in `--deep` and the Moon plain grey, lit
 * correctly either way: a failed texture degrades the look, never the scene.
 * Returns a disposer.
 */
export function loadSceneTextures(surface: ShaderMaterial, moon: MeshStandardMaterial, anisotropy: number): () => void {
  const loader = new TextureLoader();
  const loaded: Texture[] = [];
  let disposed = false;
  const keep = (t: Texture) => {
    if (disposed) t.dispose();
    else loaded.push(t);
    return t;
  };

  Promise.all([
    load(loader, TEXTURES.day, SRGBColorSpace, anisotropy).then(keep),
    load(loader, TEXTURES.night, SRGBColorSpace, anisotropy).then(keep),
    // Cloud cover is a fraction, not a colour: sampled raw.
    load(loader, TEXTURES.clouds, NoColorSpace, anisotropy).then(keep),
  ]).then(
    ([day, night, clouds]) => {
      if (disposed) return;
      surface.uniforms.uDay.value = day;
      surface.uniforms.uNight.value = night;
      surface.uniforms.uClouds.value = clouds;
      surface.uniforms.uReady.value = 1;
    },
    (error: unknown) => console.warn('[earth] drawing the untextured fallback:', error),
  );

  load(loader, TEXTURES.moon, SRGBColorSpace, anisotropy).then(
    (texture) => {
      if (disposed) return void texture.dispose();
      loaded.push(texture);
      moon.map = texture;
      moon.needsUpdate = true;
    },
    (error: unknown) => console.warn('[moon] drawing the untextured fallback:', error),
  );

  return () => {
    disposed = true;
    for (const t of loaded) t.dispose();
  };
}
