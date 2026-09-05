import { useEffect, useMemo, useState } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from 'three';
import { parseStarSky, normalisedBrightness, type StarSky as StarSkyData } from './star-sky.js';

const SKY_URL = '/sky/gaia-dr3-stars.bin';
/** Behind everything. The sky writes no depth, so drawing it first lets the
 * Earth and the satellites simply paint over it. */
const SKY_RENDER_ORDER = -1000;

/**
 * The real Gaia DR3 sky: every `gaiadr3.gaia_source` down to the magnitude
 * cut, at its catalogue position. The galactic plane, its dust lanes and its
 * open clusters are all emergent — none of them is drawn.
 *
 * ⭐ Why a shader and not geometry at a large radius. The camera travels
 * from 82 m to beyond geostationary — five and a half orders of magnitude —
 * so any star sphere with a fixed radius is either inside the Earth or
 * outside the far plane. This draws each star as a pure DIRECTION: the
 * vertex shader strips the translation out of the view matrix and forces
 * `z = w`, pinning every star to the far plane. It cannot be clipped, cannot
 * be flown through, and needs no radius at all — which is also the truth
 * about a star seen from Earth orbit.
 *
 * ⚠️ **Frames.** Gaia positions are ICRS; the scene's axes are ECI, and
 * ORCAS propagates with SGP4, whose native output is TEME. ICRS and J2000
 * agree to under a milliarcsecond, but TEME and J2000 differ by precession
 * and nutation — of order 0.4 degrees at this epoch, uncorrected here. The
 * sky is therefore right relative to itself and very slightly rotated
 * relative to the satellites. Correcting it needs a TEME->J2000 rotation in
 * the propagation layer, not a fudge here.
 *
 * ⚠️ **Brightness is a display mapping, not photometry.** Real flux across
 * G = 1.7 to 9 spans a factor of ~800; drawn literally, all but a handful of
 * stars would be invisible. Size and alpha use a compressed curve, the same
 * compromise every star chart makes. The magnitudes themselves are real and
 * unmodified — only their rendering is compressed.
 */
const VERTEX_SHADER = /* glsl */ `
  attribute float aBrightness;   // 0 faintest .. 1 brightest, from the real magnitude
  attribute float aColourIndex;  // real bp_rp; < -900 marks "archive had none"

  uniform float uPixelRatio;
  // Kept as a uniform, fixed at 1 today: when the perf work of M1.8 tiers
  // the sky by device, this is the knob it turns.
  uniform float uSizeScale;

  varying float vBrightness;
  varying float vColourIndex;

  void main() {
    vBrightness = aBrightness;
    vColourIndex = aColourIndex;

    // mat3 drops the translation: the sky does not move when the camera
    // does, only when it turns. xyww pins z/w to 1 — the far plane.
    vec4 clip = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
    gl_Position = clip.xyww;

    gl_PointSize = uSizeScale * uPixelRatio * mix(0.9, 3.4, pow(aBrightness, 1.5));
  }
`;

/**
 * Colour from the real BP-RP index. The ramp is an approximation of how
 * stellar colour indices look to the eye — bluish-white through white and
 * yellow to orange — not a calibrated spectral rendering. The index driving
 * it is Gaia's own measurement.
 */
const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  varying float vBrightness;
  varying float vColourIndex;

  const vec3 BLUE_WHITE = vec3(0.74, 0.82, 1.00);
  const vec3 WHITE      = vec3(1.00, 0.99, 0.96);
  const vec3 AMBER      = vec3(1.00, 0.84, 0.65);
  const vec3 NEUTRAL    = vec3(0.90, 0.92, 0.95);

  void main() {
    // Round the sprite; a square star reads as a rendering artefact.
    vec2 d = gl_PointCoord - vec2(0.5);
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;

    vec3 tint;
    if (vColourIndex < -900.0) {
      tint = NEUTRAL; // no bp_rp in the archive for this source
    } else {
      float t = clamp(vColourIndex, -0.4, 3.0);
      tint = t < 0.8
        ? mix(BLUE_WHITE, WHITE, smoothstep(-0.4, 0.8, t))
        : mix(WHITE, AMBER, smoothstep(0.8, 3.0, t));
    }

    // Soft edge, and fainter stars sit further back in the mix.
    float falloff = 1.0 - smoothstep(0.06, 0.25, r2);
    float alpha = falloff * mix(0.22, 1.0, pow(vBrightness, 1.1));
    gl_FragColor = vec4(tint, alpha);
  }
