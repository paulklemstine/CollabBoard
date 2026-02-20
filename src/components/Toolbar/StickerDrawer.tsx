import { useState, useRef, useCallback } from 'react';
import { GifPicker } from './GifPicker';

type StickerTab = 'emoji' | 'gif';

interface StickerDrawerProps {
  onAddSticker: (emoji: string) => void;
  onAddGifSticker?: (gifUrl: string) => void;
}

export function StickerDrawer({ onAddSticker, onAddGifSticker }: StickerDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<StickerTab>('emoji');
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabSwitchGuard = useRef(false);

  const handleMouseEnter = useCallback(() => {
    if (closeTimeout.current) { clearTimeout(closeTimeout.current); closeTimeout.current = null; }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (tabSwitchGuard.current) return; // suppress close during tab resize
    closeTimeout.current = setTimeout(() => setIsOpen(false), 200);
  }, []);

  const switchTab = useCallback((newTab: StickerTab) => {
    if (closeTimeout.current) { clearTimeout(closeTimeout.current); closeTimeout.current = null; }
    tabSwitchGuard.current = true;
    setTab(newTab);
    setTimeout(() => { tabSwitchGuard.current = false; }, 400);
  }, []);

  // Comprehensive emoji list organized by category
  const allStickers = [
    // Smileys & Emotion
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
    '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
    '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
    '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
    '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
    '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓',
    '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺',
    '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
    '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈',
    '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾',
    // Gestures & People
    '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘',
    '👌', '🤏', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐',
    '✋', '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅',
    '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠',
    // Hearts & Symbols
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
    '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
    '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
    '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳',
    // Objects & Activities
    '🎉', '🎊', '🎈', '🎀', '🎁', '🎂', '🎄', '🎃', '🎆', '🎇',
    '🧨', '✨', '🎋', '🎍', '🎎', '🎏', '🎐', '🎑', '🧧', '🎖',
    '🏆', '🏅', '🥇', '🥈', '🥉', '⚽', '⚾', '🥎', '🏀', '🏐',
    '🏈', '🏉', '🎾', '🥏', '🎳', '🏏', '🏑', '🏒', '🥍', '🏓',
    '🏸', '🥊', '🥋', '🥅', '⛳', '⛸', '🎣', '🤿', '🎽', '🎿',
    // Nature & Animals
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
    '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
    '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
    '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
    '🌸', '💐', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱', '🌲',
    '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃',
    // Food & Drink
    '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏',
    '🍐', '🍑', '🍒', '🍓', '🥝', '🍅', '🥥', '🥑', '🍆', '🥔',
    '🥕', '🌽', '🌶', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜',
    '🌰', '🍞', '🥐', '🥖', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖',
    '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯',
    // Tech & Tools
    '⌚', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹',
    '🗜', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽',
    '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛',
    '🧭', '⏱', '⏲', '⏰', '🕰', '⌛', '⏳', '📡', '🔋', '🔌',
    '💡', '🔦', '🕯', '🧯', '🛢', '💸', '💵', '💴', '💶', '💷',
    // Common Symbols
    '⭐', '🌟', '✨', '⚡', '☄️', '💥', '🔥', '🌈', '☀️', '🌤',
    '⛅', '🌥', '☁️', '🌦', '🌧', '⛈', '🌩', '🌨', '❄️', '☃️',
    '⛄', '🌬', '💨', '💧', '💦', '☔', '☂️', '🌊', '🌫', '🌪',
    '🚀', '🛸', '🛰', '💺', '🚁', '🛶', '⛵', '🚤', '🛥', '🛳',
    '⚓', '🪝', '⛽', '🚧', '🚦', '🚥', '🗺', '🗿', '🗽', '🗼',
    // Arrows & Shapes
    '✅', '❌', '⭕', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤',
    '⚫', '⚪', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬛',
    '⬜', '◼️', '◻️', '◾', '◽', '▪️', '▫️', '🔶', '🔷', '🔸',
    '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲', '🏁', '🚩', '🎌',
  ];

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(allStickers.length / ITEMS_PER_PAGE);
  const startIndex = page * ITEMS_PER_PAGE;
  const visibleStickers = allStickers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger Button */}
      <button
        className="btn-lift px-3.5 py-2.5 rounded-xl text-sm font-bold text-green-700 transition-all duration-200"
        style={{
          background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 50%, #6ee7b7 100%)',
          boxShadow: '0 2px 10px rgba(16, 185, 129, 0.25)',
        }}
        title="Stickers"
      >
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: '16px' }}>😊</span>
          Stickers
        </div>
      </button>

      {/* Drawer */}
      {isOpen && (
        <div
          className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 animate-bounce-in"
          style={{ zIndex: 1001 }}
        >
          <div className="glass-playful rounded-2xl shadow-2xl p-5">
            {/* Tabs: Emoji | GIFs */}
            <div className="flex gap-1 mb-3 rounded-xl p-0.5" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.25) 100%)' }}>
              <button
                type="button"
                onClick={() => switchTab('emoji')}
                className="flex-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: tab === 'emoji' ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' : 'transparent',
                  color: tab === 'emoji' ? '#065f46' : '#047857',
                }}
              >
                😊 Emoji
              </button>
              <button
                type="button"
                onClick={() => switchTab('gif')}
                className="flex-1 px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: tab === 'gif' ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' : 'transparent',
                  color: tab === 'gif' ? '#065f46' : '#047857',
                }}
              >
                ✨ GIFs
              </button>
            </div>

            {tab === 'gif' && onAddGifSticker ? (
              <GifPicker
                onSelect={onAddGifSticker}
                onClose={() => setIsOpen(false)}
              />
            ) : (
            <>
            <div className="flex items-center gap-2">
              {/* Left Arrow */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPage((p) => Math.max(0, p - 1));
                }}
                disabled={page === 0}
                className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.3) 100%)',
                  border: '1.5px solid rgba(16, 185, 129, 0.4)',
                }}
                title="Previous page"
              >
                <span style={{ fontSize: '20px' }}>←</span>
              </button>

              {/* Sticker Grid */}
              <div className="flex gap-3">
                {visibleStickers.map((emoji, index) => (
                  <button
                    key={`${emoji}-${startIndex + index}`}
                    onClick={() => {
                      onAddSticker(emoji);
                      setIsOpen(false);
                    }}
                    className="flex items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 hover:scale-110"
                    style={{
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.2) 100%)',
                      border: '1.5px solid rgba(16, 185, 129, 0.3)',
                    }}
                    title={`Add ${emoji}`}
                  >
                    <span style={{ fontSize: '32px' }}>{emoji}</span>
                  </button>
                ))}
              </div>

              {/* Right Arrow */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPage((p) => Math.min(totalPages - 1, p + 1));
                }}
                disabled={page === totalPages - 1}
                className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.3) 100%)',
                  border: '1.5px solid rgba(16, 185, 129, 0.4)',
                }}
                title="Next page"
              >
                <span style={{ fontSize: '20px' }}>→</span>
              </button>
            </div>

            {/* Page Indicator */}
            <div className="mt-2 text-center text-xs text-gray-600 font-medium">
              Page {page + 1} of {totalPages}
            </div>
            </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
