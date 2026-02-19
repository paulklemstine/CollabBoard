import { useState, useCallback } from 'react';
import { Grid } from '@giphy/react-components';
import { GiphyFetch } from '@giphy/js-fetch-api';
import type { IGif } from '@giphy/js-types';

const apiKey = import.meta.env.VITE_GIPHY_API_KEY ?? '';
const gf = apiKey ? new GiphyFetch(apiKey) : null;

function getGifUrl(gif: IGif): string {
  const img = gif.images?.fixed_height ?? gif.images?.fixed_width ?? gif.images?.original;
  return (img && 'url' in img ? img.url : (gif.images?.original as { url?: string })?.url) ?? '';
}

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose?: () => void;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [search, setSearch] = useState('');

  const fetchTrending = useCallback(
    (offset: number) => (gf ? gf.trending({ limit: 12, offset, type: 'stickers' }) : Promise.resolve({ data: [], meta: { msg: '', response_id: '', status: 0 }, pagination: { count: 0, total_count: 0, offset: 0 } })),
    []
  );

  const fetchSearch = useCallback(
    (offset: number) =>
      gf && search.trim()
        ? gf.search(search.trim(), { limit: 12, offset, type: 'stickers' })
        : fetchTrending(offset),
    [search, fetchTrending]
  );

  const handleGifClick = useCallback(
    (gif: IGif) => {
      const url = getGifUrl(gif);
      if (url) {
        onSelect(url);
        onClose?.();
      }
    },
    [onSelect, onClose]
  );

  if (!apiKey) {
    return (
      <div className="rounded-xl p-6 text-center max-w-sm" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.15) 100%)', border: '1.5px solid rgba(16, 185, 129, 0.3)' }}>
        <p className="text-sm text-gray-700 font-medium mb-2">Add animated stickers with GIPHY</p>
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
        placeholder="Search stickers..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm border border-green-200 focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none"
        aria-label="Search GIPHY stickers"
      />
      <div className="overflow-y-auto max-h-[280px] rounded-lg overflow-x-hidden" style={{ width: 320 }}>
        <Grid
          key={search || 'trending'}
          width={320}
          columns={3}
          gutter={6}
          fetchGifs={search.trim() ? fetchSearch : fetchTrending}
          onGifClick={(gif, e) => {
            e.preventDefault();
            handleGifClick(gif);
          }}
          noLink
          borderRadius={8}
        />
      </div>
    </div>
  );
}
