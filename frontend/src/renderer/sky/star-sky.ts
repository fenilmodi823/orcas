/**
 * Reader for the real Gaia DR3 sky that `scripts/data/fetch_gaia_sky.py`
 * packs. That script's docstring is the provenance record — the ADQL it
 * sends, the quantisation bounds, and the mission's own limits. This module
 * only decodes.
 *
 * Nothing here generates a star. Every direction comes from a
 * `gaiadr3.gaia_source` row's `ra`/`dec`, every magnitude from
 * `phot_g_mean_mag`, every colour from `bp_rp`.
 */

const MAGIC = 'ORCASKY1';
const HEADER_BYTES = 28; // 8s + u32 + 4 x f32, no padding under struct '<'
const RECORD_BYTES = 10;
const COLOUR_NULL_BYTE = 255;

/** ESA's required acknowledgement. Shown in the UI, not just in a comment —
 * using the data obliges us to say so where people can see it. */
export const GAIA_ACKNOWLEDGEMENT =
  'ESA/Gaia/DPAC — Gaia Data Release 3. Processed by the Gaia Data Processing and Analysis Consortium.';

export interface StarSky {
  readonly count: number;
  /** Unit vectors, 3 per star, in ICRS/equatorial: +Z the celestial pole,
   * +X the equinox — the same axes the scene's ECI frame uses. */
  readonly directions: Float32Array;
  /** Real `phot_g_mean_mag`, recovered from the quantised byte. */
  readonly magnitudes: Float32Array;
  /** Real `bp_rp`. NaN where the archive had no value — kept rather than
   * dropped, so the set is not biased against the reddest sources. */
  readonly colourIndices: Float32Array;
  readonly magMin: number;
  readonly magMax: number;
}

export class StarSkyFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StarSkyFormatError';
  }
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * Decode the packed sky. Throws `StarSkyFormatError` on anything it does not
 * recognise rather than rendering a partial or misread sky — a silently
 * mangled star field is indistinguishable from a fake one.
 */
export function parseStarSky(buffer: ArrayBuffer): StarSky {
  if (buffer.byteLength < HEADER_BYTES) {
    throw new StarSkyFormatError(`file is ${buffer.byteLength} bytes, shorter than the ${HEADER_BYTES}-byte header`);
  }

  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 8));
  if (magic !== MAGIC) {
    throw new StarSkyFormatError(`expected magic "${MAGIC}", found "${magic}"`);
  }

  const count = view.getUint32(8, true);
  const magMin = view.getFloat32(12, true);
  const magMax = view.getFloat32(16, true);
  const colourMin = view.getFloat32(20, true);
  const colourMax = view.getFloat32(24, true);

  const expected = HEADER_BYTES + count * RECORD_BYTES;
  if (buffer.byteLength !== expected) {
    throw new StarSkyFormatError(`header claims ${count} stars (${expected} bytes) but the file is ${buffer.byteLength}`);
  }

  const directions = new Float32Array(count * 3);
  const magnitudes = new Float32Array(count);
  const colourIndices = new Float32Array(count);
  const magSpan = magMax - magMin || 1;
  const colourSpan = colourMax - colourMin;

  for (let i = 0; i < count; i++) {
    const offset = HEADER_BYTES + i * RECORD_BYTES;
    const raRad = view.getFloat32(offset, true) * DEG_TO_RAD;
    const decRad = view.getFloat32(offset + 4, true) * DEG_TO_RAD;
    const cosDec = Math.cos(decRad);

    directions[i * 3] = cosDec * Math.cos(raRad);
    directions[i * 3 + 1] = cosDec * Math.sin(raRad);
    directions[i * 3 + 2] = Math.sin(decRad);

    magnitudes[i] = magMin + (view.getUint8(offset + 8) / 254) * magSpan;
    const colourByte = view.getUint8(offset + 9);
    colourIndices[i] = colourByte === COLOUR_NULL_BYTE ? NaN : colourMin + (colourByte / 254) * colourSpan;
  }

  return { count, directions, magnitudes, colourIndices, magMin, magMax };
}

/** Normalised brightness, 0 at the faintest star in the set and 1 at the
 * brightest. Display quantity only — see StarSky.tsx on why this is not
 * flux. */
export function normalisedBrightness(magnitude: number, magMin: number, magMax: number): number {
  const span = magMax - magMin || 1;
  return Math.min(1, Math.max(0, (magMax - magnitude) / span));
}
