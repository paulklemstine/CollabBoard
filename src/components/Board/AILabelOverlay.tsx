import { Group, Rect, Text } from 'react-konva';

interface AILabelOverlayProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

const PILL_HEIGHT = 22;
const PILL_PADDING_X = 10;
const FONT_SIZE = 12;
const PILL_COLOR = '#4f46e5';
const TEXT_COLOR = '#ffffff';
const PILL_RADIUS = 6;
const GAP = 6;

export function AILabelOverlay({ x, y, width, height, label }: AILabelOverlayProps) {
  // Estimate text width: roughly 7px per character at 12px font
  const textWidth = label.length * 7;
  const pillWidth = textWidth + PILL_PADDING_X * 2;

  // Center the pill below the object
  const pillX = x + width / 2 - pillWidth / 2;
  const pillY = y + height + GAP;

  return (
    <Group listening={false}>
      <Rect
        x={pillX}
        y={pillY}
        width={pillWidth}
        height={PILL_HEIGHT}
        fill={PILL_COLOR}
        cornerRadius={PILL_RADIUS}
        opacity={0.85}
      />
      <Text
        x={pillX}
        y={pillY}
        width={pillWidth}
        height={PILL_HEIGHT}
        text={label}
        fontSize={FONT_SIZE}
        fontFamily="'Inter', sans-serif"
        fill={TEXT_COLOR}
        align="center"
        verticalAlign="middle"
      />
    </Group>
  );
}
