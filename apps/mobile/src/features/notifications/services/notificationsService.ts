import { supabase } from '@shared/services/supabase';
import type { AppNotification } from '../types';

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as AppNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
}
