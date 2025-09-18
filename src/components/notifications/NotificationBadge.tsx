import React from 'react';
import { useNotifications } from '@/hooks/useNotifications';

interface NotificationBadgeProps {
  className?: string;
  onClick?: () => void;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({ className = '', onClick }) => {
  const { unreadCount, getHighPriorityNotifications } = useNotifications();
  const hasHighPriority = getHighPriorityNotifications().length > 0;

  if (unreadCount === 0) {
    return (
      <button
        className={`relative p-2 text-stealth-gray hover:text-stealth-white transition-colors ${className}`}
        onClick={onClick}
      >
        🔔
      </button>
    );
  }

  return (
    <button
      className={`relative p-2 text-stealth-white hover:text-stealth-lime transition-colors ${className}`}
      onClick={onClick}
    >
      <span className="text-xl">🔔</span>

      {/* Notification Count Badge */}
      <div className={`absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full text-xs font-bold flex items-center justify-center text-stealth-black ${
        hasHighPriority ? 'bg-stealth-error animate-pulse' : 'bg-stealth-lime'
      }`}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </div>

      {/* Pulsing Ring for High Priority */}
      {hasHighPriority && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-stealth-error rounded-full animate-ping opacity-75" />
      )}
    </button>
  );
};