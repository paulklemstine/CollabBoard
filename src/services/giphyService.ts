import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export interface GiphyGif {
  id: string;
  title?: string;
  images?: {
    fixed_height?: { url?: string };
    fixed_height_small?: { url?: string };
    fixed_width?: { url?: string };
    original?: { url?: string };
  };
}

interface CacheDoc {
  query: string;
  limit: number;
  status: 'pending' | 'complete' | 'error';
  results?: GiphyGif[];
  cachedAt?: number;
  error?: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache to avoid repeated Firestore reads within the same session
const memCache = new Map<string, { results: GiphyGif[]; ts: number }>();

/** Normalize query to use as Firestore doc ID */
function cacheKey(query: string, limit: number): string {
  return `${query.toLowerCase().trim().replace(/\s+/g, '_')}__${limit}`;
}

/**
 * Search GIPHY stickers via server-side Firestore cache.
 * 1. Check in-memory cache
 * 2. Check Firestore cache (giphyCache/{key})
 * 3. If miss, write a pending doc → Cloud Function trigger fetches from GIPHY → writes results
 * 4. Listen via onSnapshot for results
 */
export async function searchGiphy(query: string, limit = 18): Promise<GiphyGif[]> {
  const q = query.trim();
  if (!q) return [];

  const key = cacheKey(q, limit);

  // 1. In-memory cache hit
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.ts < CACHE_TTL_MS) {
    return mem.results;
  }

  const docRef = doc(db, 'giphyCache', key);

  // 2. Firestore cache hit
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as CacheDoc;
      if (data.status === 'complete' && data.results && data.cachedAt &&
          Date.now() - data.cachedAt < CACHE_TTL_MS) {
        memCache.set(key, { results: data.results, ts: data.cachedAt });
        return data.results;
      }
      // If there's already a pending request, wait for it
      if (data.status === 'pending') {
        return waitForResults(docRef, key);
      }
    }
  } catch {
    // Firestore read failed, continue to create request
  }

  // 3. Cache miss — write pending request for Cloud Function trigger
  try {
    await setDoc(docRef, {
      query: q,
      limit,
      status: 'pending',
      requestedAt: Date.now(),
    });
  } catch {
    // If write fails (e.g. permissions), return empty
    return [];
  }

  // 4. Listen for results
  return waitForResults(docRef, key);
}

function waitForResults(
  docRef: ReturnType<typeof doc>,
  key: string,
): Promise<GiphyGif[]> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      unsub();
      resolve([]);
    }, 15_000);

    const unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as CacheDoc;

      if (data.status === 'complete' && data.results) {
        clearTimeout(timeout);
        unsub();
        memCache.set(key, { results: data.results, ts: data.cachedAt ?? Date.now() });
        resolve(data.results);
      } else if (data.status === 'error') {
        clearTimeout(timeout);
        unsub();
        resolve([]);
      }
    });
  });
}
