import { Group, Rect, Text } from 'react-konva';

interface AILabelOverlayProps {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  groupId?: string;
}

const PILL_HEIGHT = 22;
const PILL_PADDING_X = 10;
const FONT_SIZE = 12;
const PILL_COLOR = '#4f46e5';
const GROUP_COLOR = '#6d28d9';
const TEXT_COLOR = '#ffffff';
const PILL_RADIUS = 6;
const GAP = 6;
const ROW_GAP = 4;

export function AILabelOverlay({ x, y, width, height, label, groupId }: AILabelOverlayProps) {
  // Estimate text width: roughly 7px per character at 12px font
  const labelWidth = label.length * 7;
  const labelPillWidth = labelWidth + PILL_PADDING_X * 2;

  // Center the label pill below the object
  const labelPillX = x + width / 2 - labelPillWidth / 2;
  const labelPillY = y + height + GAP;

  const groupText = groupId ? `group: ${groupId}` : null;
  const groupPillWidth = groupText ? groupText.length * 7 + PILL_PADDING_X * 2 : 0;
  const groupPillX = x + width / 2 - groupPillWidth / 2;
  const groupPillY = labelPillY + PILL_HEIGHT + ROW_GAP;

  return (
    <Group listening={false}>
      <Rect
        x={labelPillX}
        y={labelPillY}
        width={labelPillWidth}
        height={PILL_HEIGHT}
        fill={PILL_COLOR}
        cornerRadius={PILL_RADIUS}
        opacity={0.85}
      />
      <Text
        x={labelPillX}
        y={labelPillY}
        width={labelPillWidth}
        height={PILL_HEIGHT}
        text={label}
        fontSize={FONT_SIZE}
        fontFamily="'Inter', sans-serif"
        fill={TEXT_COLOR}
        align="center"
        verticalAlign="middle"
      />
      {groupText && (
        <>
          <Rect
            x={groupPillX}
            y={groupPillY}
            width={groupPillWidth}
            height={PILL_HEIGHT}
            fill={GROUP_COLOR}
            cornerRadius={PILL_RADIUS}
            opacity={0.75}
          />
          <Text
            x={groupPillX}
            y={groupPillY}
            width={groupPillWidth}
            height={PILL_HEIGHT}
            text={groupText}
            fontSize={FONT_SIZE}
            fontFamily="'Inter', sans-serif"
            fill={TEXT_COLOR}
            align="center"
            verticalAlign="middle"
          />
        </>
      )}
    </Group>
  );
}
