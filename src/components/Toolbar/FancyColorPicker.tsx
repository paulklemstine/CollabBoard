import { useState, useRef, useEffect } from 'react';

interface FancyColorPickerProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
}

// Convert HSV to RGB
const hsvToRgb = (h: number, s: number, v: number): { r: number; g: number; b: number } => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
};

// Convert RGB to hex
const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

export function FancyColorPicker({ selectedColor, onSelectColor }: FancyColorPickerProps) {
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [brightness, setBrightness] = useState(90);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw color wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 2;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw color wheel
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 90) * Math.PI / 180;
      const endAngle = (angle + 1 - 90) * Math.PI / 180;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      const rgb = hsvToRgb(angle, 1, 1);
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.fill();
    }

    // Draw white center circle for desaturation
    const innerRadius = radius * 0.3;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, innerRadius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = canvas.width / 2 - 2;

    if (distance > maxRadius) return;

    // Calculate hue from angle
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    angle = (angle + 90 + 360) % 360;
    setHue(angle);

    // Calculate saturation from distance
    const sat = Math.min(distance / maxRadius, 1) * 100;
    setSaturation(sat);

    // Generate color
    const rgb = hsvToRgb(angle, sat / 100, brightness / 100);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    onSelectColor(hex);
  };

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const bright = parseInt(e.target.value);
    setBrightness(bright);

    const rgb = hsvToRgb(hue, saturation / 100, bright / 100);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    onSelectColor(hex);
  };

  const currentColor = rgbToHex(
    ...Object.values(hsvToRgb(hue, saturation / 100, brightness / 100))
  );

  const presetColors = [
    '#fecaca', '#fed7aa', '#fef08a', '#bbf7d0',
    '#bfdbfe', '#ddd6fe', '#fbcfe8', '#a5f3fc',
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'
  ];

  return (
    <div className="flex flex-col gap-4 p-4 w-72">
      {/* Color Wheel */}
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={200}
          height={200}
          onClick={handleCanvasClick}
          className="cursor-crosshair rounded-full shadow-lg"
          style={{ imageRendering: 'crisp-edges' }}
        />
      </div>

      {/* Brightness Slider */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-gray-600">Brightness</label>
        <input
          type="range"
          min="0"
          max="100"
          value={brightness}
          onChange={handleBrightnessChange}
          className="w-full h-3 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, black, ${rgbToHex(...Object.values(hsvToRgb(hue, saturation / 100, 1)))})`,
          }}
        />
      </div>

      {/* Current Color Display */}
      <div className="flex items-center gap-3">
        <div
          className="w-16 h-16 rounded-xl shadow-lg border-2 border-white"
          style={{ backgroundColor: currentColor }}
        />
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-gray-500">Selected</span>
          <span className="text-sm font-mono font-bold text-gray-700">{currentColor}</span>
        </div>
      </div>

      {/* Preset Colors */}
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-2 block">Presets</label>
        <div className="grid grid-cols-8 gap-2">
          {presetColors.map((color) => (
            <button
              key={color}
              onClick={() => onSelectColor(color)}
              className="w-8 h-8 rounded-lg transition-all duration-200 hover:scale-110 shadow-md"
              style={{
                backgroundColor: color,
                border: selectedColor === color ? '2.5px solid #6366f1' : '2px solid rgba(255,255,255,0.6)',
              }}
              title={color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
