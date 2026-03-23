import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@shared/services/supabase'
import type { Notification } from '../types'

let notificationsTableAvailable = true

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchNotifications = useCallback(async () => {
    if (!notificationsTableAvailable) { setLoading(false); return }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      notificationsTableAvailable = false
      setLoading(false)
      return
    }
    if (data) {
      setNotifications(data as Notification[])
      setUnreadCount(data.filter((n: Notification) => !n.read).length)
    }
    setLoading(false)
  }, [])

  const markAllRead = useCallback(async () => {
    if (!notificationsTableAvailable) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await supabase.rpc('mark_notifications_read')
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  const markOneRead = useCallback(async (id: string) => {
    if (!notificationsTableAvailable) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Realtime subscription — new notifications increment the badge counter
  useEffect(() => {
    if (!notificationsTableAvailable) return
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session || !notificationsTableAvailable) return

      const userId = session.user.id
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const newNotif = payload.new as Notification
            setNotifications(prev => [newNotif, ...prev])
            setUnreadCount(prev => prev + 1)
          }
        )
        .subscribe()

      if (cancelled) {
        supabase.removeChannel(channel)
        return
      }
      channelRef.current = channel
    })

    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  return { notifications, unreadCount, loading, markAllRead, markOneRead, refetch: fetchNotifications }
}
