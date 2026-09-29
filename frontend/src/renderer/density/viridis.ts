/**
 * Viridis as a degree-6 polynomial per channel (matplotlib's colormap; the
 * fit is the widely used one by Matt Zucker, CC0). Perceptually uniform and
 * CVD-safe, which is why the brief requires it for density (Part 8.2) and
 * forbids a rainbow. The coefficients live here once: the GLSL is generated
 * from them, and the test checks them against viridis's published stops.
 */
export const VIRIDIS_COEFFICIENTS: readonly (readonly [number, number, number])[] = [
  [0.2777273272234177, 0.005407344544966578, 0.3340998053353061],
  [0.1050930431085774, 1.404613529898575, 1.384590162594685],
  [-0.3308618287255563, 0.214847559468213, 0.09509516302823659],
  [-4.634230498983486, -5.799100973351585, -19.33244095627987],
  [6.228269936347081, 14.17993336680509, 56.69055260068105],
  [4.776384997670288, -13.74514537774601, -65.35303263337234],
  [-5.435455855934631, 4.645852612178535, 26.3124352495832],
];

/** Viridis at t in [0, 1], linear-ish sRGB channel values in [0, 1]. */
export function viridis(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  const out: [number, number, number] = [0, 0, 0];
  for (let channel = 0; channel < 3; channel++) {
    let v = 0;
    for (let k = VIRIDIS_COEFFICIENTS.length - 1; k >= 0; k--) v = v * x + VIRIDIS_COEFFICIENTS[k][channel];
    out[channel] = v;
  }
  return out;
}

/** The same polynomial as a GLSL function `vec3 viridis(float t)`. */
export function viridisGlsl(): string {
  const vec = ([r, g, b]: readonly [number, number, number]) => `vec3(${r}, ${g}, ${b})`;
  const c = VIRIDIS_COEFFICIENTS.map(vec);
  return `vec3 viridis(float t) {
  t = clamp(t, 0.0, 1.0);
  return ${c[0]} + t * (${c[1]} + t * (${c[2]} + t * (${c[3]} + t * (${c[4]} + t * (${c[5]} + t * ${c[6]})))));
}`;
}
