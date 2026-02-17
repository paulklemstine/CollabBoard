import type { PresenceUser } from '../../types/board';

interface PresencePanelProps {
  users: PresenceUser[];
}

export function PresencePanel({ users }: PresencePanelProps) {
  return (
    <div className="absolute top-4 right-4 glass-playful rounded-2xl shadow-xl p-3.5 z-50 animate-float-up">
      <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow" style={{ color: '#34d399' }} />
        {users.length} Online
      </div>
      <div className="flex flex-col gap-1.5">
        {users.map((user) => (
          <div key={user.uid} className="flex items-center gap-2.5 px-1">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
              style={{
                background: `linear-gradient(135deg, ${user.color}, ${user.color}cc)`,
                boxShadow: `0 0 8px ${user.color}40`,
              }}
            >
              {(user.displayName?.[0] ?? '?').toUpperCase()}
            </div>
            <div
              data-testid={`presence-dot-${user.uid}`}
              className="w-2 h-2 rounded-full animate-pulse-glow"
              style={{ backgroundColor: user.color, color: user.color }}
            />
            <span className="text-sm font-medium text-gray-700">{user.displayName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
