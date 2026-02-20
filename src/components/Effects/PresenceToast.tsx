import { useEffect, useState } from 'react';
import type { PresenceToast } from '../../hooks/usePresenceToasts';

interface PresenceToastContainerProps {
  toasts: PresenceToast[];
}

function ToastItem({ toast }: { toast: PresenceToast }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`glass-playful rounded-xl px-4 py-2 text-sm font-medium text-gray-700 shadow-lg transition-all duration-300 ${
        exiting ? 'opacity-0 translate-y-[-8px]' : 'animate-float-up'
      }`}
    >
      {toast.type === 'join' ? (
        <span>{toast.name} just dropped in <span role="img" aria-label="wave">👋</span></span>
      ) : (
        <span>{toast.name} bounced <span role="img" aria-label="peace">✌️</span></span>
      )}
    </div>
  );
}

export function PresenceToastContainer({ toasts }: PresenceToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9998] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
