import { COVERAGE_FORWARD_LEO_MS } from '../simulation/coverage.js';

/**
 * The public static site (Stage 2 spec §2): built with VITE_DATA_MODE=static,
 * the app reads baked files under /data instead of the server. Only the two
 * data clients and the few UI lines the spec names ask this.
 */
export function isStaticSite(): boolean {
  return import.meta.env.VITE_DATA_MODE === 'static';
}

/** How long a bake is trusted: the low-orbit window, the first to run out (spec §4, coverage.ts). */
export const PUBLISHED_TRUST_MS = COVERAGE_FORWARD_LEO_MS;

// ponytail: module state, set once per page load by the catalogue fetch; a
// store would add nothing while exactly one catalogue file exists.
let dataAsOfMs: number | null = null;

export function setDataAsOf(ms: number | null): void {
  dataAsOfMs = ms;
}

/** The screen's start instant the published data stands for, once the catalogue file has loaded. */
export function dataAsOf(): number | null {
  return dataAsOfMs;
}

/**
 * "Now" for the scene. On a static site whose data has aged past its window,
 * the latest moment the data still covers, never the wall clock (Q25 (a)).
 */
export function presentMs(nowMs: number = Date.now()): number {
  if (!isStaticSite() || dataAsOfMs === null) return nowMs;
  return Math.min(nowMs, dataAsOfMs + PUBLISHED_TRUST_MS);
}

export function isPastPublishedWindow(nowMs: number = Date.now()): boolean {
  return presentMs(nowMs) < nowMs;
}

const files = new Map<string, Promise<Record<string, unknown>>>();

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function load(path: string): Promise<Record<string, unknown>> {
  const url = `/data/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  // A host may already have decoded it (Content-Encoding: gzip); gzip's magic bytes tell.
  let text: string;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Response(bytes).body;
    if (!stream) throw new Error(`${url}: empty body`);
    text = await new Response(stream.pipeThrough(new DecompressionStream('gzip'))).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }
  const body: unknown = JSON.parse(text);
  if (!isJsonObject(body)) throw new Error(`${url} is not a JSON object`);
  return body;
}

/** One baked file, fetched once per page load; a failure is forgotten so the next call retries. */
export function readSiteFile(path: string): Promise<Record<string, unknown>> {
  let pending = files.get(path);
  if (!pending) {
    pending = load(path);
    files.set(path, pending);
    pending.catch(() => files.delete(path));
  }
  return pending;
}

/** Tests only: forget loaded files and the data instant. */
export function resetSiteMode(): void {
  files.clear();
  dataAsOfMs = null;
}
