import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import { NotificationItem } from './NotificationItem'

export function NotificationBell({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { notifications, unreadCount, loading, markAllRead, markOneRead } = useNotifications()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button — matches the currency pill style in the header */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors
          ${variant === 'light'
            ? 'bg-white border border-gray-100 shadow-sm active:bg-gray-50'
            : 'bg-white/10 active:bg-white/20'
          }`}
        aria-label="Notifications"
      >
        <Bell size={15} strokeWidth={1.8} className={variant === 'light' ? 'text-gray-500' : 'text-white'} />
        {unreadCount > 0 && (
          <motion.span
            key={unreadCount}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-teal-500 text-[9px] font-bold text-white leading-none"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="absolute right-0 top-full mt-2 w-80 z-50 bg-white rounded-2xl border border-gray-100 shadow-[0_8px_32px_rgba(0,0,0,0.10)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-stat text-[10px] font-bold text-white bg-teal-500 rounded-full px-1.5 py-0.5 leading-none">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className="text-[11px] text-teal-600 font-medium active:opacity-70"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto overscroll-contain divide-y divide-gray-50">
              {loading ? (
                <div className="py-10 text-center">
                  <div className="w-6 h-6 rounded-full border-2 border-teal-200 border-t-teal-500 animate-spin mx-auto" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell size={28} strokeWidth={1.2} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No notifications yet</p>
                </div>
              ) : (
                notifications.slice(0, 8).map(n => (
                  <NotificationItem key={n.id} notification={n} onRead={markOneRead} />
                ))
              )}
            </div>

            {/* Footer */}
            <button
              onClick={() => { setOpen(false); navigate('/notifications') }}
              className="w-full py-3 text-xs font-semibold text-teal-600 border-t border-gray-100 active:bg-gray-50 transition-colors"
            >
              See all notifications
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
