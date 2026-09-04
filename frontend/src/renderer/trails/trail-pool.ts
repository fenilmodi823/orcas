export interface PoolSlot {
  readonly occupantNorad: string | null;
}

/**
 * Decide which NORAD id (or none) each pool slot should hold next frame,
 * given the new focus set. Pure — no refs, no three.js, no React — so
 * the slot-assignment policy is unit-testable without a running scene.
 *
 * A norad already occupying a slot keeps that slot (its trail history
 * carries over unbroken); a norad newly entering the focus set claims
 * the lowest-indexed free slot; a slot whose occupant left the focus set
 * comes back `null` (the caller clears its ring and hides its line).
 * `slots.length` is the pool capacity — the trail focus set is built
 * with a buffer this size, so `focusSetNorads.length` never exceeds it.
 */
export function reconcilePool(
  slots: readonly PoolSlot[],
  focusSetNorads: readonly string[],
): (string | null)[] {
  const wanted = new Set(focusSetNorads);
  const result: (string | null)[] = slots.map((slot) =>
    slot.occupantNorad !== null && wanted.has(slot.occupantNorad) ? slot.occupantNorad : null,
  );

  const alreadyPlaced = new Set<string>();
  for (const norad of result) if (norad !== null) alreadyPlaced.add(norad);

  const freeIndices: number[] = [];
  for (let i = 0; i < result.length; i++) if (result[i] === null) freeIndices.push(i);

  let freeCursor = 0;
  for (const norad of focusSetNorads) {
    if (alreadyPlaced.has(norad)) continue;
    if (freeCursor >= freeIndices.length) break; // pool full — cannot happen when caps match
    result[freeIndices[freeCursor++]] = norad;
    alreadyPlaced.add(norad);
  }

  return result;
}
