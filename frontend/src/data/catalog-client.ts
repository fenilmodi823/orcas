const DEFAULT_API_BASE_URL = 'http://localhost:8000';

export function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export class CatalogFetchError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'CatalogFetchError';
  }
}

export interface CatalogMetaResponse {
  readonly objectCount: number;
  readonly newestEpoch: string | null;
  readonly source: string;
  readonly generatedAt: string;
}

/**
 * Fetch the pre-baked catalogue snapshot from the backend. The browser
 * decompresses the gzip response transparently (Content-Encoding: gzip),
 * same as httpx/requests on the Python side — see
 * backend/app/api/v1/catalog.py. This is the one legitimate client-side
 * caller; never called from a backend request handler.
 */
export async function fetchCatalogSnapshot(): Promise<readonly unknown[]> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api/v1/catalog/snapshot`);
  } catch (err) {
    throw new CatalogFetchError('network request for /catalog/snapshot failed', err);
  }
  if (!res.ok) {
    throw new CatalogFetchError(`GET /catalog/snapshot -> ${res.status}`);
  }
  const body: unknown = await res.json();
  if (!Array.isArray(body)) {
    throw new CatalogFetchError('snapshot response was not a JSON array');
  }
  return body;
}

function detailOf(body: unknown): string | null {
  return typeof body === 'object' && body !== null && 'detail' in body && typeof body.detail === 'string'
    ? body.detail
    : null;
}

/**
 * The catalogue as it stood at `atMs` — historical replay (Phase 5): each
 * object's newest element set at or before that instant, built by the
 * backend from element_set history. Same record format as the snapshot. On
 * failure the backend's own reason (e.g. how far back history goes) becomes
 * the error message, so the UI can say it rather than a bare status code.
 */
export async function fetchCatalogReplay(atMs: number): Promise<readonly unknown[]> {
  const at = encodeURIComponent(new Date(atMs).toISOString());
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api/v1/catalog/replay?at=${at}`);
  } catch (err) {
    throw new CatalogFetchError('network request for /catalog/replay failed', err);
  }
  if (!res.ok) {
    // An unreadable error body falls back to the status line, not to silence.
    const detail = await res.json().then(detailOf, () => null);
    throw new CatalogFetchError(detail ?? `GET /catalog/replay -> ${res.status}`);
  }
  const body: unknown = await res.json();
  if (!Array.isArray(body)) {
    throw new CatalogFetchError('replay response was not a JSON array');
  }
  return body;
}

interface RawCatalogMeta {
  readonly object_count: number;
  readonly newest_epoch: string | null;
  readonly source: string;
  readonly generated_at: string;
}

export async function fetchCatalogMeta(): Promise<CatalogMetaResponse> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl()}/api/v1/catalog/meta`);
  } catch (err) {
    throw new CatalogFetchError('network request for /catalog/meta failed', err);
  }
  if (!res.ok) {
    throw new CatalogFetchError(`GET /catalog/meta -> ${res.status}`);
  }
  const raw = (await res.json()) as RawCatalogMeta;
  return {
    objectCount: raw.object_count,
    newestEpoch: raw.newest_epoch,
    source: raw.source,
    generatedAt: raw.generated_at,
  };
}
