import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DashboardHeaderProps {
  onLobbyClick?: () => void
  onClubClick?: () => void
}

export const DashboardHeader = ({
  onLobbyClick,
  onClubClick
}: DashboardHeaderProps) => {
  const [gameMode, setGameMode] = useState<'single' | 'multiplayer'>('single')

  return (
    <div className="w-full h-full liquid-blur-header">
      <div className="h-full flex items-center justify-between px-4">
        {/* Left Section - Private Lobby */}
        <button
          onClick={onLobbyClick}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-light text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <span>Private Lobby</span>
          <ChevronDown size={14} strokeWidth={1.5} />
        </button>

        {/* Center Section - Game Mode Toggle */}
        <div className="inline-flex bg-white/5 backdrop-blur-sm rounded-lg p-0.5">
          <button
            onClick={() => setGameMode('single')}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-light transition-all',
              gameMode === 'single'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-white/70 hover:text-white'
            )}
          >
            Single
          </button>
          <button
            onClick={() => setGameMode('multiplayer')}
            className={cn(
              'px-4 py-1.5 rounded-md text-xs font-light transition-all',
              gameMode === 'multiplayer'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-white/70 hover:text-white'
            )}
          >
            Multi
          </button>
        </div>

        {/* Right Section - My Club */}
        <button
          onClick={onClubClick}
          className="px-3 py-2 text-xs font-light text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          My Club
        </button>
      </div>
    </div>
  )
}
