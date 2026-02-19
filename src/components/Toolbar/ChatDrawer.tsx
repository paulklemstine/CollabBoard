import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage } from '../../types/board';

interface ChatDrawerProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSend: (text: string) => void;
}

export function ChatDrawer({ messages, currentUserId, onSend }: ChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seenCountRef = useRef(messages.length);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track seen messages: when open, keep seenCount up to date
  useEffect(() => {
    if (isOpen) {
      seenCountRef.current = messages.length;
    }
  }, [isOpen, messages.length]);

  const unreadCount = isOpen ? 0 : Math.max(0, messages.length - seenCountRef.current);

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleMouseEnter = useCallback(() => {
    if (closeTimeout.current) { clearTimeout(closeTimeout.current); closeTimeout.current = null; }
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimeout.current = setTimeout(() => setIsOpen(false), 300);
  }, []);

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={`btn-lift px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
          isOpen
            ? 'text-white'
            : 'text-purple-800'
        }`}
        style={isOpen ? {
          background: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #c084fc 100%)',
          boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4)',
        } : {
          background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 50%, #c4b5fd 100%)',
          boxShadow: '0 2px 10px rgba(139, 92, 246, 0.25)',
        }}
        title="Chat"
      >
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Chat
          {unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] rounded-full bg-gradient-to-br from-rose-500 to-pink-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </button>

      {/* Drawer */}
      {isOpen && (
        <div
          className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 animate-bounce-in"
          style={{ zIndex: 1001 }}
        >
          <div className="glass-playful rounded-2xl shadow-2xl overflow-hidden" style={{ width: 320 }}>
            {/* Messages area */}
            <div className="overflow-y-auto px-3 py-2 max-h-[300px] min-h-[120px] flex flex-col gap-1.5">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-[120px] text-xs text-gray-400">
                  No messages yet
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelf = msg.userId === currentUserId;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                      {!isSelf && (
                        <span className="text-[10px] font-medium ml-1 mb-0.5" style={{ color: msg.color }}>
                          {msg.displayName}
                        </span>
                      )}
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-1.5 text-sm leading-relaxed break-words ${
                          isSelf
                            ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-br-md'
                            : 'bg-white/60 text-gray-700 border border-white/40 rounded-bl-md'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="px-3 py-2 border-t border-white/30">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/50 border border-white/40 rounded-xl px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300 transition-all"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                  className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center flex-shrink-0 hover:shadow-lg disabled:opacity-40 disabled:hover:shadow-none transition-all duration-200"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
