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

  const unreadCount = 0; // Could track unread when collapsed in the future

  return (
    <div className="glass-playful rounded-2xl shadow-xl overflow-hidden animate-float-up w-full">
      {/* Header — always visible, acts as toggle */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Chat
          </span>
          {!isOpen && messages.length > 0 && (
            <span className="text-[10px] text-gray-400">
              ({messages.length})
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

      {isOpen && (
        <>
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
        </>
      )}
    </div>
  );
}
