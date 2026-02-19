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
}

export function Toolbar({
  onAddStickyNote,
  onAddText,
  onAddShape,
  onAddFrame,
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
      // ShapeDrawer (Fill=bg, Stroke=textColor, Border=borderColor)
      setShapeFill(s.color);
      setShapeStroke(s.textColor ?? '#1e293b');
      setShapeBorder(s.borderColor ?? 'transparent');
      // TextDrawer color = sticky textColor
      setTextColor(s.textColor ?? '#1e293b');
    }
  }, [selectedObject?.id, editingText, editingShape, editingSticky]);

  // Wrapped onChange handlers that also update the selected object
  const handleTextFontSizeChange = (size: number) => {
    setTextFontSize(size);
    if (editingText && onUpdateSelectedObject) onUpdateSelectedObject({ fontSize: size } as Partial<AnyBoardObject>);
  };

  const handleTextFontFamilyChange = (family: string) => {
    setTextFontFamily(family);
    if (editingText && onUpdateSelectedObject) onUpdateSelectedObject({ fontFamily: family } as Partial<AnyBoardObject>);
  };

  const handleTextFontWeightChange = (weight: 'normal' | 'bold') => {
    setTextFontWeight(weight);
    if (editingText && onUpdateSelectedObject) onUpdateSelectedObject({ fontWeight: weight } as Partial<AnyBoardObject>);
  };

  const handleTextFontStyleChange = (style: 'normal' | 'italic') => {
    setTextFontStyle(style);
    if (editingText && onUpdateSelectedObject) onUpdateSelectedObject({ fontStyle: style } as Partial<AnyBoardObject>);
  };

  const handleTextAlignChange = (align: 'left' | 'center' | 'right') => {
    setTextAlign(align);
    if (editingText && onUpdateSelectedObject) onUpdateSelectedObject({ textAlign: align } as Partial<AnyBoardObject>);
  };

  const handleTextColorChange = (color: string) => {
    setTextColor(color);
    if (!onUpdateSelectedObject) return;
    if (editingText) {
      onUpdateSelectedObject({ color } as Partial<AnyBoardObject>);
    } else if (editingSticky) {
      // TextDrawer color controls sticky's textColor
      onUpdateSelectedObject({ textColor: color } as Partial<AnyBoardObject>);
      setShapeStroke(color); // keep ShapeDrawer "Stroke" in sync
    }
  };

  const handleShapeFillChange = (color: string) => {
    setShapeFill(color);
    if (!onUpdateSelectedObject) return;
    if (editingShape || editingSticky) {
      onUpdateSelectedObject({ color } as Partial<AnyBoardObject>);
    } else if (editingText) {
      // ShapeDrawer Fill controls text's bgColor
      onUpdateSelectedObject({ bgColor: color === 'transparent' ? undefined : color } as Partial<AnyBoardObject>);
    }
  };

  const handleShapeStrokeChange = (color: string) => {
    setShapeStroke(color);
    if (!onUpdateSelectedObject) return;
    if (editingShape) {
      onUpdateSelectedObject({ strokeColor: color === 'transparent' ? undefined : color } as Partial<AnyBoardObject>);
    } else if (editingSticky) {
      // ShapeDrawer Stroke controls sticky's textColor
      onUpdateSelectedObject({ textColor: color } as Partial<AnyBoardObject>);
      setTextColor(color); // keep TextDrawer color in sync
    } else if (editingText) {
      // ShapeDrawer Border controls text's borderColor
      onUpdateSelectedObject({ borderColor: color === 'transparent' ? undefined : color } as Partial<AnyBoardObject>);
    }
  };

  const handleShapeBorderChange = (color: string) => {
    setShapeBorder(color);
    if (!onUpdateSelectedObject) return;
    if (editingShape || editingSticky || editingText) {
      onUpdateSelectedObject({ borderColor: color === 'transparent' ? undefined : color } as Partial<AnyBoardObject>);
    }
  };

  const divider = (
    <div className="w-px h-8 mx-0.5" style={{ background: 'linear-gradient(to bottom, rgba(251,146,60,0.2), rgba(168,85,247,0.3), rgba(96,165,250,0.2))' }} />
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
            boxShadow: '0 8px 32px rgba(139, 92, 246, 0.12), 0 4px 16px rgba(236, 72, 153, 0.08), 0 2px 8px rgba(0,0,0,0.06)',
          }}
          className="flex gap-1.5 glass-playful rounded-2xl p-2.5 items-center animate-float-up"
        >
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
        onAddSticky={() => onAddStickyNote(shapeFill, shapeStroke, shapeBorder)}
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
      />

      {divider}

      {/* Chat Drawer */}
      <ChatDrawer messages={chatMessages} currentUserId={chatCurrentUserId} onSend={onChatSend} />

      {divider}

      {/* Flow AI */}
      <button
        onClick={onToggleAI}
        className={`btn-lift px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
          aiOpen
            ? 'text-white'
            : 'text-purple-600 bg-white/50 hover:bg-white/80'
        }`}
        style={aiOpen ? {
          background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
          boxShadow: '0 4px 16px rgba(168, 85, 247, 0.4)',
        } : undefined}
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
