import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { NotificationItem } from '../components/NotificationItem'

export default function Notifications() {
  const { notifications, loading, markAllRead, markOneRead, unreadCount } = useNotifications()

  // Auto-mark all read when page is opened
  useEffect(() => {
    if (!loading && unreadCount > 0) {
      markAllRead()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 pt-8 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Bell size={22} className="text-[#E8435A]" />
          <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <Bell size={40} className="text-white/20" />
            <p className="text-white/40 text-sm">No notifications yet.</p>
            <p className="text-white/25 text-xs">Territory claims, kudos and club activity will appear here.</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-white/10 overflow-hidden divide-y divide-white/5"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            {notifications.map(n => (
              <NotificationItem key={n.id} notification={n} onRead={markOneRead} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
