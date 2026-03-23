import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@shared/services/supabase';
import type { AppNotification } from '../types';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../services/notificationsService';

export interface NotificationsState {
  notifs: AppNotification[];
  loading: boolean;
  refreshing: boolean;
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  refresh: () => void;
}

export function useNotifications(): NotificationsState {
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await fetchNotifications();
      setNotifs(data);
    } catch { /* offline */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await markAllNotificationsRead(session.user.id);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const refresh = useCallback(() => load(true), [load]);
  const unreadCount = notifs.filter(n => !n.read).length;

  return { notifs, loading, refreshing, unreadCount, markRead, markAllRead, refresh };
}
