const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

interface ColorPickerProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
}

export function ColorPicker({ selectedColor, onSelectColor }: ColorPickerProps) {
  return (
    <div className="flex gap-1.5 items-center px-1">
      {COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onSelectColor(color)}
          className="w-7 h-7 rounded-full transition-all duration-200 hover:scale-130"
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
  );
}

export { COLORS };
