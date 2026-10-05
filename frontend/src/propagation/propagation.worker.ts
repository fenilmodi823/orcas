// Runs inside a dedicated Web Worker (see createBrowserPropagationPool
// in worker-pool.ts). If TypeScript can't resolve `self`'s worker-scope
// members here, add `/// <reference lib="webworker" />` at the top of
// this file — the frontend's tsconfig targets DOM, not WebWorker, lib
// types (they're mutually exclusive), so this file's scope differs from
// the rest of the app.
import { satrecFromOmm } from '@orcas/physics';
import { buildSegmentsSkippingFailures } from './segment-builder.js';
import type { SegmentRequest } from './worker-pool.js';

self.onmessage = (event: MessageEvent<SegmentRequest>) => {
  const { objects, t0Ms, t1Ms } = event.data;
  const items = objects.map((object) => ({ satrec: satrecFromOmm(object.record), noradId: object.norad }));
  const segments = buildSegmentsSkippingFailures(items, new Date(t0Ms), new Date(t1Ms));
  (self as unknown as Worker).postMessage(segments);
};
