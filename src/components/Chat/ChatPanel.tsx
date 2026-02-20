import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../../types/board';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentUserId: string;
  onSend: (text: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function ChatPanel({ messages, currentUserId, onSend, isOpen, onToggle }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seenCountRef = useRef(messages.length);

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
      className="glass-playful rounded-2xl shadow-xl overflow-hidden animate-float-up"
      style={{
        width: isOpen ? 300 : 'fit-content',
        transition: 'width 0.25s ease-in-out',
      }}
    >
      {/* Header — always visible, acts as toggle */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Chat
          </span>
          {unreadCount > 0 && (
            <span className="min-w-[18px] h-[18px] rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Animated body */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.25s ease-in-out',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          {/* Messages area */}
          <div className="border-t border-white/30 overflow-y-auto px-3 py-2 max-h-[300px] min-h-[120px] flex flex-col gap-1.5">
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
                          ? 'bg-violet-500 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-700 border border-gray-200 rounded-bl-md'
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
          <div className="px-3 py-2 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 bg-white/50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 transition-all"
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="w-8 h-8 rounded-xl bg-violet-500 text-white flex items-center justify-center flex-shrink-0 hover:shadow-lg disabled:opacity-40 disabled:hover:shadow-none transition-all duration-200"
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
    </div>
  );
}
