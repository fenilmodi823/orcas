import type { CatalogSnapshot } from './catalog-types.js';

const DB_NAME = 'orcas-catalog';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const SNAPSHOT_KEY = 'latest';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persist the current snapshot to IndexedDB, replacing whatever was
 * there. Best-effort: a write failure (private browsing, quota, disabled
 * storage) is logged and swallowed — losing the offline cache is not
 * fatal, the app just falls back to a live fetch next time. IndexedDB
 * stores the snapshot via structured clone, not JSON — no serialisation
 * step needed here, and no risk of the two drifting apart.
 */
export async function persistSnapshot(snapshot: CatalogSnapshot): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(snapshot, SNAPSHOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[orcas] failed to persist catalogue snapshot to IndexedDB', err);
  }
}

/**
 * Load the last persisted snapshot, or null if none exists or storage is
 * unavailable. Never throws — callers treat null the same as "no cache".
 */
export async function loadPersistedSnapshot(): Promise<CatalogSnapshot | null> {
  try {
    const db = await openDb();
    const snapshot = await new Promise<CatalogSnapshot | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(SNAPSHOT_KEY);
      req.onsuccess = () => resolve((req.result as CatalogSnapshot | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return snapshot;
  } catch (err) {
    console.warn('[orcas] failed to read cached catalogue snapshot from IndexedDB', err);
    return null;
  }
}
