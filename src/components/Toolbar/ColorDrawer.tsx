import { useState } from 'react';
import { COLORS } from './ColorPicker';

interface ColorDrawerProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
}

// Convert hex to HSL, rotate hue by 180°, convert back to hex
const getComplementaryColor = (hex: string): string => {
  // Remove # if present
  hex = hex.replace('#', '');

  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Convert RGB to HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);

  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / (max - min) + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / (max - min) + 2) / 6; break;
      case b: h = ((r - g) / (max - min) + 4) / 6; break;
    }
  }

  // Rotate hue by 180° (complementary color)
  h = (h + 0.5) % 1;

  // Convert HSL back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r2, g2, b2;
  if (s === 0) {
    r2 = g2 = b2 = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r2 = hue2rgb(p, q, h + 1/3);
    g2 = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1/3);
  }

  // Convert RGB back to hex
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
};

export function ColorDrawer({ selectedColor, onSelectColor }: ColorDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState('#000000');

  const textColor = getComplementaryColor(selectedColor);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* Trigger Button */}
      <button
        className="btn-lift px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
        style={{
          background: `linear-gradient(135deg, ${selectedColor}dd 0%, ${selectedColor} 50%, ${selectedColor}dd 100%)`,
          boxShadow: `0 2px 10px ${selectedColor}60`,
          color: textColor,
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}
        title="Colors"
      >
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
          </svg>
          Colors
        </div>
      </button>

      {/* Drawer */}
      {isOpen && (
        <div
          className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 animate-bounce-in"
          style={{ zIndex: 1001 }}
        >
          <div className="glass-playful rounded-2xl shadow-2xl p-3">
            {/* Default Colors */}
            <div className="flex gap-2 items-center mb-3 pb-3 border-b border-white/20">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onSelectColor(color)}
                  className="w-8 h-8 rounded-full transition-all duration-200 hover:scale-125"
                  style={{
                    backgroundColor: color,
                    boxShadow: selectedColor === color
                      ? `0 0 0 2.5px white, 0 0 0 5px ${color}, 0 0 16px ${color}60`
                      : `0 2px 6px ${color}30, inset 0 -1px 2px rgba(0,0,0,0.1)`,
                    border: '2px solid rgba(255,255,255,0.6)',
                  }}
                  title={color}
                />
              ))}
            </div>

            {/* Custom Color Picker */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Custom</span>
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  onSelectColor(e.target.value);
                }}
                className="w-24 h-24 cursor-pointer rounded-lg border-2 border-white/50"
                style={{ colorScheme: 'light' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
