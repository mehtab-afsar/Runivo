import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotifications, type TerritoryNotification } from '@/hooks/useNotifications';

interface NotificationItemProps {
  notification: TerritoryNotification;
  onMarkAsRead: (id: string) => void;
  onRemove: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onMarkAsRead, onRemove }) => {
  const getTypeColor = (type: TerritoryNotification['type']) => {
    switch (type) {
      case 'territory_attacked': return 'text-stealth-error';
      case 'territory_lost': return 'text-stealth-error';
      case 'territory_claimed': return 'text-stealth-success';
      case 'rival_nearby': return 'text-stealth-warning';
      case 'achievement_unlocked': return 'text-stealth-lime';
      default: return 'text-stealth-white';
    }
  };

  const getPriorityIndicator = (priority: TerritoryNotification['priority']) => {
    switch (priority) {
      case 'high': return 'bg-stealth-error';
      case 'medium': return 'bg-stealth-warning';
      case 'low': return 'bg-stealth-success';
    }
  };

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div
      className={`bg-stealth-card border border-stealth-border rounded-xl p-4 ${
        !notification.isRead ? 'border-stealth-lime/30' : ''
      } transition-all hover:border-stealth-lime/50`}
    >
      <div className="flex items-start gap-3">
        {/* Priority Indicator */}
        <div className={`w-2 h-2 rounded-full ${getPriorityIndicator(notification.priority)} mt-2 flex-shrink-0`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className={`text-body-lg font-medium ${getTypeColor(notification.type)} mb-1`}>
            {notification.title}
          </div>
          <div className="text-body text-stealth-gray mb-2">
            {notification.message}
          </div>
          <div className="flex justify-between items-center">
            <div className="text-caption text-stealth-gray-dark">
              {formatTime(notification.timestamp)}
            </div>
            {notification.actionRequired && (
              <div className="text-xs text-stealth-warning font-medium">
                ACTION REQUIRED
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-shrink-0">
          {!notification.isRead && (
            <button
              onClick={() => onMarkAsRead(notification.id)}
              className="text-stealth-lime hover:text-stealth-lime-hover text-xs font-medium"
            >
              Mark Read
            </button>
          )}
          <button
            onClick={() => onRemove(notification.id)}
            className="text-stealth-gray-dark hover:text-stealth-error text-xs"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export const NotificationCenter: React.FC = () => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    getUnreadNotifications,
    getHighPriorityNotifications,
  } = useNotifications();

  const [filter, setFilter] = useState<'all' | 'unread' | 'high_priority'>('all');

  const filteredNotifications = () => {
    switch (filter) {
      case 'unread':
        return getUnreadNotifications();
      case 'high_priority':
        return getHighPriorityNotifications();
      default:
        return notifications;
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  return (
    <div className="container mx-auto px-5 py-16 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-h1">Notifications</h1>
          <p className="text-body text-stealth-gray">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
          </p>
        </div>
        {notifications.length > 0 && (
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="secondary" size="sm" onClick={handleMarkAllAsRead}>
                Mark All Read
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={clearAll}>
              Clear All
            </Button>
          </div>
        )}
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All', count: notifications.length },
          { key: 'unread', label: 'Unread', count: unreadCount },
          { key: 'high_priority', label: 'High Priority', count: getHighPriorityNotifications().length },
        ].map((filterOption) => (
          <button
            key={filterOption.key}
            onClick={() => setFilter(filterOption.key as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              filter === filterOption.key
                ? 'bg-stealth-lime text-stealth-black'
                : 'bg-stealth-card text-stealth-gray hover:text-stealth-white border border-stealth-border'
            }`}
          >
            {filterOption.label} ({filterOption.count})
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {filteredNotifications().length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-h2 text-stealth-gray mb-2">📭</div>
              <div className="text-body text-stealth-gray">
                {filter === 'all' && 'No notifications yet'}
                {filter === 'unread' && 'No unread notifications'}
                {filter === 'high_priority' && 'No high priority notifications'}
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications().map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
              onRemove={removeNotification}
            />
          ))
        )}
      </div>

      {/* Quick Actions */}
      {getHighPriorityNotifications().length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-stealth-error">⚡ Urgent Actions Required</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getHighPriorityNotifications().slice(0, 3).map((notification) => (
                <div key={notification.id} className="flex justify-between items-center p-2 bg-stealth-surface rounded-lg">
                  <div className="text-sm text-stealth-gray">
                    {notification.message}
                  </div>
                  <Button size="sm" variant="destructive">
                    Take Action
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};