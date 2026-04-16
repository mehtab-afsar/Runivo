import React from 'react'
import { Bell, Heart, MessageCircle, MapPin, Calendar, Users, Flame, Shield, UserPlus } from 'lucide-react'
import type { Notification, NotificationType } from '../types'
import { T, F } from '@shared/design-system/tokens'

// Local overrides for values that differ from the standard token sheet
const black  = '#1A1A1A'
const t2     = 'rgba(0,0,0,0.55)'
const t3     = 'rgba(0,0,0,0.35)'
const redLo  = 'rgba(217,53,24,0.08)'

const ICON_CFG: Record<NotificationType, { icon: React.ReactNode; color: string; bg: string }> = {
  kudos:             { icon: <Heart size={15} strokeWidth={2} />,          color: '#D93518', bg: 'rgba(217,53,24,0.10)' },
  comment:           { icon: <MessageCircle size={15} strokeWidth={2} />,  color: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
  territory_claimed: { icon: <MapPin size={15} strokeWidth={2} />,         color: T.red,     bg: redLo },
  territory_lost:    { icon: <Shield size={15} strokeWidth={2} />,         color: '#9E6800', bg: 'rgba(158,104,0,0.10)' },
  event_reminder:    { icon: <Calendar size={15} strokeWidth={2} />,       color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
  club_join:         { icon: <Users size={15} strokeWidth={2} />,          color: '#1A6B40', bg: 'rgba(26,107,64,0.10)' },
  club_invite:       { icon: <Users size={15} strokeWidth={2} />,          color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
  streak:            { icon: <Flame size={15} strokeWidth={2} />,          color: '#9E6800', bg: 'rgba(158,104,0,0.10)' },
  system:            { icon: <Bell size={15} strokeWidth={2} />,           color: '#6B7280', bg: 'rgba(107,114,128,0.10)' },
  follow:            { icon: <UserPlus size={15} strokeWidth={2} />,       color: T.red,     bg: redLo },
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

export const NotificationItem = React.memo(function NotificationItem({ notification, onRead }: Props) {
  const cfg = ICON_CFG[notification.type] ?? ICON_CFG.system

  const handleClick = () => {
    if (!notification.read) onRead(notification.id)
    if (notification.action_url) window.location.href = notification.action_url
  }

  return (
    <button
      onClick={handleClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '14px 16px', textAlign: 'left', cursor: 'pointer', border: 'none',
        background: notification.read ? T.white : 'rgba(217,53,24,0.04)',
        fontFamily: F, transition: 'background 0.15s',
      }}
    >
      {/* Icon badge */}
      <div style={{
        flexShrink: 0, width: 36, height: 36, borderRadius: 10, marginTop: 1,
        background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: cfg.color,
      }}>
        {cfg.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13, lineHeight: 1.35, margin: '0 0 3px',
          color: notification.read ? t2 : black,
          fontWeight: notification.read ? 400 : 600,
        }}>
          {notification.title}
        </p>
        <p style={{ fontSize: 12, color: t3, margin: '0 0 4px', lineHeight: 1.4,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {notification.body}
        </p>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(0,0,0,0.25)', margin: 0 }}>
          {timeAgo(notification.created_at)}
        </p>
      </div>

      {/* Unread dot */}
      {!notification.read && (
        <div style={{ flexShrink: 0, width: 7, height: 7, borderRadius: '50%', background: T.red, marginTop: 6 }} />
      )}
    </button>
  )
})
