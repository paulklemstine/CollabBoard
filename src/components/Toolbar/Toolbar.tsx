import { useState, useEffect, useRef } from 'react';
import { ShapeDrawer } from './ShapeDrawer';
import { TextDrawer } from './TextDrawer';
import { StickerDrawer } from './StickerDrawer';
import { ChatDrawer } from './ChatDrawer';
import { ConnectorDrawer } from './ConnectorDrawer';
import type { ShapeType, ChatMessage, ConnectorStyle } from '../../types/board';
import type { AnyBoardObject } from '../../services/boardService';

interface ToolbarProps {
  onAddStickyNote: (bgColor: string, textColor?: string, borderColor?: string) => void;
  onAddText: (fontSize: number, fontFamily: string, fontWeight: 'normal' | 'bold', fontStyle: 'normal' | 'italic', textAlign: 'left' | 'center' | 'right', textColor: string) => void;
  onAddShape: (shapeType: ShapeType, fillColor: string, strokeColor?: string, borderColor?: string) => void;
  onAddFrame: () => void;
  onAddBorderlessFrame: () => void;
  onAddSticker: (emoji: string) => void;
  onAddGifSticker?: (gifUrl: string) => void;
  connectMode: boolean;
  connectingFrom: string | null;
  onToggleConnectMode: () => void;
  onToggleAI: () => void;
  aiOpen: boolean;
  chatMessages: ChatMessage[];
  chatCurrentUserId: string;
  onChatSend: (text: string) => void;
  connectorStyle: ConnectorStyle;
  onConnectorStyleChange: (style: ConnectorStyle) => void;
  curveStyle: 'straight' | 'curved';
  onCurveStyleChange: (style: 'straight' | 'curved') => void;
  selectedObject?: AnyBoardObject | null;
  onUpdateSelectedObject?: (updates: Partial<AnyBoardObject>) => void;
  onToggleWebcam?: () => void;
  isWebcamStreaming?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  forceOpenDrawer?: string | null;
  forceOpenDrawerTab?: string;
}

