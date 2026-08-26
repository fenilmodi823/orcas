/** A plain 3-vector, km, same frame as FrameState.positions (J2000). */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function length(v: Vec3): number {
  return Math.sqrt(dot(v, v));
}

function divide(v: Vec3, r: Vec3): Vec3 {
  return { x: v.x / r.x, y: v.y / r.y, z: v.z / r.z };
}

/**
 * Direct TypeScript port of the brief's own §F.5 vertex-shader occlusion
 * formula — this is the literal spec the GLSL in TierZeroPoints.tsx also
 * implements, not independent verification on its own. Returns the
 * brightness multiplier: 1.0 fully visible, 0.06 the brief's deliberate
 * residual for a fully-occluded object, continuous in between.
 */
export function computeOcclusionFade(cameraKm: Vec3, objectKm: Vec3, earthRadiiKm: Vec3): number {
  const c = divide(cameraKm, earthRadiiKm);
  const p = divide(objectKm, earthRadiiKm);
  const d = sub(p, c);
  const dd = dot(d, d);
  const t = dd === 0 ? 0 : Math.max(0, Math.min(1, dot({ x: -c.x, y: -c.y, z: -c.z }, d) / dd));
  const closest = length({ x: c.x + t * d.x, y: c.y + t * d.y, z: c.z + t * d.z });

  const smoothstep = (edge0: number, edge1: number, x: number): number => {
    const s = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return s * s * (3 - 2 * s);
  };

  return 0.06 + (1.0 - 0.06) * smoothstep(0.995, 1.02, closest);
}

/**
 * A deliberately DIFFERENT method — the standard ray-sphere intersection
 * quadratic, against a single mean-radius sphere rather than the
 * ellipsoid-normalised closest-approach form above. Exists only so this
 * project's tests can cross-check `computeOcclusionFade` against a
 * genuinely independent computation (the same "two independently-derived
 * answers, compared" discipline PropagationDebug.tsx already uses for
 * SGP4 vs Hermite) — never called from the renderer itself.
 */
export function isOccludedByEarthRaySphere(
  cameraKm: Vec3,
  objectKm: Vec3,
  earthRadiusKm: number,
): boolean {
  if (length(cameraKm) <= earthRadiusKm) return false; // camera itself is inside/at the surface
  const d = sub(objectKm, cameraKm);
  const a = dot(d, d);
  if (a === 0) return false;
  const b = 2 * dot(cameraKm, d);
  const c = dot(cameraKm, cameraKm) - earthRadiusKm * earthRadiusKm;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false; // ray never meets the sphere at all
  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);
  // Occluded only if the sphere is crossed strictly between camera (t=0)
  // and object (t=1).
  return (t1 > 0 && t1 < 1) || (t2 > 0 && t2 < 1);
}
