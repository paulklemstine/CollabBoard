import { useState } from 'react';
import { ColorPicker, COLORS } from './ColorPicker';
import type { ShapeType } from '../../types/board';

const EMOJI_OPTIONS = ['👍', '❤️', '⭐', '🔥', '✅', '❌', '❓', '💡'];

interface ToolbarProps {
  onAddStickyNote: () => void;
  onAddShape: (shapeType: ShapeType, color: string) => void;
  onAddFrame: () => void;
  onAddSticker: (emoji: string) => void;
  connectMode: boolean;
  connectingFrom: string | null;
  onToggleConnectMode: () => void;
}

export function Toolbar({
  onAddStickyNote,
  onAddShape,
  onAddFrame,
  onAddSticker,
  connectMode,
  connectingFrom,
  onToggleConnectMode,
}: ToolbarProps) {
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const connectLabel = connectMode
    ? connectingFrom
      ? 'Click target...'
      : 'Click source...'
    : 'Connect';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        pointerEvents: 'auto',
      }}
      className="flex gap-2 bg-white rounded-lg shadow-lg p-2 items-center"
    >
      <button
        onClick={() => onAddStickyNote()}
        className="flex items-center gap-1 px-3 py-2 bg-yellow-200 hover:bg-yellow-300 rounded-md text-sm font-medium transition-colors"
        title="Add sticky note"
      >
        <span className="text-lg">+</span> Sticky
      </button>

      <div className="w-px h-8 bg-gray-200" />

      <ColorPicker selectedColor={selectedColor} onSelectColor={setSelectedColor} />

      <button
        onClick={() => onAddShape('rect', selectedColor)}
        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
        title="Add rectangle"
      >
        Rect
      </button>
      <button
        onClick={() => onAddShape('circle', selectedColor)}
        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
        title="Add circle"
      >
        Circle
      </button>

      <div className="w-px h-8 bg-gray-200" />

      <button
        onClick={() => onAddFrame()}
        className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded-md text-sm font-medium transition-colors"
        title="Add frame"
      >
        Frame
      </button>

      <div className="w-px h-8 bg-gray-200" />

      <div className="relative">
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="px-3 py-2 bg-orange-100 hover:bg-orange-200 rounded-md text-sm font-medium transition-colors"
          title="Add sticker"
        >
          Sticker
        </button>
        {showEmojiPicker && (
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-lg p-2 flex gap-1">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onAddSticker(emoji);
                  setShowEmojiPicker(false);
                }}
                className="text-2xl hover:bg-gray-100 rounded p-1 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-8 bg-gray-200" />

      <button
        onClick={onToggleConnectMode}
        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          connectMode
            ? 'bg-indigo-500 text-white hover:bg-indigo-600'
            : 'bg-gray-100 hover:bg-gray-200'
        }`}
        title="Connect objects"
      >
        {connectLabel}
      </button>
    </div>
  );
}