export function Toolbar({
  onAddStickyNote,
  onAddText,
  onAddShape,
  onAddFrame,
  onAddBorderlessFrame,
  onAddSticker,
  onAddGifSticker,
  connectMode,
  connectingFrom,
  onToggleConnectMode,
  onToggleAI,
  aiOpen,
  chatMessages,
  chatCurrentUserId,
  onChatSend,
  connectorStyle,
  onConnectorStyleChange,
  curveStyle,
  onCurveStyleChange,
  selectedObject,
  onUpdateSelectedObject,
  onToggleWebcam,
  isWebcamStreaming,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  forceOpenDrawer,
  forceOpenDrawerTab,
}: ToolbarProps) {
  // Text styling
  const [textFontSize, setTextFontSize] = useState(24);
  const [textFontFamily, setTextFontFamily] = useState("'Inter', sans-serif");
  const [textFontWeight, setTextFontWeight] = useState<'normal' | 'bold'>('normal');
  const [textFontStyle, setTextFontStyle] = useState<'normal' | 'italic'>('normal');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [textColor, setTextColor] = useState('#1e293b');

  // Shape colors
  const [shapeFill, setShapeFill] = useState('#818cf8');
  const [shapeStroke, setShapeStroke] = useState('#4f46e5');
  const [shapeBorder, setShapeBorder] = useState('transparent');

  // Derive editing flags from selected object type
  const editingText = selectedObject?.type === 'text';
  const editingShape = selectedObject?.type === 'shape';
  const editingSticky = selectedObject?.type === 'sticky';
  const editingFrame = selectedObject?.type === 'frame';

  // Track the selected object ID so useEffect only fires on selection *change*, not on every Firestore update
  const prevSelectedIdRef = useRef<string | null>(null);

  // Sync drawer state FROM selected object on selection change
  useEffect(() => {
    if (!selectedObject || selectedObject.id === prevSelectedIdRef.current) {
      prevSelectedIdRef.current = selectedObject?.id ?? null;
      return;
    }
    prevSelectedIdRef.current = selectedObject.id;

    if (editingText) {
      const t = selectedObject as import('../../types/board').TextObject;
      // TextDrawer
      setTextFontSize(t.fontSize);
      setTextFontFamily(t.fontFamily);
      setTextFontWeight(t.fontWeight);
      setTextFontStyle(t.fontStyle);
      setTextAlign(t.textAlign);
      setTextColor(t.color);
      // ShapeDrawer (Fill=bgColor, Border=borderColor)
      setShapeFill(t.bgColor ?? 'transparent');
      setShapeStroke(t.borderColor ?? 'transparent');
    } else if (editingShape) {
      const s = selectedObject as import('../../types/board').Shape;
      setShapeFill(s.color);
      setShapeStroke(s.strokeColor ?? 'transparent');
      setShapeBorder(s.borderColor ?? 'transparent');
    } else if (editingSticky) {
      const s = selectedObject as import('../../types/board').StickyNote;
      // ShapeDrawer (Fill=bg, Stroke=border, Border unused)
      setShapeFill(s.color);
      setShapeStroke(s.borderColor ?? 'transparent');
      // TextDrawer
      setTextColor(s.textColor ?? '#1e293b');
      setTextFontSize(s.fontSize ?? 15);
      setTextFontFamily(s.fontFamily ?? "'Inter', sans-serif");
      setTextFontWeight(s.fontWeight ?? 'normal');
      setTextFontStyle(s.fontStyle ?? 'normal');
      setTextAlign(s.textAlign ?? 'left');
    } else if (editingFrame) {
      const f = selectedObject as import('../../types/board').Frame;
      setShapeFill(f.color ?? 'transparent');
      setShapeStroke(f.borderColor ?? '#a78bfa');
      // TextDrawer
      setTextColor(f.textColor ?? '#581c87');
      setTextFontSize(f.fontSize ?? 14);
      setTextFontFamily(f.fontFamily ?? "'Inter', sans-serif");
      setTextFontWeight(f.fontWeight ?? 'bold');
      setTextFontStyle(f.fontStyle ?? 'normal');
    }
  }, [selectedObject?.id, editingText, editingShape, editingSticky, editingFrame]);

  // Wrapped onChange handlers that also update the selected object
  const handleTextFontSizeChange = (size: number) => {
    setTextFontSize(size);
    if ((editingText || editingSticky || editingFrame) && onUpdateSelectedObject)
      onUpdateSelectedObject({ fontSize: size } as Partial<AnyBoardObject>);
  };

  const handleTextFontFamilyChange = (family: string) => {
    setTextFontFamily(family);
    if ((editingText || editingSticky || editingFrame) && onUpdateSelectedObject)
      onUpdateSelectedObject({ fontFamily: family } as Partial<AnyBoardObject>);
  };

  const handleTextFontWeightChange = (weight: 'normal' | 'bold') => {
    setTextFontWeight(weight);
    if ((editingText || editingSticky || editingFrame) && onUpdateSelectedObject)
      onUpdateSelectedObject({ fontWeight: weight } as Partial<AnyBoardObject>);
  };

  const handleTextFontStyleChange = (style: 'normal' | 'italic') => {
    setTextFontStyle(style);
    if ((editingText || editingSticky || editingFrame) && onUpdateSelectedObject)
      onUpdateSelectedObject({ fontStyle: style } as Partial<AnyBoardObject>);
  };

  const handleTextAlignChange = (align: 'left' | 'center' | 'right') => {
    setTextAlign(align);
    if ((editingText || editingSticky) && onUpdateSelectedObject)
      onUpdateSelectedObject({ textAlign: align } as Partial<AnyBoardObject>);
  };

  const handleTextColorChange = (color: string) => {
    setTextColor(color);
    if (!onUpdateSelectedObject) return;
    if (editingText) {
      onUpdateSelectedObject({ color } as Partial<AnyBoardObject>);
    } else if (editingSticky) {
      // TextDrawer color controls sticky's textColor
      onUpdateSelectedObject({ textColor: color } as Partial<AnyBoardObject>);
    } else if (editingFrame) {
      // TextDrawer color controls frame's title textColor
      onUpdateSelectedObject({ textColor: color } as Partial<AnyBoardObject>);
    }
  };

  const handleShapeFillChange = (color: string) => {
    // Prevent both fill and stroke from being transparent simultaneously
    if (color === 'transparent' && shapeStroke === 'transparent') return;
    setShapeFill(color);
    if (!onUpdateSelectedObject) return;
    if (editingShape || editingSticky) {
      onUpdateSelectedObject({ color } as Partial<AnyBoardObject>);
    } else if (editingFrame) {
      onUpdateSelectedObject({ color: color === 'transparent' ? undefined : color } as Partial<AnyBoardObject>);
    } else if (editingText) {
      // ShapeDrawer Fill controls text's bgColor
      onUpdateSelectedObject({ bgColor: color === 'transparent' ? undefined : color } as Partial<AnyBoardObject>);
    }
  };

  const handleShapeStrokeChange = (color: string) => {
    // Prevent both fill and stroke from being transparent simultaneously
    if (color === 'transparent' && shapeFill === 'transparent') return;
    setShapeStroke(color);
    if (!onUpdateSelectedObject) return;
    if (editingShape) {
      onUpdateSelectedObject({ strokeColor: color === 'transparent' ? undefined : color } as Partial<AnyBoardObject>);
    } else if (editingSticky) {
      // ShapeDrawer Border controls sticky's borderColor
      onUpdateSelectedObject({ borderColor: color === 'transparent' ? undefined : color } as Partial<AnyBoardObject>);
    } else if (editingFrame) {
      onUpdateSelectedObject({ borderColor: color === 'transparent' ? undefined : color } as Partial<AnyBoardObject>);
    } else if (editingText) {
      // ShapeDrawer Border controls text's borderColor
      onUpdateSelectedObject({ borderColor: color === 'transparent' ? undefined : color } as Partial<AnyBoardObject>);
    }
  };

  const handleShapeBorderChange = (color: string) => {
    setShapeBorder(color);
    if (!onUpdateSelectedObject) return;
    if (editingShape || editingSticky || editingText || editingFrame) {
      onUpdateSelectedObject({ borderColor: color === 'transparent' ? undefined : color } as Partial<AnyBoardObject>);
    }
  };

  const divider = (
    <div className="w-px h-8 mx-0.5 bg-violet-200/60" />
  );

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          maxWidth: 'calc(100vw - 32px)',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
          data-tutorial-id="toolbar"
          className="flex gap-1.5 glass-playful rounded-2xl p-2.5 items-center animate-float-up"
        >
      {/* Undo/Redo */}
      <button
        data-tutorial-id="undo-redo"
        onClick={onUndo}
        disabled={!canUndo}
        className={`btn-lift w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
          canUndo ? 'text-violet-600 hover:bg-violet-50/60' : 'text-gray-300 cursor-not-allowed'
        }`}
        title="Undo (Ctrl+Z)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`btn-lift w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
          canRedo ? 'text-violet-600 hover:bg-violet-50/60' : 'text-gray-300 cursor-not-allowed'
        }`}
        title="Redo (Ctrl+Shift+Z)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
        </svg>
      </button>

      {divider}

      {/* Text */}
      <TextDrawer
        fontSize={textFontSize}
        fontFamily={textFontFamily}
        fontWeight={textFontWeight}
        fontStyle={textFontStyle}
        textAlign={textAlign}
        textColor={textColor}
        onFontSizeChange={handleTextFontSizeChange}
        onFontFamilyChange={handleTextFontFamilyChange}
        onFontWeightChange={handleTextFontWeightChange}
        onFontStyleChange={handleTextFontStyleChange}
        onTextAlignChange={handleTextAlignChange}
        onTextColorChange={handleTextColorChange}
        onAdd={() => onAddText(textFontSize, textFontFamily, textFontWeight, textFontStyle, textAlign, textColor)}
        forceOpen={forceOpenDrawer === 'text'}
      />

      {divider}

      {/* Shape Drawer */}
      <ShapeDrawer
        fillColor={shapeFill}
        strokeColor={shapeStroke}
        borderColor={shapeBorder}
        onFillColorChange={handleShapeFillChange}
        onStrokeColorChange={handleShapeStrokeChange}
        onBorderColorChange={handleShapeBorderChange}
        onAddShape={(shapeType) => onAddShape(shapeType, shapeFill, shapeStroke, shapeBorder)}
        onAddFrame={onAddFrame}
        onAddBorderlessFrame={onAddBorderlessFrame}
        onAddSticky={() => onAddStickyNote(shapeFill, shapeStroke, shapeBorder)}
        forceOpen={forceOpenDrawer === 'shape'}
        forceTab={forceOpenDrawerTab as 'shapes' | 'colors' | undefined}
      />

      {divider}

      {/* Sticker Drawer */}
      <StickerDrawer onAddSticker={onAddSticker} onAddGifSticker={onAddGifSticker} />

      {divider}

      {/* Connector Drawer */}
      <ConnectorDrawer
        connectorStyle={connectorStyle}
        onStyleChange={onConnectorStyleChange}
        curveStyle={curveStyle}
        onCurveStyleChange={onCurveStyleChange}
        connectMode={connectMode}
        connectingFrom={connectingFrom}
        onToggleConnectMode={onToggleConnectMode}
        forceOpen={forceOpenDrawer === 'connector'}
      />

      {divider}

      {/* Webcam */}
      {onToggleWebcam && (
        <button
          data-tutorial-id="cam-button"
          onClick={onToggleWebcam}
          className={`btn-lift px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
            isWebcamStreaming
              ? 'text-white'
              : 'text-gray-700 hover:text-violet-600'
          }`}
          style={isWebcamStreaming ? {
            background: '#ef4444',
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.3)',
          } : {
            background: 'rgba(255, 255, 255, 0.6)',
          }}
          title={isWebcamStreaming ? 'Stop webcam' : 'Start webcam'}
        >
          <div className="flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isWebcamStreaming ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            Cam
          </div>
        </button>
      )}

      {divider}

      {/* Chat Drawer */}
      <ChatDrawer messages={chatMessages} currentUserId={chatCurrentUserId} onSend={onChatSend} />

      {divider}

      {/* Flow AI */}
      <button
        data-tutorial-id="ai-button"
        onClick={onToggleAI}
        className={`btn-lift px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
          aiOpen
            ? 'text-white'
            : 'text-gray-700 hover:text-violet-600'
        }`}
        style={aiOpen ? {
          background: '#8b5cf6',
          boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)',
        } : {
          background: 'rgba(255, 255, 255, 0.6)',
        }}
        title="Flow AI"
      >
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
          </svg>
          AI
        </div>
      </button>

        </div>
      </div>
    </div>
  );
}
