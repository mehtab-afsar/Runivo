import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Trophy, Calendar, Map, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LeaderboardDrawerContent } from './LeaderboardDrawerContent'
import { EventsDrawerContent } from './EventsDrawerContent'
import { TerritoriesDrawerContent } from './TerritoriesDrawerContent'
import { HistoryDrawerContent } from './HistoryDrawerContent'

export type FooterTabId = 'leaderboard' | 'events' | 'territories' | 'history'

interface SlidingDrawerProps {
  activeTab: FooterTabId
  onTabChange: (tab: FooterTabId) => void
}

export const SlidingDrawer = ({ activeTab, onTabChange }: SlidingDrawerProps) => {
  const location = useLocation()
  const navigate = useNavigate()

  const tabs = [
    { id: 'leaderboard' as FooterTabId, icon: Trophy, label: 'Leaderboard', path: '/leaderboard' },
    { id: 'events' as FooterTabId, icon: Calendar, label: 'Events', path: '/events' },
    { id: 'territories' as FooterTabId, icon: Map, label: 'Territories', path: '/territories' },
    { id: 'history' as FooterTabId, icon: History, label: 'History', path: '/history' }
  ]

  const isActive = (path: string) => location.pathname === path

  const renderDrawerContent = () => {
    switch (activeTab) {
      case 'leaderboard':
        return <LeaderboardDrawerContent isPeek={false} />
      case 'events':
        return <EventsDrawerContent isPeek={false} />
      case 'territories':
        return <TerritoriesDrawerContent isPeek={false} />
      case 'history':
        return <HistoryDrawerContent isPeek={false} />
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] h-[170px]">
      {/* Liquid Blur Background */}
      <div className="h-full sliding-drawer rounded-t-3xl">
        {/* Drag Handle */}
        <div className="w-12 h-1.5 bg-white/60 rounded-full mx-auto mt-2 mb-1 shadow-lg" />

        {/* Footer Tabs - Matching BottomNavigation styling */}
        <div className="flex justify-around items-center py-2 px-4">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const active = isActive(tab.path)

              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={cn(
                    'flex flex-col items-center gap-1 py-1.5 px-4 rounded-xl transition-all duration-200 relative',
                    'hover:bg-white/10 active:scale-95',
                    active && 'text-primary',
                    !active && 'text-muted-foreground'
                  )}
                >
                  <Icon size={24} strokeWidth={1.5} />
                  <span className={cn(
                    'text-[10px] font-light tracking-wide transition-colors',
                    active && 'font-normal'
                  )}>
                    {tab.label}
                  </span>

                  {/* Active indicator - minimal line */}
                  {active && (
                    <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </button>
              )
            })}
          </div>

        {/* Drawer Content */}
        <div className="overflow-hidden px-4 border-t border-white/10">
          {renderDrawerContent()}
        </div>
      </div>
    </div>
  )
}
