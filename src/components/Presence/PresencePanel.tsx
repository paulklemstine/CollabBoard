import type { PresenceUser, CursorPosition } from '../../types/board';

interface PresencePanelProps {
  users: PresenceUser[];
  cursors?: CursorPosition[];
  onFollowUser?: (userId: string) => void;
}

export function PresencePanel({ users, cursors, onFollowUser }: PresencePanelProps) {
  // Only users with viewport data can be followed
  const followableUserIds = new Set(
    cursors?.filter((c) => c.viewportScale != null).map((c) => c.userId) ?? []
  );

  return (
    <div className="glass-playful rounded-2xl shadow-xl p-3.5 animate-float-up">
      <div className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow" style={{ color: '#34d399' }} />
        {users.length === 0 ? 'Just you for now' : `${users.length} other${users.length === 1 ? '' : 's'} vibing`}
      </div>
      <div className="flex flex-col gap-1.5">
        {users.map((user) => {
          const isClickable = followableUserIds.has(user.uid) && !!onFollowUser;

          return (
            <div
              key={user.uid}
              data-testid={`presence-user-${user.uid}`}
              className={`flex items-center gap-2.5 px-1 rounded-lg transition-colors ${
                isClickable ? 'cursor-pointer hover:bg-white/40' : ''
              }`}
              role={isClickable ? 'button' : undefined}
              onClick={isClickable ? () => onFollowUser(user.uid) : undefined}
            >
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
          );
        })}
      </div>
    </div>
  );
}
