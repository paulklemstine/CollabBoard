import type { PresenceUser } from '../../types/board';

interface PresencePanelProps {
  users: PresenceUser[];
}

export function PresencePanel({ users }: PresencePanelProps) {
  return (
    <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-3 z-50">
      <div className="text-sm font-medium text-gray-600 mb-2">
        Online: {users.length}
      </div>
      <div className="flex flex-col gap-1">
        {users.map((user) => (
          <div key={user.uid} className="flex items-center gap-2">
            <div
              data-testid={`presence-dot-${user.uid}`}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: user.color }}
            />
            <span className="text-sm">{user.displayName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
