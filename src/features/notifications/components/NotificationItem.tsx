import { Bell, Heart, MessageCircle, MapPin, Calendar, Users, Flame, Shield, UserPlus } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import type { Notification, NotificationType } from '../types'

const iconConfig: Record<NotificationType, { icon: React.ReactNode; bg: string }> = {
  kudos:             { icon: <Heart size={15} strokeWidth={2} className="text-rose-500" />,     bg: 'bg-rose-50' },
  comment:           { icon: <MessageCircle size={15} strokeWidth={2} className="text-blue-500" />,  bg: 'bg-blue-50' },
  territory_claimed: { icon: <MapPin size={15} strokeWidth={2} className="text-teal-600" />,    bg: 'bg-teal-50' },
  territory_lost:    { icon: <Shield size={15} strokeWidth={2} className="text-orange-500" />,  bg: 'bg-orange-50' },
  event_reminder:    { icon: <Calendar size={15} strokeWidth={2} className="text-purple-500" />, bg: 'bg-purple-50' },
  club_join:         { icon: <Users size={15} strokeWidth={2} className="text-emerald-600" />,  bg: 'bg-emerald-50' },
  club_invite:       { icon: <Users size={15} strokeWidth={2} className="text-violet-500" />,   bg: 'bg-violet-50' },
  streak:            { icon: <Flame size={15} strokeWidth={2} className="text-orange-500" />,   bg: 'bg-orange-50' },
  system:            { icon: <Bell size={15} strokeWidth={2} className="text-gray-500" />,      bg: 'bg-gray-100' },
  follow:            { icon: <UserPlus size={15} strokeWidth={2} className="text-teal-600" />,  bg: 'bg-teal-50' },
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

interface Props {
  notification: Notification
  onRead: (id: string) => void
}

export function NotificationItem({ notification, onRead }: Props) {
  const { icon, bg } = iconConfig[notification.type] ?? iconConfig.system

  const handleClick = () => {
    if (!notification.read) onRead(notification.id)
    if (notification.action_url) window.location.href = notification.action_url
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors active:bg-gray-50',
        !notification.read ? 'bg-teal-50/40' : 'bg-white'
      )}
    >
      <div className={cn('flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5', bg)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', notification.read ? 'text-gray-500 font-normal' : 'text-gray-900 font-semibold')}>
          {notification.title}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{notification.body}</p>
        <p className="text-[10px] text-gray-300 mt-1 uppercase tracking-wide">{timeAgo(notification.created_at)}</p>
      </div>
      {!notification.read && (
        <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-teal-500 mt-2" />
      )}
    </button>
  )
}
