import { useState, useEffect, useCallback, useRef } from 'react';
import { Stage, Layer, Group } from 'react-konva';
import type Konva from 'konva';
import { getBoardObjects, type AnyBoardObject } from '../../services/boardService';
import type { StickyNote, Shape, Frame, Sticker, Connector, TextObject } from '../../types/board';
import { StickyNoteComponent } from '../Board/StickyNote';
import { ShapeComponent } from '../Board/ShapeComponent';
import { FrameComponent } from '../Board/FrameComponent';
import { StickerComponent } from '../Board/StickerComponent';
import { TextComponent } from '../Board/TextComponent';
import { ConnectorComponent } from '../Board/ConnectorComponent';

interface BoardQuickLookProps {
  boardId: string;
  boardName: string;
  onClose: () => void;
  onOpenBoard: (boardId: string) => void;
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 5;
const NOOP2 = (_id: string, _x: number, _y: number) => {};
const NOOP_TITLE = (_id: string, _title: string) => {};
const NOOP_TEXT = (_id: string, _text: string) => {};

function computeFitTransform(
  objects: AnyBoardObject[],
  stageWidth: number,
  stageHeight: number,
  padding = 0.1,
): { x: number; y: number; scale: number } {
  const visible = objects.filter((o) => o.type !== 'connector');
  if (visible.length === 0) return { x: 0, y: 0, scale: 1 };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const obj of visible) {
    minX = Math.min(minX, obj.x);
    minY = Math.min(minY, obj.y);
    maxX = Math.max(maxX, obj.x + obj.width);
    maxY = Math.max(maxY, obj.y + obj.height);
  }

  const bboxW = maxX - minX || 1;
  const bboxH = maxY - minY || 1;
  const padFactor = 1 + padding * 2;
  const sx = stageWidth / (bboxW * padFactor);
  const sy = stageHeight / (bboxH * padFactor);
  const scale = Math.min(sx, sy, MAX_ZOOM);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    x: stageWidth / 2 - centerX * scale,
    y: stageHeight / 2 - centerY * scale,
    scale,
  };
}

