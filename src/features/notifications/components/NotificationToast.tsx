import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, Bell, Heart, MessageCircle, Flame } from 'lucide-react'
import { supabase } from '@shared/services/supabase'
import type { Notification } from '../types'

const DISPLAY_MS = 4000

function ToastIcon({ type }: { type: Notification['type'] }) {
  if (type === 'follow')           return <UserPlus size={14} strokeWidth={2} className="text-teal-600" />
  if (type === 'kudos')            return <Heart size={14} strokeWidth={2} className="text-rose-500" />
  if (type === 'comment')          return <MessageCircle size={14} strokeWidth={2} className="text-blue-500" />
  if (type === 'streak')           return <Flame size={14} strokeWidth={2} className="text-orange-500" />
  return <Bell size={14} strokeWidth={2} className="text-gray-500" />
}

interface ToastData {
  id: string
  notif: Notification
}

/** Global top-right toast that fires whenever a new notification arrives via Supabase Realtime. */
export function NotificationToast() {
  const [toasts, setToasts] = useState<ToastData[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) { clearTimeout(timer); timersRef.current.delete(id) }
  }

  const push = (notif: Notification) => {
    const id = notif.id
    setToasts(prev => [{ id, notif }, ...prev].slice(0, 3)) // max 3 stacked
    const timer = setTimeout(() => dismiss(id), DISPLAY_MS)
    timersRef.current.set(id, timer)
  }

  useEffect(() => {
    let userId: string | null = null

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      userId = session.user.id

      const channel = supabase
        .channel(`notif-toast:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => { push(payload.new as Notification) }
        )
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    })

    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current.clear()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed top-[max(12px,env(safe-area-inset-top))] right-3 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(({ id, notif }) => (
          <motion.div
            key={id}
            layout
            initial={{ opacity: 0, x: 80, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className="pointer-events-auto"
          >
            <button
              onClick={() => dismiss(id)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-white
                         border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.10)]
                         max-w-[220px] text-left active:scale-95 transition-transform"
            >
              <div className="w-7 h-7 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                <ToastIcon type={notif.type} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-900 leading-tight truncate">{notif.title}</p>
                <p className="text-[10px] text-gray-400 leading-tight truncate mt-0.5">{notif.body}</p>
              </div>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
