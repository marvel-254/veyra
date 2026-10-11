/**
 * IndexedDB-backed offline download library for Veyra.
 *
 * DB:  "veyra-downloads"
 * Store: "files" (keyPath: "movieId")
 * Schema: DownloadedFile
 */

'use client';

// ── Types ────────────────────────────────────────────────────

export interface DownloadedFile {
  movieId: number;
  title: string;
  posterUrl?: string;
  /** Stored as a Blob — IndexedDB lazily pages this from disk. */
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  downloadedAt: string;
  duration?: number;
}

export interface StorageUsage {
  used: number;
  /** Only available when the Storage API is available. */
  quota?: number;
  percent: number;
  supported: boolean;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  isQuotaError?: boolean;
}

// ── DB Singleton ─────────────────────────────────────────────

const DB_NAME = 'veyra-downloads';
const DB_VERSION = 1;
const STORE_NAME = 'files';

let _db: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (_db) return _db;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'movieId' });
      }
    };

    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = fn(store);
    if (!result) {
      // fn consumed the transaction — use oncomplete
      tx.oncomplete = () => resolve(undefined as unknown as T);
      tx.onerror = () => reject(tx.error);
    } else {
      (result as IDBRequest<T>).onsuccess = () => resolve((result as IDBRequest<T>).result);
      (result as IDBRequest<T>).onerror = () => reject((result as IDBRequest<T>).error);
    }
  });
}

// ── Public API ───────────────────────────────────────────────

/**
 * Persist a downloaded movie blob to IndexedDB.
 *
 * @param movieId   Unique identifier from the movie object.
 * @param meta      Title, poster, duration, mimeType.
 * @param blob      The video blob to store.
 */
export async function saveDownload(
  movieId: number,
  meta: {
    title: string;
    posterUrl?: string;
    duration?: number;
    mimeType?: string;
  },
  blob: Blob,
): Promise<SaveResult> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return { ok: false, error: 'IndexedDB is not available in this browser.' };
  }

  const mimeType = meta.mimeType ?? (blob.type || 'video/mp4');

  // Reject zero-byte blobs early.
  if (blob.size === 0) {
    return { ok: false, error: 'Downloaded file is empty.' };
  }

  const entry: DownloadedFile = {
    movieId,
    title: meta.title,
    posterUrl: meta.posterUrl,
    blob,
    mimeType,
    sizeBytes: blob.size,
    downloadedAt: new Date().toISOString(),
    duration: meta.duration,
  };

  try {
    await withStore('readwrite', (store) => store.put(entry));
    return { ok: true };
  } catch (err: unknown) {
    const domErr = err as DOMException;
    // QuotaExceededError is code 11 in newer browsers, 22 in legacy.
    const isQuota =
      domErr.name === 'QuotaExceededError' ||
      domErr.name === 'UnknownError' ||
      (domErr as unknown as { code?: number }).code === 22;

    if (isQuota) {
      return {
        ok: false,
        error: 'Not enough storage on this device. Delete a saved movie and try again.',
        isQuotaError: true,
      };
    }
    return { ok: false, error: 'Could not save the download. Please try again.' };
  }
}

/** Retrieve a single saved download. */
export async function getDownload(movieId: number): Promise<DownloadedFile | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return null;
  try {
    const result = await withStore('readonly', (store) => store.get(movieId));
    return result ?? null;
  } catch {
    return null;
  }
}

/** All saved downloads, newest first. */
export async function listDownloads(): Promise<DownloadedFile[]> {
  if (typeof window === 'undefined' || !window.indexedDB) return [];
  try {
    const all = await withStore('readonly', (store) => store.getAll());
    return (all as DownloadedFile[]).sort(
      (a, b) =>
        new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime(),
    );
  } catch {
    return [];
  }
}

/** Remove a saved download and free its storage. Returns true on success. */
export async function removeDownload(movieId: number): Promise<boolean> {
  if (typeof window === 'undefined' || !window.indexedDB) return false;
  try {
    await withStore('readwrite', (store) => store.delete(movieId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Total bytes stored across all downloads, plus estimated quota usage.
 * Falls back to summing the sizeBytes of known entries when the Storage API
 * is unavailable (e.g. private browsing in some browsers).
 */
export async function getStorageUsage(): Promise<StorageUsage> {
  const zero: StorageUsage = { used: 0, percent: 0, supported: false };

  if (typeof window === 'undefined' || !window.indexedDB) return zero;

  try {
    const files = await listDownloads();
    const used = files.reduce((sum, f) => sum + f.sizeBytes, 0);

    // Try the Storage API (navigator.storage.estimate()).
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const { usage = used, quota = 0 } = await navigator.storage.estimate();
      return {
        used,
        quota,
        percent: quota > 0 ? Math.min(100, (usage / quota) * 100) : 0,
        supported: true,
      };
    }

    return { used, percent: 0, supported: false };
  } catch {
    return zero;
  }
}

/**
 * Create an object URL for a saved blob.
 * Caller is responsible for revoking the returned URL when done.
 *
 * @returns The blob: URL string, or null when the download is not found.
 */
export async function getDownloadObjectUrl(movieId: number): Promise<string | null> {
  const file = await getDownload(movieId);
  if (!file) return null;
  return URL.createObjectURL(file.blob);
}

/**
 * Revoke a blob URL created via getDownloadObjectUrl().
 * Call this when the player unmounts or the user navigates away.
 */
export function revokeDownloadObjectUrl(url: string) {
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore — URL may have been revoked already or be invalid.
  }
}
