/**
 * GPU elapsed-time queries (`EXT_disjoint_timer_query_webgl2`), for Q9.2's
 * CPU/GPU frame-time split — RA-9 found everything pointing at fill rate
 * (GPU-bound), but nothing had actually measured it. Results are async: the
 * GPU finishes a query a frame or more after it was issued, so `poll()`
 * drains whatever is ready rather than blocking.
 *
 * The query lifecycle (queue, evict, disjoint-check) is separated from the
 * real WebGL2 calls behind `GpuQueryContext` so it's testable without a
 * live GL context — `createWebgl2QueryContext` is the only part that
 * touches the extension directly, and is intentionally thin/untested,
 * mirroring `star-sky.ts` vs `StarSky.tsx`'s split in this codebase.
 */

export interface GpuQueryContext {
  createQuery(): object | null;
  beginQuery(query: object): void;
  endQuery(): void;
  isResultAvailable(query: object): boolean;
  isDisjoint(): boolean;
  getResultNs(query: object): number;
  deleteQuery(query: object): void;
}

export interface GpuTimer {
  /** Call once per frame, immediately before the GPU work to measure. */
  begin(): void;
  /** Call once per frame, immediately after the GPU work to measure. */
  end(): void;
  /** Call once per frame. Returns the most recently completed sample in
   * ms, or null if none finished since the last poll. */
  poll(): number | null;
}

// GPU queries resolve within a few frames under normal load; if the queue
// grows past this the GPU has fallen far behind and older samples are
// stale anyway — drop them rather than grow unbounded.
const MAX_PENDING = 4;

export function createGpuTimer(ctx: GpuQueryContext): GpuTimer {
  const pending: object[] = [];
  let active: object | null = null;

  return {
    begin() {
      if (active) return; // a query is already open — skip rather than nest
      const query = ctx.createQuery();
      if (!query) return;
      ctx.beginQuery(query);
      active = query;
    },
    end() {
      if (!active) return;
      ctx.endQuery();
      pending.push(active);
      active = null;
      while (pending.length > MAX_PENDING) {
        const dropped = pending.shift();
        if (dropped) ctx.deleteQuery(dropped);
      }
    },
    poll() {
      const query = pending[0];
      if (!query || !ctx.isResultAvailable(query)) return null;
      pending.shift();
      const disjoint = ctx.isDisjoint();
      const ns = ctx.getResultNs(query);
      ctx.deleteQuery(query);
      // A disjoint event (e.g. the GPU clocked/throttled mid-query)
      // invalidates the timing — skip this sample rather than report it.
      return disjoint ? null : ns / 1e6;
    },
  };
}

/** Real adapter over a live WebGL2 context. Returns null if the extension
 * isn't supported — callers fall back to "n/a" rather than treat it as an
 * error (Rules.md: a missing capability degrades, it doesn't break). */
export function createWebgl2QueryContext(gl: WebGL2RenderingContext): GpuQueryContext | null {
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) return null;

  return {
    createQuery: () => gl.createQuery(),
    beginQuery: (query) => gl.beginQuery(ext.TIME_ELAPSED_EXT, query as WebGLQuery),
    endQuery: () => gl.endQuery(ext.TIME_ELAPSED_EXT),
    isResultAvailable: (query) =>
      gl.getQueryParameter(query as WebGLQuery, gl.QUERY_RESULT_AVAILABLE) as boolean,
    isDisjoint: () => gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean,
    getResultNs: (query) => gl.getQueryParameter(query as WebGLQuery, gl.QUERY_RESULT) as number,
    deleteQuery: (query) => gl.deleteQuery(query as WebGLQuery),
  };
}
