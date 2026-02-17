const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];

interface ColorPickerProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
}

export function ColorPicker({ selectedColor, onSelectColor }: ColorPickerProps) {
  return (
    <div className="flex gap-1 items-center px-2">
      {COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onSelectColor(color)}
          className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
          style={{
            backgroundColor: color,
            borderColor: selectedColor === color ? '#1e293b' : 'transparent',
          }}
          title={color}
        />
      ))}
    </div>
  );
}

export { COLORS };
