import { useState } from 'react';
import { StickyDrawer } from './StickyDrawer';
import { ShapeDrawer } from './ShapeDrawer';
import { StickerDrawer } from './StickerDrawer';
import { ChatDrawer } from './ChatDrawer';
import { ConnectorDrawer } from './ConnectorDrawer';
import type { ShapeType, ChatMessage, ConnectorStyle } from '../../types/board';

interface ToolbarProps {
  onAddStickyNote: (bgColor: string, textColor?: string, borderColor?: string) => void;
  onAddShape: (shapeType: ShapeType, fillColor: string, strokeColor?: string, borderColor?: string) => void;
  onAddFrame: () => void;
  onAddSticker: (emoji: string) => void;
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
}

export function Toolbar({
  onAddStickyNote,
  onAddShape,
  onAddFrame,
  onAddSticker,
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
}: ToolbarProps) {
  // Sticky note colors
  const [stickyBg, setStickyBg] = useState('#fef08a');
  const [stickyText, setStickyText] = useState('#1e293b');
  const [stickyBorder, setStickyBorder] = useState('transparent');

  // Shape colors
  const [shapeFill, setShapeFill] = useState('#818cf8');
  const [shapeStroke, setShapeStroke] = useState('#4f46e5');
  const [shapeBorder, setShapeBorder] = useState('transparent');

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
      {/* Sticky Note */}
      <StickyDrawer
        bgColor={stickyBg}
        textColor={stickyText}
        borderColor={stickyBorder}
        onBgColorChange={setStickyBg}
        onTextColorChange={setStickyText}
        onBorderColorChange={setStickyBorder}
        onAdd={() => onAddStickyNote(stickyBg, stickyText, stickyBorder)}
      />

      {divider}

      {/* Shape Drawer */}
      <ShapeDrawer
        fillColor={shapeFill}
        strokeColor={shapeStroke}
        borderColor={shapeBorder}
        onFillColorChange={setShapeFill}
        onStrokeColorChange={setShapeStroke}
        onBorderColorChange={setShapeBorder}
        onAddShape={(shapeType) => onAddShape(shapeType, shapeFill, shapeStroke, shapeBorder)}
        onAddFrame={onAddFrame}
      />

      {divider}

      {/* Sticker Drawer */}
      <StickerDrawer onAddSticker={onAddSticker} />

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
