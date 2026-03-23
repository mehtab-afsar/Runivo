import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
import { NotificationItem } from '../components/NotificationItem'
import { T, F } from '@shared/design-system/tokens'

// Local overrides for values that differ from the standard token sheet
const pageBg = '#F7F5F2'
const black   = '#1A1A1A'
const t3      = 'rgba(0,0,0,0.35)'
const border  = 'rgba(0,0,0,0.07)'

export default function Notifications() {
  const { notifications, loading, markAllRead, markOneRead, unreadCount } = useNotifications()

  useEffect(() => {
    if (!loading && unreadCount > 0) markAllRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return (
    <div style={{ minHeight: '100%', background: pageBg, fontFamily: F, paddingBottom: 96 }}>

      {/* Header */}
      <div style={{ padding: '0 20px', paddingTop: 'max(20px, env(safe-area-inset-top))', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(217,53,24,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={18} color={T.red} strokeWidth={2} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: black, margin: 0 }}>Notifications</h1>
            {unreadCount > 0 && (
              <p style={{ fontSize: 12, color: T.red, margin: '1px 0 0', fontWeight: 600 }}>{unreadCount} unread</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{
                background: T.white, borderRadius: 16, padding: 16, border: `1px solid ${border}`,
                display: 'flex', gap: 12, alignItems: 'center',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: T.stone, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, width: '60%', background: T.stone, borderRadius: 6, marginBottom: 8 }} />
                  <div style={{ height: 11, width: '85%', background: T.stone, borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: T.stone, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Bell size={26} color={t3} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 17, fontWeight: 700, color: black, margin: '0 0 6px' }}>All caught up</p>
            <p style={{ fontSize: 13, color: t3, margin: 0, lineHeight: 1.5 }}>
              Territory claims, kudos and club<br />activity will appear here.
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ background: T.white, borderRadius: 18, border: `1px solid ${border}`, overflow: 'hidden' }}
          >
            {notifications.map((n, i) => (
              <div key={n.id} style={{ borderBottom: i < notifications.length - 1 ? `1px solid ${border}` : 'none' }}>
                <NotificationItem notification={n} onRead={markOneRead} />
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
