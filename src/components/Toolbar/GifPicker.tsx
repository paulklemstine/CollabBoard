import { useState, useEffect, useRef, useCallback } from 'react';

interface GiphyImage {
  url?: string;
}

interface GiphyGif {
  id: string;
  title?: string;
  images?: {
    fixed_height?: GiphyImage;
    fixed_height_small?: GiphyImage;
    fixed_width?: GiphyImage;
    original?: GiphyImage;
  };
}

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY as string;

async function searchGiphyDirect(query: string, limit = 18): Promise<GiphyGif[]> {
  const url = `https://api.giphy.com/v1/stickers/search?api_key=${encodeURIComponent(GIPHY_API_KEY)}&q=${encodeURIComponent(query)}&limit=${limit}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`GIPHY ${resp.status}`);
  const json = await resp.json();
  return json.data ?? [];
}

// Module-level preload: fires immediately on import, retries until success.
// By the time a user opens the GIF drawer, results are already cached.
const DEFAULT_QUERY = 'kittens';
let preloadedGifs: GiphyGif[] | null = null;
let preloadPromise: Promise<GiphyGif[]> | null = null;

function preloadDefaultGifs(): Promise<GiphyGif[]> {
  if (preloadedGifs) return Promise.resolve(preloadedGifs);
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const data = await searchGiphyDirect(DEFAULT_QUERY);
        preloadedGifs = data;
        return data;
      } catch {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    preloadPromise = null; // allow retry on next call
    return [];
  })();
  return preloadPromise;
}

// Kick off preload immediately
preloadDefaultGifs();

function getGifUrl(gif: GiphyGif): string {
  const img = gif.images?.fixed_height ?? gif.images?.fixed_width ?? gif.images?.original;
  return img?.url ?? gif.images?.original?.url ?? '';
}

function getPreviewUrl(gif: GiphyGif): string {
  const img = gif.images?.fixed_height_small ?? gif.images?.fixed_height ?? gif.images?.original;
  return img?.url || getGifUrl(gif);
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose?: () => void;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>(() => preloadedGifs ?? []);
  const [loading, setLoading] = useState(!preloadedGifs);
  const [error, setError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGifs = useCallback(async (query: string, retries = 2) => {
    const q = query.trim() || DEFAULT_QUERY;

    // If this is the default query and we have preloaded data, use it
    if (q === DEFAULT_QUERY && preloadedGifs) {
      setGifs(preloadedGifs);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);

    // If default query, wait for the in-flight preload
    if (q === DEFAULT_QUERY && preloadPromise) {
      const result = await preloadPromise;
      if (result.length > 0) {
        setGifs(result);
        setLoading(false);
        return;
      }
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const data = await searchGiphyDirect(q);
        setGifs(data);
        setLoading(false);
        return;
      } catch {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }
    setError(true);
    setLoading(false);
  }, []);

  // On mount: if preload hasn't resolved yet, wait for it
  useEffect(() => {
    if (preloadedGifs && !search) {
      setGifs(preloadedGifs);
      setLoading(false);
      return;
    }
    if (!search && preloadPromise) {
      let cancelled = false;
      preloadPromise.then((result) => {
        if (!cancelled && result.length > 0) {
          setGifs(result);
          setLoading(false);
        } else if (!cancelled) {
          fetchGifs('');
        }
      });
      return () => { cancelled = true; };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch when search changes (debounced), skip empty (handled by mount effect)
  useEffect(() => {
    if (!search) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchGifs(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, fetchGifs]);

  // When search is cleared, restore default results
  useEffect(() => {
    if (search === '' && preloadedGifs) {
      setGifs(preloadedGifs);
      setLoading(false);
      setError(false);
    } else if (search === '') {
      fetchGifs('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        placeholder="Search stickers..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm border border-green-200 focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none"
        aria-label="Search GIPHY stickers"
      />
      <div className="overflow-y-auto max-h-[280px] rounded-lg" style={{ width: 320 }}>
        {loading && gifs.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-green-300 border-t-green-600 animate-spin" />
          </div>
        )}
        {error && (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500 mb-2">Failed to load stickers</p>
            <button
              onClick={() => fetchGifs(search)}
              className="text-sm font-bold text-green-700 hover:underline"
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && gifs.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-500">No results found</div>
        )}
        {gifs.length > 0 && (
          <div className="grid grid-cols-3 gap-1.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => {
                  const url = getGifUrl(gif);
                  if (url) {
                    onSelect(url);
                    onClose?.();
                  }
                }}
                className="rounded-lg overflow-hidden hover:ring-2 hover:ring-green-400 transition-all hover:scale-105 bg-green-50/50"
                style={{ aspectRatio: '1' }}
              >
                <img
                  src={getPreviewUrl(gif)}
                  alt={gif.title || 'GIF sticker'}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
      <a
        href="https://giphy.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-end gap-1 opacity-60 hover:opacity-100 transition-opacity"
      >
        <span className="text-[10px] text-gray-500 font-medium">Powered by</span>
        <img
          src="https://giphy.com/static/img/giphy_logo_square_social.png"
          alt="GIPHY"
          className="h-3.5"
        />
      </a>
    </div>
  );
}
