import { useState, useEffect, useRef, useCallback } from 'react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import type { IGif } from '@giphy/js-types';

const apiKey = import.meta.env.VITE_GIPHY_API_KEY ?? '';
const gf = apiKey ? new GiphyFetch(apiKey) : null;

function getGifUrl(gif: IGif): string {
  const img = gif.images?.fixed_height ?? gif.images?.fixed_width ?? gif.images?.original;
  return (img && 'url' in img ? img.url : (gif.images?.original as { url?: string })?.url) ?? '';
}

function getPreviewUrl(gif: IGif): string {
  const img = gif.images?.fixed_height_small ?? gif.images?.fixed_height ?? gif.images?.original;
  return (img && 'url' in img ? img.url : '') || getGifUrl(gif);
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose?: () => void;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<IGif[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGifs = useCallback(async (query: string, retries = 2) => {
    if (!gf) return;
    setLoading(true);
    setError(false);
    const q = query.trim() || 'kittens';
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await gf.search(q, { limit: 18, type: 'stickers' });
        setGifs(res.data);
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

  // Fetch on mount and when search changes (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchGifs(search), search ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, fetchGifs]);

  if (!apiKey) {
    return (
      <div className="rounded-xl p-6 text-center max-w-sm" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.15) 100%)', border: '1.5px solid rgba(16, 185, 129, 0.3)' }}>
        <p className="text-sm text-gray-700 font-medium mb-2">Spice up your board with animated stickers</p>
        <p className="text-xs text-gray-600 mb-3">Set <code className="bg-black/10 px-1 rounded">VITE_GIPHY_API_KEY</code> in your <code className="bg-black/10 px-1 rounded">.env</code> file.</p>
        <a
          href="https://developers.giphy.com/dashboard/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-bold text-green-700 hover:underline"
        >
          Get a free API key →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        placeholder="Find the perfect vibe..."
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
            <p className="text-sm text-gray-500 mb-2">GIFs went AWOL</p>
            <button
              onClick={() => fetchGifs(search)}
              className="text-sm font-bold text-green-700 hover:underline"
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && gifs.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-500">No matches — try something wilder</div>
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
    </div>
  );
}
