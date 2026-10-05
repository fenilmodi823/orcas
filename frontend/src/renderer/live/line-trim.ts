import { LineMaterial } from 'three-stdlib';

const LIBRARY_ESTIMATE = 'float nearEstimate = - 0.5 * b / a;';

// Under reversed depth three builds a = n / (f − n) and b = f·n / (f − n), so
// n = b / (1 + a); halve it, as the library's own estimate halves near.
const REVERSED_AWARE_ESTIMATE = `#ifdef USE_REVERSED_DEPTH_BUFFER
  float nearEstimate = - 0.5 * b / ( 1.0 + a );
#else
  ${LIBRARY_ESTIMATE}
#endif`;

/**
 * three-stdlib's `LineMaterial` trims a segment that runs behind the camera
 * at a near-plane estimate read from the projection matrix, −0.5 b / a. That
 * holds for the ordinary depth buffer; under the reversed one (P7.D2) it lands
 * near −far / 2, so the trimmed end is flung across the screen and an orbit
 * passing behind the camera draws a false straight line (found live in S4).
 * Idempotent. Throws if the library's line has changed, rather than silently
 * not fixing it.
 */
export function trimForReversedDepth(vertexShader: string): string {
  if (vertexShader.includes(REVERSED_AWARE_ESTIMATE)) return vertexShader;
  if (!vertexShader.includes(LIBRARY_ESTIMATE)) {
    throw new Error('LineMaterial no longer has the near-plane estimate line-trim.ts replaces.');
  }
  return vertexShader.replace(LIBRARY_ESTIMATE, REVERSED_AWARE_ESTIMATE);
}

/**
 * Give a fat line the reversed-depth trim. Every `LineMaterial` the scene
 * draws goes through this, drei's included. (LineMaterial sets its own
 * `onBeforeCompile` per instance, so there is no prototype hook to use.)
 */
export function patchLineMaterial(material: LineMaterial): void {
  const patched = trimForReversedDepth(material.vertexShader);
  if (patched === material.vertexShader) return;
  material.vertexShader = patched;
  material.needsUpdate = true;
}
