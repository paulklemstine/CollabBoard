import { useState } from 'react';
import { FancyColorPicker } from './FancyColorPicker';

interface ColorDrawerProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
}

// Convert hex to HSL, rotate hue by 180° and invert lightness for maximum contrast
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

  // Invert lightness for maximum contrast
  // If original is light (>0.5), make dark; if dark, make light
  const l2 = l > 0.5 ? 0.2 : 0.9;

  // Keep saturation high for vibrant text
  const s2 = Math.max(s, 0.7);

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
  if (s2 === 0) {
    r2 = g2 = b2 = l2;
  } else {
    const q = l2 < 0.5 ? l2 * (1 + s2) : l2 + s2 - l2 * s2;
    const p = 2 * l2 - q;
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
          <div className="glass-playful rounded-2xl shadow-2xl">
            <FancyColorPicker selectedColor={selectedColor} onSelectColor={onSelectColor} />
          </div>
        </div>
      )}
    </div>
  );
}
