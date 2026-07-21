/**
 * voicePreviewCache.ts
 * IndexedDB cache for Gemini Live voice preview audio.
 *
 * Each entry stores the raw PCM16 chunks received from Gemini Live for a
 * given voice + preview phrase. The cache key includes CACHE_VERSION so
 * bumping it (when the phrase or voice list changes) automatically
 * invalidates all stale entries.
 */

const DB_NAME    = "nutritwin_voice_previews";
const STORE_NAME = "previews";
const DB_VERSION = 1;

/**
 * Bump this string whenever the preview phrase or the voice catalogue changes.
 * Old entries will simply be ignored (they share the same IDB store but are
 * keyed differently, so they become unreachable dead weight until the user
 * clears browser data).
 */
export const CACHE_VERSION = "v4";

/** Phrase utilisée pour générer et lire le cache — ne pas modifier sans bumper CACHE_VERSION. */
export const PREVIEW_TEXT = "Bonjour, je suis à vos côtés pour vous accompagner aujourd'hui.";

export type PreviewChunk = { data: string; rate: number };

// ─── Internal helpers ─────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function cacheKey(voiceId: string): string {
  return `${CACHE_VERSION}_${voiceId}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Persist the PCM16 chunks for a voice to IndexedDB.
 * Silently swallows errors (IDB might be unavailable in some contexts).
 */
export async function savePreview(
  voiceId: string,
  chunks: PreviewChunk[],
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(chunks, cacheKey(voiceId));
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* silently ignore — preview still works via live WS fallback */
  }
}

/**
 * Load cached PCM16 chunks for a single voice.
 * Returns null if not found or on error.
 */
export async function loadPreview(
  voiceId: string,
): Promise<PreviewChunk[] | null> {
  try {
    const db     = await openDB();
    const result = await new Promise<PreviewChunk[] | null>((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(cacheKey(voiceId));
      req.onsuccess = () => resolve((req.result as PreviewChunk[]) ?? null);
      req.onerror   = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

/**
 * Load cached PCM16 chunks for all given voice IDs in a single transaction.
 * Returns a Map keyed by voiceId for the entries that were found.
 */
export async function loadAllPreviews(
  voiceIds: string[],
): Promise<Map<string, PreviewChunk[]>> {
  const map = new Map<string, PreviewChunk[]>();
  if (voiceIds.length === 0) return map;
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx    = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      let pending = voiceIds.length;
      const done  = () => { if (--pending === 0) resolve(); };
      for (const id of voiceIds) {
        const req     = store.get(cacheKey(id));
        req.onsuccess = () => {
          if (req.result) map.set(id, req.result as PreviewChunk[]);
          done();
        };
        req.onerror   = () => done();
      }
    });
    db.close();
  } catch {
    /* return whatever was collected */
  }
  return map;
}
