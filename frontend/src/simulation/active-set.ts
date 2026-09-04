/** Brief §G.6: "Typical size: 200–800. Hard cap: 2,048." */
export const ACTIVE_SET_CAP = 2048;

export interface ActiveSetArgs {
  readonly tier1: Uint32Array;
  readonly tier1Count: number;
  readonly selectedIndex: number; // -1 when nothing is selected
  readonly hoveredIndex: number; // -1 when nothing is hovered
  /** M1.7b: the curated featured set (renderer/paths/featured-norads.ts).
   * Optional so every pre-M1.7b caller and test keeps working unchanged. */
  readonly featured?: Uint32Array;
  readonly featuredCount?: number;
}

/** Allocate once at mount; `buildActiveSet` refills it forever after. */
export function createActiveSetBuffer(cap: number = ACTIVE_SET_CAP): Uint32Array {
  return new Uint32Array(cap);
}

/**
 * ACTIVE SET = selected ∪ hovered ∪ tier-1 members (brief §G.6).
 *
 * Identity first, proximity second: selection and hover are written before
 * Tier 1 members, so if the cap is reached the object the user is actually
 * looking at is never the one dropped.
 *
 * Deduplication is a linear scan of what has been written so far. That is
 * O(n²) in the worst case, but n is capped at 2,048 and the realistic size
 * is 200–800 — a bitset over 46,250 objects would cost more to clear each
 * frame than this costs to run.
 * ponytail: swap for a generation-stamped Int32Array if profiling ever
 * shows this in the frame budget.
 *
 * `featured` joined the union in M1.7b (orbit paths need every featured
 * object propagated, and trails read this same union at a much smaller
 * cap — see `renderer/trails/trail-set.ts`). `pinned` and `trailed` join
 * when sources for them exist.
 */
export function buildActiveSet(args: ActiveSetArgs, out: Uint32Array): number {
  const cap = out.length;
  let n = 0;

  const push = (index: number): void => {
    if (index < 0 || n >= cap) return;
    for (let i = 0; i < n; i++) if (out[i] === index) return;
    out[n++] = index;
  };

  push(args.selectedIndex);
  push(args.hoveredIndex);
  const featuredCount = args.featuredCount ?? 0;
  for (let i = 0; i < featuredCount && n < cap; i++) push(args.featured![i]);
  for (let i = 0; i < args.tier1Count && n < cap; i++) push(args.tier1[i]);

  return n;
}
