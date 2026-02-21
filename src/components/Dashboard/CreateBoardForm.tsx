import { useState } from 'react';

interface CreateBoardFormProps {
  onCreateBoard: (name: string) => Promise<void>;
}

export function CreateBoardForm({ onCreateBoard }: CreateBoardFormProps) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    try {
      await onCreateBoard(trimmed);
      setName('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="text"
        placeholder="Board name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 px-4 py-3 rounded-xl bg-white/60 border border-gray-200 text-sm font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition-all duration-200"
      />
      <button
        type="submit"
        disabled={!name.trim() || creating}
        className="btn-lift btn-shimmer px-6 py-3 rounded-xl text-white font-semibold text-sm shadow-lg disabled:opacity-50"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)',
        }}
      >
        {creating ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
}
