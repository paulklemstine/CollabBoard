import { useState, useRef, useCallback, useEffect } from 'react';

interface FancyColorPickerProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
}

// --- Color conversion utilities ---

const hsvToRgb = (h: number, s: number, v: number): [number, number, number] => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};

const rgbToHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0];
};

const rgbToHsv = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else                h = ((r - g) / d + 4) * 60;
  }
  return [h, max === 0 ? 0 : d / max, max];
};

export function FancyColorPicker({ selectedColor, onSelectColor }: FancyColorPickerProps) {
  // Use refs for HSV so drag handlers always see current values
  const hRef = useRef(0);
  const sRef = useRef(100);
  const vRef = useRef(100);
  const [, bump] = useState(0);
  const rerender = useCallback(() => bump(n => n + 1), []);

  const onSelectRef = useRef(onSelectColor);
  onSelectRef.current = onSelectColor;

  const [hexInput, setHexInput] = useState(selectedColor);

  // Sync from prop
  useEffect(() => {
    const [r, g, b] = hexToRgb(selectedColor);
    const [h, s, v] = rgbToHsv(r, g, b);
    hRef.current = h;
    sRef.current = s * 100;
    vRef.current = v * 100;
    setHexInput(selectedColor);
    rerender();
  }, [selectedColor, rerender]);

  const emitColor = useCallback(() => {
    const [r, g, b] = hsvToRgb(hRef.current, sRef.current / 100, vRef.current / 100);
    const hex = rgbToHex(r, g, b);
    setHexInput(hex);
    onSelectRef.current(hex);
  }, []);

  // --- SV area drag ---
  const handleSVPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const area = e.currentTarget;
    area.setPointerCapture(e.pointerId);

    const update = (ev: { clientX: number; clientY: number }) => {
      const rect = area.getBoundingClientRect();
      const x = Math.max(0, Math.min(ev.clientX - rect.left, rect.width));
      const y = Math.max(0, Math.min(ev.clientY - rect.top, rect.height));
      sRef.current = (x / rect.width) * 100;
      vRef.current = (1 - y / rect.height) * 100;
      emitColor();
      rerender();
    };
    update(e);

    const onMove = (ev: PointerEvent) => update(ev);
    const onUp = () => {
      area.removeEventListener('pointermove', onMove);
      area.removeEventListener('pointerup', onUp);
    };
    area.addEventListener('pointermove', onMove);
    area.addEventListener('pointerup', onUp);
  }, [emitColor, rerender]);

  // --- Hue bar drag ---
  const handleHuePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const bar = e.currentTarget;
    bar.setPointerCapture(e.pointerId);

    const update = (ev: { clientX: number }) => {
      const rect = bar.getBoundingClientRect();
      const x = Math.max(0, Math.min(ev.clientX - rect.left, rect.width));
      hRef.current = (x / rect.width) * 360;
      emitColor();
      rerender();
    };
    update(e);

    const onMove = (ev: PointerEvent) => update(ev);
    const onUp = () => {
      bar.removeEventListener('pointermove', onMove);
      bar.removeEventListener('pointerup', onUp);
    };
    bar.addEventListener('pointermove', onMove);
    bar.addEventListener('pointerup', onUp);
  }, [emitColor, rerender]);

  // --- Hex input ---
  const handleHexSubmit = useCallback(() => {
    const cleaned = hexInput.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      onSelectRef.current(cleaned.toLowerCase());
    } else if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
      onSelectRef.current('#' + cleaned.toLowerCase());
    } else {
      const [r, g, b] = hsvToRgb(hRef.current, sRef.current / 100, vRef.current / 100);
      setHexInput(rgbToHex(r, g, b));
    }
  }, [hexInput]);

  const hue = hRef.current;
  const sat = sRef.current;
  const val = vRef.current;
  const [cr, cg, cb] = hsvToRgb(hue, sat / 100, val / 100);
  const currentColor = rgbToHex(cr, cg, cb);

  return (
    <div className="flex flex-col gap-3 p-3.5" style={{ width: 224 }}>
      {/* Saturation-Value area */}
      <div
        className="relative h-[148px] rounded-xl overflow-hidden select-none touch-none"
        style={{ background: `hsl(${Math.round(hue)}, 100%, 50%)` }}
        onPointerDown={handleSVPointerDown}
      >
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent, #000)' }} />
        {/* Cursor */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white pointer-events-none"
          style={{
            left: `${sat}%`,
            top: `${100 - val}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.25)',
          }}
        />
      </div>

      {/* Hue bar */}
      <div
        className="relative h-3 rounded-full select-none touch-none"
        style={{
          background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        }}
        onPointerDown={handleHuePointerDown}
      >
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white pointer-events-none"
          style={{
            left: `${(hue / 360) * 100}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: `hsl(${Math.round(hue)}, 100%, 50%)`,
            boxShadow: '0 0 0 1px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.25)',
          }}
        />
      </div>

      {/* Preview + hex input */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-lg flex-shrink-0"
          style={{
            background: currentColor,
            boxShadow: `0 0 0 1.5px rgba(0,0,0,0.06), 0 2px 6px ${currentColor}40`,
          }}
        />
        <div className="flex-1 flex items-center bg-white/50 border border-violet-200/60 rounded-lg overflow-hidden">
          <span className="pl-2.5 text-[10px] font-bold text-gray-400 select-none">#</span>
          <input
            type="text"
            value={hexInput.replace('#', '').toUpperCase()}
            onChange={(e) => setHexInput('#' + e.target.value)}
            onBlur={handleHexSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
            className="flex-1 bg-transparent px-1 py-1.5 text-xs font-mono font-semibold text-gray-700 outline-none uppercase w-0"
            maxLength={6}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
