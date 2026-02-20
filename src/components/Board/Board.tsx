import { useState, useEffect, useCallback, useRef } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';

export interface StageTransform {
  x: number;
  y: number;
  scale: number;
}

export interface ZoomControls {
  scale: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setTransform: (transform: StageTransform) => void;
}

interface BoardProps {
  boardId: string;
  onMouseMove?: (x: number, y: number) => void;
  onTransformChange?: (transform: StageTransform) => void;
  onStageMouseDown?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onStageMouseMove?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onStageMouseUp?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onZoomControlsChange?: (controls: ZoomControls) => void;
  onContainerRef?: (el: HTMLDivElement | null) => void;
  children?: React.ReactNode;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.2;

export function Board({ boardId: _boardId, onMouseMove, onTransformChange, onStageMouseDown, onStageMouseMove, onStageMouseUp, onZoomControlsChange, onContainerRef, children }: BoardProps) {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [scale, setScale] = useState(1);
  const stageRef = useRef<Konva.Stage>(null);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const notifyTransform = useCallback((stage: Konva.Stage) => {
    onTransformChange?.({
      x: stage.x(),
      y: stage.y(),
      scale: stage.scaleX(),
    });
  }, [onTransformChange]);

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
    const factor = 1.05;
    const newScale = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, direction > 0 ? oldScale * factor : oldScale / factor)
    );

    setScale(newScale);
    stage.scale({ x: newScale, y: newScale });
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
    notifyTransform(stage);
  }, [notifyTransform]);

  const zoomIn = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const newScale = Math.min(MAX_ZOOM, oldScale * ZOOM_STEP);

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const mousePointTo = {
      x: (centerX - stage.x()) / oldScale,
      y: (centerY - stage.y()) / oldScale,
    };

    setScale(newScale);
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: centerX - mousePointTo.x * newScale,
      y: centerY - mousePointTo.y * newScale,
    });
    notifyTransform(stage);
  }, [dimensions, notifyTransform]);

  const zoomOut = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const newScale = Math.max(MIN_ZOOM, oldScale / ZOOM_STEP);

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const mousePointTo = {
      x: (centerX - stage.x()) / oldScale,
      y: (centerY - stage.y()) / oldScale,
    };

    setScale(newScale);
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: centerX - mousePointTo.x * newScale,
      y: centerY - mousePointTo.y * newScale,
    });
    notifyTransform(stage);
  }, [dimensions, notifyTransform]);

  const resetZoom = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    setScale(1);
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    notifyTransform(stage);
  }, [notifyTransform]);

  const setTransform = useCallback((transform: StageTransform) => {
    const stage = stageRef.current;
    if (!stage) return;

    setScale(transform.scale);
    stage.scale({ x: transform.scale, y: transform.scale });
    stage.position({ x: transform.x, y: transform.y });
    notifyTransform(stage);
  }, [notifyTransform]);

  // Use a ref to avoid re-registering the listener when onMouseMove changes
  const onMouseMoveRef = useRef(onMouseMove);
  onMouseMoveRef.current = onMouseMove;

  // Native DOM mousemove listener — fires during Konva child drags too
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container();

    const handleNativeMouseMove = (e: MouseEvent) => {
      if (!onMouseMoveRef.current) return;
      const rect = container.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      const s = stage.scaleX();
      const worldX = (pointerX - stage.x()) / s;
      const worldY = (pointerY - stage.y()) / s;
      onMouseMoveRef.current(worldX, worldY);
    };

    container.addEventListener('mousemove', handleNativeMouseMove);
    return () => container.removeEventListener('mousemove', handleNativeMouseMove);
  }, []);

  // Pan via left-click drag (native DOM events; right-click and shift+left are free for marquee)
  const isPanningRef = useRef(false);
  const panPointerIdRef = useRef(-1);
  const panStartRef = useRef({ x: 0, y: 0, stageX: 0, stageY: 0 });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const container = stage.container();

    const onPointerDown = (e: PointerEvent) => {
      const isLeftClick = e.button === 0 && !e.shiftKey;
      if (!isLeftClick) return;
      // Only pan when clicking empty canvas, not objects
      const rect = container.getBoundingClientRect();
      const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const hit = stage.getIntersection(pos);
      if (hit && hit !== (stage as unknown)) return;
      isPanningRef.current = true;
      panPointerIdRef.current = e.pointerId;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        stageX: stage.x(),
        stageY: stage.y(),
      };
      container.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPanningRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      stage.position({
        x: panStartRef.current.stageX + dx,
        y: panStartRef.current.stageY + dy,
      });
      stage.batchDraw();
      notifyTransform(stage);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isPanningRef.current || e.pointerId !== panPointerIdRef.current) return;
      isPanningRef.current = false;
      panPointerIdRef.current = -1;
      container.releasePointerCapture(e.pointerId);
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
    };
  }, [notifyTransform]);

  const handleMouseLeave = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      stage.container().style.cursor = 'default';
    }
  }, []);

  // Notify parent of zoom controls
  useEffect(() => {
    if (onZoomControlsChange) {
      onZoomControlsChange({
        scale,
        zoomIn,
        zoomOut,
        resetZoom,
        setTransform,
      });
    }
  }, [scale, zoomIn, zoomOut, resetZoom, setTransform, onZoomControlsChange]);

  const containerRefCb = useCallback((el: HTMLDivElement | null) => {
    onContainerRef?.(el);
  }, [onContainerRef]);

  return (
    <div
      ref={containerRefCb}
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        onWheel={handleWheel}
        onMouseLeave={handleMouseLeave}
        onMouseDown={onStageMouseDown}
        onMouseMove={onStageMouseMove}
        onMouseUp={onStageMouseUp}
        scaleX={scale}
        scaleY={scale}
      >
        <Layer>{children}</Layer>
      </Stage>
    </div>
  );
}
