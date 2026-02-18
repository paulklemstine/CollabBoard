import { useState } from 'react';

interface StickerDrawerProps {
  onAddSticker: (emoji: string) => void;
}

export function StickerDrawer({ onAddSticker }: StickerDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const stickers = ['👍', '❤️', '🎉', '⭐', '🔥', '😊', '🚀', '💡', '✨', '🎯'];

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
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
          <div className="glass-playful rounded-2xl shadow-2xl p-5 flex gap-4">
            {stickers.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onAddSticker(emoji)}
                className="flex items-center justify-center w-16 h-16 rounded-xl transition-all duration-200 hover:scale-110"
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.2) 100%)',
                  border: '1.5px solid rgba(16, 185, 129, 0.3)',
                }}
                title={`Add ${emoji}`}
              >
                <span style={{ fontSize: '36px' }}>{emoji}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