export function BoardQuickLook({ boardId, boardName, onClose, onOpenBoard }: BoardQuickLookProps) {
  const [objects, setObjects] = useState<AnyBoardObject[] | null>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [transform, setTransform] = useState<{ x: number; y: number; scale: number } | null>(null);
  const stageRef = useRef<Konva.Stage>(null);

  // Fetch objects
  useEffect(() => {
    let cancelled = false;
    getBoardObjects(boardId).then((objs) => {
      if (!cancelled) setObjects(objs);
    });
    return () => { cancelled = true; };
  }, [boardId]);

  // Auto-fit on first load
  useEffect(() => {
    if (objects && !transform) {
      setTransform(computeFitTransform(objects, dimensions.width, dimensions.height));
    }
  }, [objects, dimensions, transform]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Escape to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = 1.08;
    const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, direction > 0 ? oldScale * factor : oldScale / factor));

    setTransform({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
      scale: newScale,
    });
  }, []);

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const stage = e.target;
    if (stage !== stageRef.current) return;
    setTransform((prev) => prev ? { ...prev, x: stage.x(), y: stage.y() } : prev);
  }, []);

  const handleResetView = useCallback(() => {
    if (objects) setTransform(computeFitTransform(objects, dimensions.width, dimensions.height));
  }, [objects, dimensions]);

  const handleZoomIn = useCallback(() => {
    setTransform((prev) => {
      if (!prev) return prev;
      const newScale = Math.min(MAX_ZOOM, prev.scale * 1.3);
      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;
      return {
        x: cx - ((cx - prev.x) / prev.scale) * newScale,
        y: cy - ((cy - prev.y) / prev.scale) * newScale,
        scale: newScale,
      };
    });
  }, [dimensions]);

  const handleZoomOut = useCallback(() => {
    setTransform((prev) => {
      if (!prev) return prev;
      const newScale = Math.max(MIN_ZOOM, prev.scale / 1.3);
      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;
      return {
        x: cx - ((cx - prev.x) / prev.scale) * newScale,
        y: cy - ((cy - prev.y) / prev.scale) * newScale,
        scale: newScale,
      };
    });
  }, [dimensions]);

  // Split objects by type
  const stickyNotes = objects?.filter((o): o is StickyNote => o.type === 'sticky').sort((a, b) => a.updatedAt - b.updatedAt) ?? [];
  const shapes = objects?.filter((o): o is Shape => o.type === 'shape').sort((a, b) => a.updatedAt - b.updatedAt) ?? [];
  const frames = objects?.filter((o): o is Frame => o.type === 'frame').sort((a, b) => a.updatedAt - b.updatedAt) ?? [];
  const connectors = objects?.filter((o): o is Connector => o.type === 'connector').sort((a, b) => a.updatedAt - b.updatedAt) ?? [];
  const stickers = objects?.filter((o): o is Sticker => o.type === 'sticker').sort((a, b) => a.updatedAt - b.updatedAt) ?? [];
  const textObjects = objects?.filter((o): o is TextObject => o.type === 'text').sort((a, b) => a.updatedAt - b.updatedAt) ?? [];

  // Frame map for child transforms
  const frameMap = new Map<string, Frame>();
  for (const frame of frames) frameMap.set(frame.id, frame);

  function getChildOffset(child: { x: number; y: number; width: number; height: number; parentId?: string }): { x: number; y: number } | undefined {
    const parentFrame = child.parentId ? frameMap.get(child.parentId) : null;
    if (!parentFrame) return undefined;

    const frameRotation = parentFrame.rotation || 0;
    if (frameRotation === 0) return undefined;

    const fcx = parentFrame.x + parentFrame.width / 2;
    const fcy = parentFrame.y + parentFrame.height / 2;
    const ccx = child.x + child.width / 2;
    const ccy = child.y + child.height / 2;
    const dx = ccx - fcx;
    const dy = ccy - fcy;
    const rad = frameRotation * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const ox = (dx * cos - dy * sin) - dx;
    const oy = (dx * sin + dy * cos) - dy;
    if (ox === 0 && oy === 0) return undefined;
    return { x: ox, y: oy };
  }

  function getParentRotation(parentId?: string): number | undefined {
    if (!parentId) return undefined;
    const f = frameMap.get(parentId);
    return f ? (f.rotation || 0) : undefined;
  }

  const loading = objects === null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
        <div className="glass-playful rounded-xl px-5 py-2.5 shadow-lg flex items-center gap-4">
          <h2 className="text-sm font-bold text-orange-500 truncate max-w-[300px]">{boardName}</h2>
          <button
            onClick={() => onOpenBoard(boardId)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)' }}
          >
            Jump In
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-white/50 transition-all"
            aria-label="Close quick look"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5">
        <div className="glass-playful rounded-xl px-3 py-2 shadow-lg flex items-center gap-2">
          <button onClick={handleZoomOut} className="p-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-white/50 transition-all" aria-label="Zoom out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <span className="text-xs font-semibold text-gray-600 w-12 text-center">
            {transform ? `${Math.round(transform.scale * 100)}%` : '100%'}
          </span>
          <button onClick={handleZoomIn} className="p-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-white/50 transition-all" aria-label="Zoom in">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <div className="w-px h-4 bg-gray-300" />
          <button onClick={handleResetView} className="p-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-white/50 transition-all" aria-label="Fit to view">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6" />
              <path d="M9 21H3v-6" />
              <path d="M21 3l-7 7" />
              <path d="M3 21l7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
        </div>
      )}

      {/* Konva Stage */}
      {!loading && transform && (
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          x={transform.x}
          y={transform.y}
          scaleX={transform.scale}
          scaleY={transform.scale}
          draggable
          onWheel={handleWheel}
          onDragEnd={handleDragEnd}
        >
          <Layer>
            <Group listening={false}>
              {/* Connectors first (behind) */}
              {connectors.map((conn) => (
                <ConnectorComponent
                  key={conn.id}
                  connector={conn}
                  objects={objects!}
                />
              ))}
              {/* Frames */}
              {frames.map((frame) => (
                <FrameComponent
                  key={frame.id}
                  frame={frame}
                  onDragMove={NOOP2}
                  onDragEnd={NOOP2}
                  onTitleChange={NOOP_TITLE}
                  dragOffset={getChildOffset(frame)}
                  parentRotation={getParentRotation(frame.parentId)}
                  isNew={false}
                  isSelected={false}
                  groupDragOffset={null}
                  groupTransformPreview={null}
                  selectionBox={null}
                />
              ))}
              {/* Shapes */}
              {shapes.map((shape) => (
                <ShapeComponent
                  key={shape.id}
                  shape={shape}
                  onDragMove={NOOP2}
                  onDragEnd={NOOP2}
                  dragOffset={getChildOffset(shape)}
                  parentRotation={getParentRotation(shape.parentId)}
                  isNew={false}
                  isSelected={false}
                  groupDragOffset={null}
                  groupTransformPreview={null}
                  selectionBox={null}
                />
              ))}
              {/* Text objects */}
              {textObjects.map((textObj) => (
                <TextComponent
                  key={textObj.id}
                  textObj={textObj}
                  onDragMove={NOOP2}
                  onDragEnd={NOOP2}
                  onTextChange={NOOP_TEXT}
                  dragOffset={getChildOffset(textObj)}
                  parentRotation={getParentRotation(textObj.parentId)}
                  isNew={false}
                  isSelected={false}
                  groupDragOffset={null}
                  groupTransformPreview={null}
                  selectionBox={null}
                />
              ))}
              {/* Sticky notes */}
              {stickyNotes.map((note) => (
                <StickyNoteComponent
                  key={note.id}
                  note={note}
                  onDragMove={NOOP2}
                  onDragEnd={NOOP2}
                  onTextChange={NOOP_TEXT}
                  dragOffset={getChildOffset(note)}
                  parentRotation={getParentRotation(note.parentId)}
                  isNew={false}
                  isSelected={false}
                  groupDragOffset={null}
                  groupTransformPreview={null}
                  selectionBox={null}
                />
              ))}
              {/* Stickers */}
              {stickers.map((sticker) => (
                <StickerComponent
                  key={sticker.id}
                  sticker={sticker}
                  onDragMove={NOOP2}
                  onDragEnd={NOOP2}
                  dragOffset={getChildOffset(sticker)}
                  parentRotation={getParentRotation(sticker.parentId)}
                  isNew={false}
                  isSelected={false}
                  groupDragOffset={null}
                  groupTransformPreview={null}
                  selectionBox={null}
                />
              ))}
            </Group>
          </Layer>
        </Stage>
      )}
    </div>
  );
}
