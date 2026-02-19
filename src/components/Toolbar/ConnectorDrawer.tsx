import { useState, useRef, useCallback } from 'react';
import { ColorPanel } from './ColorPanel';
import type { ConnectorStyle, ConnectorLineType } from '../../types/board';

interface ConnectorDrawerProps {
  connectorStyle: ConnectorStyle;
  onStyleChange: (style: ConnectorStyle) => void;
  curveStyle: 'straight' | 'curved';
  onCurveStyleChange: (style: 'straight' | 'curved') => void;
  connectMode: boolean;
  connectingFrom: string | null;
  onToggleConnectMode: () => void;
}

const LINE_TYPES: { type: ConnectorLineType; label: string }[] = [
  { type: 'solid', label: 'Solid' },
  { type: 'dashed', label: 'Dashed' },
  { type: 'dotted', label: 'Dotted' },
];

const THICKNESSES = [2, 3, 5, 8];

const CURVE_STYLES: { style: 'straight' | 'curved'; label: string }[] = [
  { style: 'straight', label: 'Straight' },
  { style: 'curved', label: 'Curved' },
];


export function ConnectorDrawer({
  connectorStyle,
  onStyleChange,
  curveStyle,
  onCurveStyleChange,
  connectMode,
  connectingFrom,
  onToggleConnectMode,
}: ConnectorDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (closeTimeout.current) { clearTimeout(closeTimeout.current); closeTimeout.current = null; }
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimeout.current = setTimeout(() => setIsOpen(false), 300);
  }, []);

  const update = (partial: Partial<ConnectorStyle & { curveStyle: 'straight' | 'curved' }>) => {
    const { curveStyle: cs, ...rest } = partial;
    if (cs !== undefined) onCurveStyleChange(cs);
    if (Object.keys(rest).length > 0) {
      onStyleChange({ ...connectorStyle, ...rest });
    }
  };

  const connectLabel = connectMode
    ? connectingFrom
      ? 'Click target...'
      : 'Click source...'
    : 'Connect';

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Split button: main click toggles connect mode, arrow opens drawer */}
      <div className="flex items-stretch">
        <button
          onClick={onToggleConnectMode}
          className={`btn-lift px-3.5 py-2.5 rounded-l-xl text-sm font-bold transition-all duration-200 ${
            connectMode
              ? 'text-white shadow-lg shadow-pink-500/30'
              : 'text-pink-800'
          }`}
          style={connectMode ? {
            background: 'linear-gradient(135deg, #f472b6 0%, #ec4899 50%, #db2777 100%)',
            boxShadow: '0 4px 16px rgba(236, 72, 153, 0.4)',
          } : {
            background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 50%, #f9a8d4 100%)',
            boxShadow: '0 2px 10px rgba(236, 72, 153, 0.25)',
          }}
          title="Connect objects"
        >
          <div className="flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            {connectLabel}
          </div>
        </button>
        <button
          onClick={() => setIsOpen((o) => !o)}
          className={`btn-lift px-1.5 py-2.5 rounded-r-xl text-sm transition-all duration-200 border-l flex items-center justify-center ${
            connectMode
              ? 'text-white/80 border-white/30'
              : 'text-pink-700 border-pink-300/30'
          }`}
          style={connectMode ? {
            background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
          } : {
            background: 'linear-gradient(135deg, #fbcfe8 0%, #f9a8d4 100%)',
          }}
          title="Connector options"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points={isOpen ? '6 15 12 9 18 15' : '6 9 12 15 18 9'} />
          </svg>
        </button>
      </div>

      {/* Drawer */}
      {isOpen && (
        <div
          className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 animate-bounce-in"
          style={{ zIndex: 1001 }}
        >
          <div className="glass-playful rounded-2xl shadow-2xl p-3 flex flex-col gap-3" style={{ width: 300 }}>

            {/* Path Style */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Path</div>
              <div className="flex gap-1.5">
                {CURVE_STYLES.map((cs) => (
                  <button
                    key={cs.style}
                    onClick={() => update({ curveStyle: cs.style })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      curveStyle === cs.style
                        ? 'bg-indigo-500 text-white shadow-md'
                        : 'bg-white/40 text-gray-600 hover:bg-white/70'
                    }`}
                  >
                    {cs.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Line Type */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Line Style</div>
              <div className="flex gap-1.5">
                {LINE_TYPES.map((lt) => (
                  <button
                    key={lt.type}
                    onClick={() => update({ lineType: lt.type })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex flex-col items-center gap-1 ${
                      connectorStyle.lineType === lt.type
                        ? 'bg-indigo-500 text-white shadow-md'
                        : 'bg-white/40 text-gray-600 hover:bg-white/70'
                    }`}
                  >
                    <svg width="40" height="6" viewBox="0 0 40 6">
                      <line
                        x1="2" y1="3" x2="38" y2="3"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray={lt.type === 'dashed' ? '6 4' : lt.type === 'dotted' ? '2 3' : 'none'}
                      />
                    </svg>
                    {lt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Arrows */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Arrows</div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => update({ startArrow: !connectorStyle.startArrow })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    connectorStyle.startArrow
                      ? 'bg-indigo-500 text-white shadow-md'
                      : 'bg-white/40 text-gray-600 hover:bg-white/70'
                  }`}
                >
                  <svg width="20" height="12" viewBox="0 0 20 12">
                    <polyline points="8,1 2,6 8,11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Start
                </button>
                <button
                  onClick={() => update({ endArrow: !connectorStyle.endArrow })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    connectorStyle.endArrow
                      ? 'bg-indigo-500 text-white shadow-md'
                      : 'bg-white/40 text-gray-600 hover:bg-white/70'
                  }`}
                >
                  End
                  <svg width="20" height="12" viewBox="0 0 20 12">
                    <line x1="2" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <polyline points="12,1 18,6 12,11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Thickness */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Thickness</div>
              <div className="flex gap-1.5">
                {THICKNESSES.map((t) => (
                  <button
                    key={t}
                    onClick={() => update({ strokeWidth: t })}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center ${
                      connectorStyle.strokeWidth === t
                        ? 'bg-indigo-500 text-white shadow-md'
                        : 'bg-white/40 text-gray-600 hover:bg-white/70'
                    }`}
                  >
                    <svg width="30" height="12" viewBox="0 0 30 12">
                      <line x1="2" y1="6" x2="28" y2="6" stroke="currentColor" strokeWidth={t} strokeLinecap="round" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <ColorPanel label="Color" color={connectorStyle.color} onChange={(c) => update({ color: c })} showTransparent />

            {/* Preview */}
            <div className="bg-white/30 rounded-xl p-2 flex items-center justify-center">
              <svg width="240" height="30" viewBox="0 0 240 30">
                {curveStyle === 'curved' ? (
                  <path
                    d={`M ${connectorStyle.startArrow ? 20 : 10},15 Q 120,${15 - 30} ${connectorStyle.endArrow ? 220 : 230},15`}
                    fill="none"
                    stroke={connectorStyle.color}
                    strokeWidth={connectorStyle.strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={
                      connectorStyle.lineType === 'dashed' ? '8 5' :
                      connectorStyle.lineType === 'dotted' ? '2 4' : 'none'
                    }
                  />
                ) : (
                  <line
                    x1={connectorStyle.startArrow ? 20 : 10}
                    y1="15"
                    x2={connectorStyle.endArrow ? 220 : 230}
                    y2="15"
                    stroke={connectorStyle.color}
                    strokeWidth={connectorStyle.strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={
                      connectorStyle.lineType === 'dashed' ? '8 5' :
                      connectorStyle.lineType === 'dotted' ? '2 4' : 'none'
                    }
                  />
                )}
                {connectorStyle.startArrow && (
                  <polyline
                    points="18,8 8,15 18,22"
                    fill="none"
                    stroke={connectorStyle.color}
                    strokeWidth={connectorStyle.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {connectorStyle.endArrow && (
                  <polyline
                    points="222,8 232,15 222,22"
                    fill="none"
                    stroke={connectorStyle.color}
                    strokeWidth={connectorStyle.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

