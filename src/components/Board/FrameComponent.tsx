import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Line, Rect, Text } from 'react-konva';
import Konva from 'konva';
import type { Frame } from '../../types/board';
import { hexToRgba } from '../../utils/colors';
import { calculateGroupObjectTransform } from '../../utils/groupTransform';
import type { GroupTransformPreview, SelectionBox } from '../../hooks/useMultiSelect';
import { useMarchingAnts } from '../../hooks/useMarchingAnts';
import { getHandleLayout, MAX_HANDLE_SIZE } from '../../utils/handleLayout';

const DRAG_THROTTLE_MS = 50;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;

interface FrameComponentProps {
  frame: Frame;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDissolve?: (id: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onClick?: (id: string) => void;
  hoverState?: 'none' | 'accept' | 'reject';
  onResize?: (id: string, width: number, height: number) => void;
  onRotate?: (id: string, rotation: number) => void;
  onResizeEnd?: (id: string, width: number, height: number) => void;
  onRotateEnd?: (id: string, rotation: number) => void;
  onConnectorHoverEnter?: (id: string) => void;
  onConnectorHoverLeave?: () => void;
  isConnectorHighlighted?: boolean;
  isNew?: boolean;
  dragOffset?: { x: number; y: number };
  parentRotation?: number;
  isSelected?: boolean;
  groupDragOffset?: { dx: number; dy: number } | null;
  groupTransformPreview?: GroupTransformPreview | null;
  selectionBox?: SelectionBox | null;
  dragTint?: 'accept' | 'reject' | 'none';
  minChildBounds?: { width: number; height: number };
}

export function FrameComponent({ frame, onDragMove, onDragEnd, onDelete, onDuplicate, onDissolve, onTitleChange, onClick, hoverState = 'none', onResize, onRotate, onResizeEnd, onRotateEnd, onConnectorHoverEnter, onConnectorHoverLeave, isConnectorHighlighted, isNew, dragOffset, parentRotation, isSelected, groupDragOffset, groupTransformPreview, selectionBox, dragTint = 'none', minChildBounds }: FrameComponentProps) {
  const lastResizeUpdate = useRef(0);
  const titleRef = useRef<Konva.Text>(null);
  const borderRef = useRef<Konva.Rect>(null);
  const tweenRef = useRef<Konva.Tween | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isMouseHovered, setIsMouseHovered] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isRotateHovered, setIsRotateHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isDuplicateHovered, setIsDuplicateHovered] = useState(false);
  const [isDissolveHovered, setIsDissolveHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localWidth, setLocalWidth] = useState(frame.width);
  const [localHeight, setLocalHeight] = useState(frame.height);
  const flashOverlayRef = useRef<Konva.Rect>(null);
  const groupRef = useRef<Konva.Group>(null);
  const rotateStartRef = useRef<{ angle: number; rotation: number } | null>(null);
  const resizeHandleSizeRef = useRef(MAX_HANDLE_SIZE);
  const prevSelectedRef = useRef(false);
  const selectionRectRef = useRef<Konva.Rect>(null);
  useMarchingAnts(selectionRectRef, !!isSelected && !selectionBox);

  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(frame.width);
      setLocalHeight(frame.height);
    }
  }, [frame.width, frame.height, isResizing]);

  // Drop bounce + flash pulse for new objects
  useEffect(() => {
    if (!isNew) return;
    let destroyed = false;

    if (groupRef.current) {
      const g = groupRef.current;
      g.scaleX(0.85);
      g.scaleY(0.85);
      new Konva.Tween({
        node: g, duration: 0.35, scaleX: 1, scaleY: 1,
        easing: Konva.Easings.ElasticEaseOut,
      }).play();
    }

    if (flashOverlayRef.current) {
      const node = flashOverlayRef.current;
      const pulse = (count: number) => {
        if (count >= 3 || destroyed) return;
        const tweenIn = new Konva.Tween({
          node, duration: 0.33, opacity: 0.45, easing: Konva.Easings.EaseInOut,
          onFinish: () => {
            if (destroyed) return;
            new Konva.Tween({
              node, duration: 0.33, opacity: 0, easing: Konva.Easings.EaseInOut,
              onFinish: () => pulse(count + 1),
            }).play();
          },
        });
        tweenIn.play();
      };
      pulse(0);
    }

    return () => { destroyed = true; };
  }, [isNew]);

  // Selection pop animation
  useEffect(() => {
    if (isSelected && !prevSelectedRef.current && groupRef.current) {
      const g = groupRef.current;
      new Konva.Tween({
        node: g, duration: 0.1, scaleX: 1.03, scaleY: 1.03, easing: Konva.Easings.EaseInOut,
        onFinish: () => {
          new Konva.Tween({ node: g, duration: 0.1, scaleX: 1, scaleY: 1, easing: Konva.Easings.EaseInOut }).play();
        },
      }).play();
    }
    prevSelectedRef.current = !!isSelected;
  }, [isSelected]);

  // No throttle here — visual offset must update every frame for smooth child dragging.
  // Firestore writes are throttled inside the useBoard handler instead.
  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      // Subtract dragOffset to get the actual position (not the visual position)
      const actualX = e.target.x() - localWidth / 2 - (dragOffset?.x || 0);
      const actualY = e.target.y() - localHeight / 2 - (dragOffset?.y || 0);
      onDragMove(frame.id, actualX, actualY);
    },
    [frame.id, onDragMove, localWidth, localHeight, dragOffset]
  );

  // Hover animation via Konva Tween — priority: containment hoverState (accept/reject) > isMouseHovered > default
  useEffect(() => {
    const rect = borderRef.current;
    if (!rect) return;

    // Destroy any in-flight tween
    if (tweenRef.current) {
      tweenRef.current.destroy();
      tweenRef.current = null;
    }

    if (hoverState === 'accept') {
      // Containment hover — object fits, green glow
      tweenRef.current = new Konva.Tween({
        node: rect,
        duration: 0.25,
        stroke: '#22c55e',
        strokeWidth: 3.5,
        fill: 'rgba(34, 197, 94, 0.15)',
        shadowColor: '#22c55e',
        shadowBlur: 16,
        shadowOpacity: 0.5,
        easing: Konva.Easings.EaseInOut,
      });
      tweenRef.current.play();
    } else if (hoverState === 'reject') {
      // Containment hover — object too big, red glow
      tweenRef.current = new Konva.Tween({
        node: rect,
        duration: 0.25,
        stroke: '#ef4444',
        strokeWidth: 3.5,
        fill: 'rgba(239, 68, 68, 0.15)',
        shadowColor: '#ef4444',
        shadowBlur: 16,
        shadowOpacity: 0.5,
        easing: Konva.Easings.EaseInOut,
      });
      tweenRef.current.play();
    } else if (isMouseHovered) {
      // Mouse hover — use custom frame colors when set
      const hasBorderlessStroke = frame.borderless && frame.borderColor;
      tweenRef.current = new Konva.Tween({
        node: rect,
        duration: 0.15,
        stroke: frame.borderless ? (frame.borderColor || 'transparent') : (frame.borderColor || '#c084fc'),
        strokeWidth: frame.borderless ? (hasBorderlessStroke ? 2.5 : 0) : 3,
        fill: frame.color || (frame.borderless ? 'transparent' : 'rgba(250, 245, 255, 0.2)'),
        shadowColor: frame.borderless ? 'transparent' : (frame.borderColor || 'rgba(168, 85, 247, 0.2)'),
        shadowBlur: frame.borderless ? 0 : 10,
        shadowOpacity: frame.borderless ? 0 : 0.4,
        easing: Konva.Easings.EaseInOut,
      });
      tweenRef.current.play();
    } else {
      // Default — use custom frame colors when set
      tweenRef.current = new Konva.Tween({
        node: rect,
        duration: 0.15,
        stroke: frame.borderless ? (frame.borderColor || 'transparent') : (frame.borderColor || '#a78bfa'),
        strokeWidth: frame.borderless ? (frame.borderColor ? 2 : 0) : 2.5,
        fill: frame.color || (frame.borderless ? 'transparent' : 'rgba(250, 245, 255, 0.12)'),
        shadowColor: 'transparent',
        shadowBlur: 0,
        shadowOpacity: 0,
        easing: Konva.Easings.EaseInOut,
      });
      tweenRef.current.play();
    }

    return () => {
      if (tweenRef.current) {
        tweenRef.current.destroy();
        tweenRef.current = null;
      }
    };
  }, [hoverState, isMouseHovered, frame.borderless, frame.color, frame.borderColor]);

  useEffect(() => {
    if (!isEditing) return;

    const stage = titleRef.current?.getStage();
    if (!stage) return;
    const container = stage.container();

    const input = document.createElement('input');
    const textNode = titleRef.current!;
    const stageBox = container.getBoundingClientRect();
    const scale = stage.scaleX();

    const textPosition = textNode.absolutePosition();

    textNode.hide();
    textNode.getLayer()?.batchDraw();

    // Calculate display rotation (frame rotation + parent rotation)
    const rotation = (frame.rotation || 0) + (parentRotation || 0);

    input.value = frame.title;
    input.style.position = 'absolute';
    input.style.top = `${stageBox.top + textPosition.y}px`;
    input.style.left = `${stageBox.left + textPosition.x}px`;
    input.style.width = `${(localWidth - 40) * scale}px`;
    input.style.fontSize = `${(frame.fontSize ?? 14) * scale}px`;
    input.style.fontFamily = frame.fontFamily || "'Inter', sans-serif";
    input.style.fontWeight = (frame.fontWeight === 'bold' || !frame.fontWeight) ? '700' : '400';
    input.style.fontStyle = frame.fontStyle === 'italic' ? 'italic' : 'normal';
    input.style.color = frame.textColor || '#581c87';
    input.style.padding = '2px 4px';
    input.style.border = '1px solid #3b82f6';
    input.style.outline = 'none';
    input.style.background = 'white';
    input.style.borderRadius = '4px';
    input.style.zIndex = '1000';
    input.style.transformOrigin = 'top left';
    input.style.transform = `rotate(${rotation}deg)`;

    document.body.appendChild(input);
    input.focus();
    input.select();

    const finish = () => {
      onTitleChange(frame.id, input.value);
      setIsEditing(false);
      textNode.show();
      textNode.getLayer()?.batchDraw();
      input.remove();
    };

    const handleBlur = () => finish();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        finish();
      }
    };

    input.addEventListener('blur', handleBlur);
    input.addEventListener('keydown', handleKeyDown);

    return () => {
      input.removeEventListener('blur', handleBlur);
      input.removeEventListener('keydown', handleKeyDown);
      textNode.show();
      textNode.getLayer()?.batchDraw();
      if (input.parentNode) input.remove();
    };
  }, [isEditing, frame.id, frame.title, frame.rotation, localWidth, onTitleChange, parentRotation]);

  // Title bar height (only used for bordered frames, but computed here so border rect can use it)
  const titleFontSize = frame.fontSize ?? 14;
  const titleBarH = frame.borderless ? 0 : Math.max(36, titleFontSize + 20);

  const hl = getHandleLayout(localWidth, localHeight + titleBarH);

  // Calculate live transform when part of a multi-select group
  const liveTransform = groupTransformPreview && selectionBox
    ? calculateGroupObjectTransform(frame, selectionBox, groupTransformPreview)
    : null;

  // Apply parent drag offset, group drag offset, live transform, and rotation
  const displayX = frame.x + (dragOffset?.x || 0) + (groupDragOffset?.dx ?? 0) + (liveTransform?.orbitOffset.x ?? 0);
  const displayY = frame.y + (dragOffset?.y || 0) + (groupDragOffset?.dy ?? 0) + (liveTransform?.orbitOffset.y ?? 0);
  const displayRotation = (frame.rotation || 0) + (parentRotation || 0) + (liveTransform?.rotationDelta ?? 0);

  return (
    <Group
      ref={groupRef}
      x={displayX + localWidth / 2}
      y={displayY + localHeight / 2}
      offsetX={localWidth / 2}
      offsetY={localHeight / 2}
      scaleX={liveTransform?.scaleX ?? 1}
      scaleY={liveTransform?.scaleY ?? 1}
      rotation={displayRotation}
      draggable={!groupDragOffset}
      onDragMove={handleDragMove}
      onDragStart={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'grabbing';
      }}
      onDragEnd={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = isMouseHovered ? 'grab' : 'default';
        // Subtract dragOffset to get the actual position (not the visual position)
        const actualX = e.target.x() - localWidth / 2 - (dragOffset?.x || 0);
        const actualY = e.target.y() - localHeight / 2 - (dragOffset?.y || 0);
        onDragEnd(frame.id, actualX, actualY);
      }}
      onClick={() => onClick?.(frame.id)}
      onTap={() => onClick?.(frame.id)}
      onMouseEnter={(e) => {
        setIsMouseHovered(true);
        onConnectorHoverEnter?.(frame.id);
        const stage = e.target.getStage();
        if (stage && !isDeleteHovered && !isResizeHovered && !isRotateHovered) {
          stage.container().style.cursor = 'grab';
        }
      }}
      onMouseLeave={(e) => {
        setIsMouseHovered(false);
        onConnectorHoverLeave?.();
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'default';
      }}
    >
      {/* Hit expansion — prevents onMouseLeave race when reaching action buttons */}
      <Rect x={-34} y={-titleBarH - 40} width={localWidth + 64} height={localHeight + titleBarH + 70}
            fill="transparent" listening={true} />
      {/* Frame border */}
      {frame.borderless ? (
        <>
          {/* Hit area / background for borderless frames */}
          <Rect
            ref={borderRef}
            width={localWidth}
            height={localHeight}
            fill={frame.color || "transparent"}
            stroke={frame.borderColor || "transparent"}
            strokeWidth={frame.borderColor ? 2 : 0}

            cornerRadius={16}
          />
          {/* Subtle dashed outline on hover when no custom border set */}
          {isMouseHovered && !frame.borderColor && (
            <Rect
              width={localWidth}
              height={localHeight}
              stroke="#94a3b8"
              strokeWidth={1}
              dash={[6, 4]}
              fill="transparent"
              cornerRadius={16}
              opacity={0.4}
              listening={false}
            />
          )}
        </>
      ) : (
        <Rect
          ref={borderRef}
          y={-titleBarH}
          width={localWidth}
          height={localHeight + titleBarH}
          stroke={isConnectorHighlighted ? '#818cf8' : (frame.borderColor || '#a78bfa')}
          strokeWidth={isConnectorHighlighted ? 4 : 2.5}
          fill={frame.color || "rgba(250, 245, 255, 0.12)"}
          cornerRadius={16}
        />
      )}
      {/* Selection highlight — only for single-select */}
      {isSelected && !selectionBox && (
        <Rect
          ref={selectionRectRef}
          x={-4}
          y={-titleBarH - 4}
          width={localWidth + 8}
          height={localHeight + titleBarH + 8}
          stroke="#3b82f6"
          strokeWidth={3}
          dash={[8, 4]}
          fill="transparent"
          cornerRadius={18}
          listening={false}
        />
      )}
      {/* Multi-select violet glow */}
      {isSelected && selectionBox && (
        <Rect
          x={-4}
          y={-titleBarH - 4}
          width={localWidth + 8}
          height={localHeight + titleBarH + 8}
          fill="transparent"
          shadowColor="#8b5cf6"
          shadowBlur={24}
          shadowOpacity={0.5}
          cornerRadius={18}
          listening={false}
        />
      )}
      {/* Drag tint overlay for the dragged frame itself */}
      {dragTint !== 'none' && (
        <Rect
          width={localWidth}
          height={localHeight}
          cornerRadius={16}
          fill={dragTint === 'accept' ? '#22c55e' : '#ef4444'}
          opacity={0.18}
          listening={false}
        />
      )}
      {/* Accept/Reject overlay icons during drag containment */}
      {hoverState === 'accept' && (
        <Text
          x={localWidth / 2 - Math.min(localWidth, localHeight) * 0.15}
          y={localHeight / 2 - Math.min(localWidth, localHeight) * 0.15}
          width={Math.min(localWidth, localHeight) * 0.3}
          height={Math.min(localWidth, localHeight) * 0.3}
          text={"\u2705"}
          fontSize={Math.min(localWidth, localHeight) * 0.25}
          align="center"
          verticalAlign="middle"
          opacity={0.8}
          listening={false}
        />
      )}
      {hoverState === 'reject' && (
        <Text
          x={localWidth / 2 - Math.min(localWidth, localHeight) * 0.15}
          y={localHeight / 2 - Math.min(localWidth, localHeight) * 0.15}
          width={Math.min(localWidth, localHeight) * 0.3}
          height={Math.min(localWidth, localHeight) * 0.3}
          text={"\uD83D\uDEAB"}
          fontSize={Math.min(localWidth, localHeight) * 0.25}
          align="center"
          verticalAlign="middle"
          opacity={0.8}
          listening={false}
        />
      )}
      {/* Flash overlay for new objects */}
      {isNew && (
        <Rect
          ref={flashOverlayRef}
          width={localWidth}
          height={localHeight}
          fill="#fbbf24"
          opacity={0}
          cornerRadius={16}
          listening={false}
        />
      )}
      {/* Title bar — hidden for borderless frames */}
      {!frame.borderless && (() => {
        const bg = frame.color;
        const isCustomBg = !!bg;
        return (
        <>
          {/* Title background — tint of the frame's background color */}
          <Rect
            x={0}
            y={-titleBarH}
            width={localWidth}
            height={titleBarH}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: localWidth, y: 0 }}
            fillLinearGradientColorStops={
              isCustomBg
                ? [0, hexToRgba(bg, 0.35), 0.5, hexToRgba(bg, 0.2), 1, hexToRgba(bg, 0.1)]
                : [
                    0, 'rgba(139, 92, 246, 0.18)',
                    0.5, 'rgba(139, 92, 246, 0.1)',
                    1, 'rgba(139, 92, 246, 0.05)'
                  ]
            }
            cornerRadius={[16, 16, 0, 0]}
          />
          {/* Title text */}
          <Text
            ref={titleRef}
            x={16}
            y={-titleBarH + 8}
            width={localWidth - 40}
            text={frame.title || 'Double-click to edit'}
            fontSize={titleFontSize}
            fontFamily={frame.fontFamily || "'Inter', sans-serif"}
            fontStyle={`${frame.fontWeight ?? 'bold'}${(frame.fontStyle === 'italic') ? ' italic' : ''}`}
            fill={frame.title ? (frame.textColor || '#581c87') : (isCustomBg ? hexToRgba(bg, 0.5) : '#a78bfa')}
            listening={false}
          />
          {/* Title/body separator line */}
          <Line
            points={[0, 0, localWidth, 0]}
            stroke={frame.borderColor || '#a78bfa'}
            strokeWidth={2.5}
            listening={false}
          />
          {/* Double-click area for title editing */}
          <Rect
            x={0}
            y={-titleBarH}
            width={localWidth - 30}
            height={titleBarH}
            fill="transparent"
            onDblClick={() => setIsEditing(true)}
            onDblTap={() => setIsEditing(true)}
          />
        </>
        );
      })()}
      {/* Dissolve frame button (center-top) — removes frame, keeps children */}
      {onDissolve && isMouseHovered && (
        <Group
          x={(localWidth - hl.size) / 2}
          y={-titleBarH}
          onClick={(e) => {
            e.cancelBubble = true;
            onDissolve(frame.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDissolve(frame.id);
          }}
          onMouseEnter={(e) => {
            setIsMouseHovered(true);
            setIsDissolveHovered(true);
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'pointer';
          }}
          onMouseLeave={(e) => {
            setIsDissolveHovered(false);
            const stage = e.target.getStage();
            if (stage && isMouseHovered && !isDeleteHovered && !isResizeHovered && !isRotateHovered) {
              stage.container().style.cursor = 'grab';
            }
          }}
        >
          <Rect
            width={hl.size}
            height={hl.size}
            fill={isDissolveHovered ? '#f59e0b' : '#94a3b8'}
            opacity={isDissolveHovered ? 1 : 0.4}
            cornerRadius={hl.cornerRadius}
          />
          <Text
            x={0}
            y={0}
            width={hl.size}
            height={hl.size}
            text="📤"
            fontSize={hl.fontSize}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
      {/* Duplicate button (top-left) */}
      {onDuplicate && isMouseHovered && (
        <Group
          x={0}
          y={-titleBarH}
          onClick={(e) => {
            e.cancelBubble = true;
            onDuplicate(frame.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDuplicate(frame.id);
          }}
          onMouseEnter={(e) => {
            setIsMouseHovered(true);
            setIsDuplicateHovered(true);
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'pointer';
          }}
          onMouseLeave={(e) => {
            setIsDuplicateHovered(false);
            const stage = e.target.getStage();
            if (stage && isMouseHovered && !isDeleteHovered && !isResizeHovered && !isRotateHovered) {
              stage.container().style.cursor = 'grab';
            }
          }}
        >
          <Rect
            width={hl.size}
            height={hl.size}
            fill={isDuplicateHovered ? '#22c55e' : '#94a3b8'}
            opacity={isDuplicateHovered ? 1 : 0.4}
            cornerRadius={hl.cornerRadius}
          />
          <Text
            x={0}
            y={0}
            width={hl.size}
            height={hl.size}
            text={"\uD83D\uDCCB"}
            fontSize={hl.fontSize}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
      {/* Delete button */}
      {onDelete && isMouseHovered && (
        <Group
          x={localWidth - hl.size}
          y={-titleBarH}
          onClick={(e) => {
            e.cancelBubble = true;
            onDelete(frame.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDelete(frame.id);
          }}
          onMouseEnter={(e) => {
            setIsMouseHovered(true);
            setIsDeleteHovered(true);
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'pointer';
          }}
          onMouseLeave={(e) => {
            setIsDeleteHovered(false);
            const stage = e.target.getStage();
            if (stage && isMouseHovered && !isResizeHovered && !isRotateHovered) {
              stage.container().style.cursor = 'grab';
            }
          }}
        >
          <Rect
            width={hl.size}
            height={hl.size}
            fill={isDeleteHovered ? '#ef4444' : '#94a3b8'}
            opacity={isDeleteHovered ? 1 : 0.4}
            cornerRadius={hl.cornerRadius}
          />
          <Text
            x={0}
            y={0}
            width={hl.size}
            height={hl.size}
            text="❌"
            fontSize={hl.fontSize}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
      {/* Rotate handle (bottom-left) */}
      {!isEditing && onRotate && isMouseHovered && (
        <Group
          x={0}
          y={localHeight - hl.size}
          draggable
          onMouseEnter={(e) => {
            setIsMouseHovered(true);
            setIsRotateHovered(true);
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'alias';
          }}
          onMouseLeave={(e) => {
            setIsRotateHovered(false);
            const stage = e.target.getStage();
            if (stage && isMouseHovered) stage.container().style.cursor = 'grab';
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
            const stage = e.target.getStage();
            if (!stage) return;
            const pointer = stage.getPointerPosition();
            if (!pointer) return;
            const group = e.target.getParent();
            if (!group) return;
            const center = group.absolutePosition();
            const initialAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x) * (180 / Math.PI);
            rotateStartRef.current = { angle: initialAngle, rotation: frame.rotation || 0 };
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            if (!rotateStartRef.current) return;
            const stage = e.target.getStage();
            if (!stage) return;
            const pointer = stage.getPointerPosition();
            if (!pointer) return;
            const group = e.target.getParent();
            if (!group) return;
            const center = group.absolutePosition();
            const currentAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x) * (180 / Math.PI);
            const delta = currentAngle - rotateStartRef.current.angle;
            onRotate(frame.id, rotateStartRef.current.rotation + delta);
            e.target.position({ x: 0, y: localHeight - hl.size });
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            if (rotateStartRef.current) {
              const stage = e.target.getStage();
              if (stage) {
                const pointer = stage.getPointerPosition();
                if (pointer) {
                  const group = e.target.getParent();
                  if (!group) return;
                  const center = group.absolutePosition();
                  const currentAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x) * (180 / Math.PI);
                  const delta = currentAngle - rotateStartRef.current.angle;
                  (onRotateEnd ?? onRotate)(frame.id, rotateStartRef.current.rotation + delta);
                }
              }
            }
            rotateStartRef.current = null;
            e.target.position({ x: 0, y: localHeight - hl.size });
          }}
        >
          <Rect
            width={hl.size}
            height={hl.size}
            fill={isRotateHovered ? '#8b5cf6' : '#94a3b8'}
            opacity={isRotateHovered ? 1 : 0.4}
            cornerRadius={hl.cornerRadius}
          />
          <Text
            x={0}
            y={0}
            width={hl.size}
            height={hl.size}
            text="🔄"
            fontSize={hl.fontSize}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
      {/* Resize handle */}
      {!isEditing && onResize && isMouseHovered && (
        <Group
          x={localWidth - hl.size}
          y={localHeight - hl.size}
          draggable
          onMouseEnter={(e) => {
            setIsMouseHovered(true);
            setIsResizeHovered(true);
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'nwse-resize';
          }}
          onMouseLeave={(e) => {
            setIsResizeHovered(false);
            const stage = e.target.getStage();
            if (stage && isMouseHovered && !isDeleteHovered) {
              stage.container().style.cursor = 'grab';
            }
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
            setIsResizing(true);
            resizeHandleSizeRef.current = hl.size;
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const newWidth = Math.max(MIN_WIDTH, minChildBounds?.width ?? 0, e.target.x() + resizeHandleSizeRef.current);
            const newHeight = Math.max(MIN_HEIGHT, minChildBounds?.height ?? 0, e.target.y() + resizeHandleSizeRef.current);
            setLocalWidth(newWidth);
            setLocalHeight(newHeight);
            const now = Date.now();
            if (now - lastResizeUpdate.current >= DRAG_THROTTLE_MS) {
              lastResizeUpdate.current = now;
              onResize(frame.id, newWidth, newHeight);
            }
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const newWidth = Math.max(MIN_WIDTH, minChildBounds?.width ?? 0, e.target.x() + resizeHandleSizeRef.current);
            const newHeight = Math.max(MIN_HEIGHT, minChildBounds?.height ?? 0, e.target.y() + resizeHandleSizeRef.current);
            setLocalWidth(newWidth);
            setLocalHeight(newHeight);
            (onResizeEnd ?? onResize)(frame.id, newWidth, newHeight);
            setIsResizing(false);
            const newHl = getHandleLayout(newWidth, newHeight + titleBarH);
            e.target.position({ x: newWidth - newHl.size, y: newHeight - newHl.size });
          }}
        >
          <Rect
            width={hl.size}
            height={hl.size}
            fill={isResizeHovered ? '#3b82f6' : '#94a3b8'}
            opacity={isResizeHovered ? 1 : 0.4}
            cornerRadius={hl.cornerRadius}
          />
          <Text
            x={0}
            y={0}
            width={hl.size}
            height={hl.size}
            text="↔️"
            fontSize={hl.fontSize}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}
