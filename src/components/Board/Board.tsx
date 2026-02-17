import { useState, useEffect, useCallback, useRef } from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import { ZoomControls } from './ZoomControls';

interface BoardProps {
  boardId: string;
  onMouseMove?: (x: number, y: number) => void;
  children?: React.ReactNode;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.2;

export function Board({ boardId: _boardId, onMouseMove, children }: BoardProps) {
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
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, []);

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
  }, [dimensions]);

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
  }, [dimensions]);

  const resetZoom = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    setScale(1);
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
  }, []);

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!onMouseMove) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const transform = stage.getAbsoluteTransform().copy().invert();
      const pos = transform.point(pointer);
      onMouseMove(pos.x, pos.y);
    },
    [onMouseMove]
  );

  const handleMouseLeave = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      stage.container().style.cursor = 'default';
    }
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        draggable
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        scaleX={scale}
        scaleY={scale}
      >
        <Layer>{children}</Layer>
      </Stage>
      <ZoomControls
        scale={scale}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetZoom={resetZoom}
      />
    </div>
  );
}
