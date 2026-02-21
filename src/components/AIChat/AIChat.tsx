import { useState, useRef, useEffect } from 'react';
import { useAI } from '../../hooks/useAI';
import type { AIMessage } from '../../types/board';

export interface ViewportCenter {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AIChatProps {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
  onObjectsCreated?: (ids: string[]) => void;
  selectedIds?: string[];
  getViewportCenter?: () => ViewportCenter;
}

function SparkleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
    </svg>
  );
}

function MessageBubble({ message }: { message: AIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0 mr-2 mt-1 text-white">
          <SparkleIcon size={12} />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-violet-500 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-700 border border-gray-200 rounded-bl-md'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {!isUser && message.objectsCreated && message.objectsCreated.length > 0 && (
          <p className="mt-1.5 text-xs opacity-70">
            {message.objectsCreated.length} object{message.objectsCreated.length !== 1 ? 's' : ''} added to the board
          </p>
        )}
      </div>
    </div>
  );
}

function LoadingIndicator({ progress }: { progress: string | null }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0 mr-2 mt-1 text-white">
        <SparkleIcon size={12} />
      </div>
      <div className="bg-gray-100 border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
        {progress ? (
          <p className="text-xs text-violet-600 font-medium animate-pulse">{progress}</p>
        ) : (
          <div className="flex gap-1.5">
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  );
}

export function AIChat({ boardId, isOpen, onClose, onObjectsCreated, selectedIds, getViewportCenter }: AIChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages, isLoading, error, progress, sendCommand, dismissError } = useAI(boardId, onObjectsCreated, selectedIds);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    sendCommand(input, getViewportCenter?.());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-4 z-[1100] w-[360px] max-h-[480px] flex flex-col glass-playful rounded-2xl shadow-2xl animate-float-up overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center text-white">
            <SparkleIcon size={14} />
          </div>
          <span className="text-sm font-bold text-violet-600">
            Flow AI
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg hover:bg-black/5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-[200px] max-h-[340px]">
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mb-3 text-violet-400">
              <SparkleIcon size={24} />
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">AI assistant ready</p>
            <p className="text-xs text-gray-400">
              Try: "Create a SWOT analysis" or "Organize my board"
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && <LoadingIndicator progress={progress} />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-3 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-600">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="flex-1 truncate">{error}</span>
          <button onClick={dismissError} className="text-red-400 hover:text-red-600 flex-shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="px-3 py-3 border-t border-gray-200">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me what to build..."
            disabled={isLoading}
            className="flex-1 bg-white/50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 disabled:opacity-50 transition-all"
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || !input.trim()}
            className="w-9 h-9 rounded-xl bg-violet-500 text-white flex items-center justify-center flex-shrink-0 hover:shadow-lg disabled:opacity-40 disabled:hover:shadow-none transition-all duration-200"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
