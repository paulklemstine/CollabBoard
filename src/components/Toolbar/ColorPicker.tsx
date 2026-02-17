const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];

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
          className="w-6 h-6 rounded-full transition-all duration-200 hover:scale-125"
          style={{
            backgroundColor: color,
            boxShadow: selectedColor === color
              ? `0 0 0 2px white, 0 0 0 4px ${color}, 0 0 12px ${color}50`
              : `0 1px 3px ${color}40`,
          }}
          title={color}
        />
      ))}
    </div>
  );
}

export { COLORS };
