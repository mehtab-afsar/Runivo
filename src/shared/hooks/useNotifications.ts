import { useState, useEffect, useCallback } from 'react';

export interface TerritoryNotification {
  id: string;
  type: 'territory_claimed' | 'territory_lost' | 'territory_attacked' | 'rival_nearby' | 'achievement_unlocked';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  priority: 'high' | 'medium' | 'low';
  territoryId?: string;
  rivalId?: string;
  actionRequired?: boolean;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<TerritoryNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isEnabled, setIsEnabled] = useState(true);

  // Mock notification generator for demonstration
  const generateMockNotifications = useCallback(() => {
    const mockNotifications: TerritoryNotification[] = [
      {
        id: '1',
        type: 'territory_attacked',
        title: '🚨 Territory Under Attack!',
        message: 'Your territory "Central Park" is being contested by SpeedRunner',
        timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
        isRead: false,
        priority: 'high',
        territoryId: 'territory-15',
        rivalId: 'rival-1',
        actionRequired: true,
      },
      {
        id: '2',
        type: 'territory_claimed',
        title: '🎉 Territory Claimed!',
        message: 'You successfully claimed "River District" during your last run',
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        isRead: false,
        priority: 'medium',
        territoryId: 'territory-23',
      },
      {
        id: '3',
        type: 'rival_nearby',
        title: '👀 Rival Spotted',
        message: 'TerritoryKing is active 0.8km from your position',
        timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        isRead: true,
        priority: 'medium',
        rivalId: 'rival-2',
      },
      {
        id: '4',
        type: 'territory_lost',
        title: '💔 Territory Lost',
        message: 'Your territory "Market Square" was captured by FastFeet',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        isRead: true,
        priority: 'high',
        territoryId: 'territory-7',
        rivalId: 'rival-3',
        actionRequired: true,
      },
      {
        id: '5',
        type: 'achievement_unlocked',
        title: '🏆 Achievement Unlocked!',
        message: 'You earned "Speed Demon" - Sub 5:00 pace achieved',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
        isRead: true,
        priority: 'low',
      },
    ];

    return mockNotifications;
  }, []);

  // Initialize notifications
  useEffect(() => {
    const initialNotifications = generateMockNotifications();
    setNotifications(initialNotifications);
    setUnreadCount(initialNotifications.filter(n => !n.isRead).length);
  }, [generateMockNotifications]);

  // Request permission for browser notifications
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    setIsEnabled(granted);
    return granted;
  }, []);

  // Show browser notification
  const showBrowserNotification = useCallback((notification: TerritoryNotification) => {
    if (!isEnabled || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const browserNotification = new Notification(notification.title, {
      body: notification.message,
      icon: '/vite.svg', // You can replace with a proper icon
      badge: '/vite.svg',
      tag: notification.id,
      requireInteraction: notification.priority === 'high',
    });

    browserNotification.onclick = () => {
      browserNotification.close();
      // You could navigate to a specific page or open the app
      window.focus();
    };

    // Auto-close after 5 seconds for non-high priority notifications
    if (notification.priority !== 'high') {
      setTimeout(() => browserNotification.close(), 5000);
    }
  }, [isEnabled]);

  // Add new notification
  const addNotification = useCallback((notification: Omit<TerritoryNotification, 'id' | 'timestamp' | 'isRead'>) => {
    const newNotification: TerritoryNotification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      isRead: false,
    };

    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Show browser notification
    showBrowserNotification(newNotification);

    return newNotification.id;
  }, [showBrowserNotification]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )
    );

    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, isRead: true }))
    );
    setUnreadCount(0);
  }, []);

  // Remove notification
  const removeNotification = useCallback((notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);

    setNotifications(prev => prev.filter(n => n.id !== notificationId));

    if (notification && !notification.isRead) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, [notifications]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Get notifications by type
  const getNotificationsByType = useCallback((type: TerritoryNotification['type']) => {
    return notifications.filter(notification => notification.type === type);
  }, [notifications]);

  // Get unread notifications
  const getUnreadNotifications = useCallback(() => {
    return notifications.filter(notification => !notification.isRead);
  }, [notifications]);

  // Get high priority notifications
  const getHighPriorityNotifications = useCallback(() => {
    return notifications.filter(notification => notification.priority === 'high' && !notification.isRead);
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    isEnabled,
    requestPermission,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    getNotificationsByType,
    getUnreadNotifications,
    getHighPriorityNotifications,
  };
};