`;

/**
 * P4.D31, "star-field first pass": a brighter magnitude cut so the sky
 * reads as a night sky, not a star chart, at rest — chosen by eye against
 * the real Gaia DR3 range this route loads (G ~1.7-9). The underlying
 * `.bin` still carries every real source down to the survey's own cut;
 * this only decides how many of them draw. Full device tiering (a
 * per-tier count, not a fixed one) is M1.8.
 */
const MAX_MAGNITUDE = 6.5;

interface Props {
  /** Called once with the loaded set, or with null if the sky is
   * unavailable — the host decides what to say about it. */
  readonly onLoaded?: (sky: StarSkyData | null, error: string | null) => void;
}

export function StarSky({ onLoaded }: Props): React.ReactElement | null {
  const [sky, setSky] = useState<StarSkyData | null>(null);

  useEffect(() => {
    let cancelled = false;
    // No star field is a cosmetic loss, never a broken app (Rules.md's
    // error table): the scene runs black-skied and says why.
    fetch(SKY_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (cancelled) return;
        const parsed = parseStarSky(buffer);
        setSky(parsed);
        onLoaded?.(parsed, null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onLoaded?.(null, error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [onLoaded]);

  const points = useMemo(() => {
    if (!sky) return null;

    // P4.D31: drop sources fainter than MAX_MAGNITUDE at load, rather than
    // regenerating the .bin with a brighter --max-g cut — no network fetch
    // against the Gaia archive, no new committed asset, and brightness
    // below still normalises against the FULL real magMin/magMax span
    // (not recomputed from this subset), so the kept stars' relative
    // brightness is unchanged from what the full sky would have shown.
    let visibleCount = 0;
    for (let i = 0; i < sky.count; i++) if (sky.magnitudes[i] <= MAX_MAGNITUDE) visibleCount++;

    const directions = new Float32Array(visibleCount * 3);
    const brightness = new Float32Array(visibleCount);
    const colours = new Float32Array(visibleCount);
    let w = 0;
    for (let i = 0; i < sky.count; i++) {
      if (sky.magnitudes[i] > MAX_MAGNITUDE) continue;
      directions[w * 3] = sky.directions[i * 3];
      directions[w * 3 + 1] = sky.directions[i * 3 + 1];
      directions[w * 3 + 2] = sky.directions[i * 3 + 2];
      brightness[w] = normalisedBrightness(sky.magnitudes[i], sky.magMin, sky.magMax);
      // -999 is the shader's "no measurement" sentinel; NaN would poison
      // every comparison it touches in GLSL.
      colours[w] = Number.isNaN(sky.colourIndices[i]) ? -999 : sky.colourIndices[i];
      w++;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(directions, 3));
    geometry.setAttribute('aBrightness', new BufferAttribute(brightness, 1));
    geometry.setAttribute('aColourIndex', new BufferAttribute(colours, 1));

    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        // P4.D31: lower than M1.7a's 1 — a smaller point size is the other
        // half of "night sky, not star chart" alongside the magnitude cut.
        uSizeScale: { value: 0.6 },
      },
      transparent: true,
      // Additive against a black sky is what starlight actually does when
      // two stars overlap on one pixel.
      blending: AdditiveBlending,
      // depthTest ON, depthWrite OFF. `transparent: true` puts this in
      // three's transparent list, which draws AFTER every opaque object, so
      // renderOrder alone does not put the sky behind the Earth — without
      // the depth test the stars painted straight over the planet. With it,
      // the far-plane z the vertex shader forces loses to everything, which
      // is exactly right for a sky.
      depthTest: true,
      depthWrite: false,
    });

    const object = new Points(geometry, material);
    object.frustumCulled = false; // every star is at infinity; there is nothing to cull against
    object.renderOrder = SKY_RENDER_ORDER;
    object.matrixAutoUpdate = false;
    return object;
  }, [sky]);

  useEffect(() => {
    if (!points) return;
    return () => {
      points.geometry.dispose();
      (points.material as ShaderMaterial).dispose();
    };
  }, [points]);


  return points ? <primitive object={points} /> : null;
}
