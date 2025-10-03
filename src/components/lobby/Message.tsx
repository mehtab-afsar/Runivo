import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MessageProps {
  id: string
  userId: string
  userName: string
  userLevel: number
  avatar: string
  message: string
  timestamp: string
  isCurrentUser: boolean
}

export const Message = ({
  userName,
  userLevel,
  avatar,
  message,
  timestamp,
  isCurrentUser
}: MessageProps) => {

  return (
    <div className={cn(
      'flex gap-3 px-6 py-2',
      isCurrentUser ? 'flex-row-reverse' : 'flex-row'
    )}>
      {/* Avatar - only show for other users */}
      {!isCurrentUser && (
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            {avatar ? (
              <span className="text-sm">{avatar}</span>
            ) : (
              <User size={16} className="text-white/50" />
            )}
          </div>
        </div>
      )}

      {/* Message Content */}
      <div className={cn(
        'flex flex-col max-w-[75%]',
        isCurrentUser ? 'items-end' : 'items-start'
      )}>
        {/* User Info - only for other users */}
        {!isCurrentUser && (
          <div className="flex items-center gap-2 mb-1 px-3">
            <span className="text-xs font-light text-white/70">{userName}</span>
            <span className="text-xs text-white/40">Lv.{userLevel}</span>
          </div>
        )}

        {/* Message Bubble */}
        <div className={cn(
          'rounded-2xl px-3 py-2',
          isCurrentUser
            ? 'bg-primary/90 text-white'
            : 'liquid-blur-subtle text-white'
        )}>
          <p className="text-sm font-light leading-relaxed">{message}</p>
        </div>

        {/* Timestamp */}
        <div className={cn(
          'text-[10px] text-white/40 mt-0.5 px-3'
        )}>
          {timestamp}
        </div>
      </div>

      {/* Spacer for current user to align right */}
      {isCurrentUser && <div className="w-8" />}
    </div>
  )
}
