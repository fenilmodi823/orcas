/**
 * Per-object state bits, one byte per object in `FrameState.flags`
 * (brief §A.3). Lives in its own module rather than in frame-state.ts
 * because selection and LOD write these too, and frame-state.ts owns the
 * propagation buffers — it should not also own selection vocabulary.
 *
 * ⚠️ These numeric values are load-bearing. `Stale` moved from 1 << 0 to
 * 1 << 2 in M1.7a to match the brief. Compare with the enum member, never
 * with a literal.
 */
export const enum Flag {
  None = 0,
  Visible = 1 << 0, // passes the current filter set
  Occluded = 1 << 1, // behind the Earth ellipsoid from the camera
  Stale = 1 << 2, // no segment covers this object at the current epoch
  Selected = 1 << 3,
  Hovered = 1 << 4,
  Featured = 1 << 5, // D4 curated set — permanent orbit path (M1.7b)
}
