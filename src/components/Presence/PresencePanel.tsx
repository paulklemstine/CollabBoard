import type { PresenceUser, CursorPosition } from '../../types/board';

interface PresencePanelProps {
  users: PresenceUser[];
  cursors?: CursorPosition[];
  onFollowUser?: (userId: string) => void;
  currentUser?: { displayName: string | null; email: string | null; color: string };
}

export function PresencePanel({ users, cursors, onFollowUser, currentUser }: PresencePanelProps) {
  // Only users with viewport data can be followed
  const followableUserIds = new Set(
    cursors?.filter((c) => c.viewportScale != null).map((c) => c.userId) ?? []
  );

  const currentDisplayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'You';

  return (
    <div data-tutorial-id="presence-panel" className="glass-playful rounded-2xl shadow-xl p-3.5 animate-float-up w-full">
      {/* Current user identity — emphasized */}
      {currentUser && (
        <div className="flex items-center gap-2.5 px-1 mb-2.5 pb-2.5 border-b border-gray-200/60">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md shrink-0"
            style={{
              background: `linear-gradient(135deg, ${currentUser.color}, ${currentUser.color}cc)`,
              boxShadow: `0 0 10px ${currentUser.color}50`,
            }}
          >
            {(currentDisplayName[0] ?? 'U').toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-gray-800 truncate">{currentDisplayName}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">You</span>
          </div>
        </div>
      )}
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
