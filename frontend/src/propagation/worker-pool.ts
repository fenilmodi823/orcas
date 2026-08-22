import type { SatRec } from 'satellite.js';
import { buildSegment, type PropagationSegment } from './segment-builder.js';
import type { ObjectMeta } from '../data/catalog-types.js';

export interface SegmentRequest {
  readonly objects: readonly ObjectMeta[];
  readonly t0Ms: number;
  readonly t1Ms: number;
}

/**
 * Executes one shard of a segment-build request. The real runner
 * (createBrowserPropagationPool) posts to a Web Worker; the in-process
 * runner (createInProcessRunner) runs synchronously in the calling
 * thread and is used both by tests and as the real implementation until
 * a browser Worker is available. jsdom has no Worker implementation, so
 * the Worker-backed runner is verified live in a real browser (M1.1
 * plan, Task 8) rather than in this test suite — the same gap M1.0 hit
 * with IndexedDB.
 */
export type SegmentRunner = (shard: SegmentRequest) => Promise<PropagationSegment[]>;

export interface PropagationPool {
  buildSegments(objects: readonly ObjectMeta[], t0Ms: number, t1Ms: number): Promise<PropagationSegment[]>;
  terminate(): void;
}

/**
 * Splits `objects` into `runners.length` shards (round-robin — object i
 * goes to runner i % N) and runs them in parallel, reassembling results
 * in the original object order. Splitting differently across pool sizes
 * cannot change any individual object's result, since each shard's
 * computation is a pure function of that object alone — this is what
 * makes different pool sizes produce bit-identical output.
 */
export function createPropagationPool(runners: readonly SegmentRunner[]): PropagationPool {
  if (runners.length === 0) {
    throw new Error('createPropagationPool requires at least one runner');
  }

  return {
    async buildSegments(objects, t0Ms, t1Ms) {
      const shards: ObjectMeta[][] = runners.map(() => []);
      objects.forEach((object, i) => {
        shards[i % runners.length].push(object);
      });

      const shardResults = await Promise.all(
        runners.map((runner, i) => runner({ objects: shards[i], t0Ms, t1Ms })),
      );

      const byNorad = new Map<string, PropagationSegment>();
      for (const shardResult of shardResults) {
        for (const segment of shardResult) byNorad.set(segment.noradId, segment);
      }
      return objects.map((object) => {
        const segment = byNorad.get(object.norad);
        if (!segment) throw new Error(`No segment produced for ${object.norad}`);
        return segment;
      });
    },
    terminate() {
      // No-op here: closing real Workers happens in
      // createBrowserPropagationPool, which wraps this pool.
    },
  };
}

/** Runs shards synchronously in the calling thread via segment-builder.ts. */
export function createInProcessRunner(satrecs: ReadonlyMap<string, SatRec>): SegmentRunner {
  return async (shard) =>
    shard.objects.map((object) => {
      const satrec = satrecs.get(object.norad);
      if (!satrec) throw new Error(`No SatRec provided for ${object.norad}`);
      return buildSegment(satrec, object.norad, new Date(shard.t0Ms), new Date(shard.t1Ms));
    });
}

/** Runs shards in a real Web Worker via postMessage. */
export function createWorkerRunner(worker: Worker): SegmentRunner {
  return (shard) =>
    new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<PropagationSegment[]>) => {
        cleanup();
        resolve(event.data);
      };
      const onError = (event: ErrorEvent) => {
        cleanup();
        reject(new Error(`Propagation worker failed: ${event.message}`));
      };
      function cleanup() {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
      }
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage(shard);
    });
}

/** The real pool: `poolSize` real Web Workers running propagation.worker.ts. */
export function createBrowserPropagationPool(poolSize: number): PropagationPool {
  const workers = Array.from(
    { length: poolSize },
    () => new Worker(new URL('./propagation.worker.js', import.meta.url), { type: 'module' }),
  );
  const pool = createPropagationPool(workers.map(createWorkerRunner));
  return {
    buildSegments: pool.buildSegments,
    terminate() {
      workers.forEach((w) => w.terminate());
    },
  };
}
