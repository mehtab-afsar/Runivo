import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { MapIcon, ActivityIcon, RunningIcon, CompetitionIcon, UserIcon } from '@/components/ui/icons'

const navigationItems = [
  {
    id: 'map',
    label: 'Map',
    icon: 'map',
    path: '/home'
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: 'activity',
    path: '/activity'
  },
  {
    id: 'run',
    label: 'RUN',
    icon: 'running',
    path: '/run',
    isEmphasis: true
  },
  {
    id: 'battle',
    label: 'Battle',
    icon: 'competition',
    path: '/compete'
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: 'user',
    path: '/profile'
  }
]

export const BottomNavigation: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => {
    if (path === '/home') {
      return location.pathname === '/' || location.pathname === '/home'
    }
    if (path === '/activity') {
      return location.pathname === '/activity' || location.pathname.startsWith('/activity/')
    }
    if (path === '/run') {
      return location.pathname === '/run' || location.pathname === '/active-run'
    }
    if (path === '/compete') {
      return location.pathname === '/compete' || location.pathname === '/leaderboards'
    }
    if (path === '/profile') {
      return location.pathname === '/profile' || location.pathname.startsWith('/profile/')
    }
    return location.pathname === path
  }

  const renderIcon = (iconType: string, isActiveTab: boolean, isEmphasis = false) => {
    const color = isActiveTab
      ? '#CAFF00'
      : isEmphasis
        ? 'rgba(202, 255, 0, 0.6)'
        : 'rgba(255, 255, 255, 0.4)';
    const size = isEmphasis ? 22 : 18;

    switch (iconType) {
      case 'map': return <MapIcon size={size} color={color} />;
      case 'activity': return <ActivityIcon size={size} color={color} />;
      case 'running': return <RunningIcon size={size} color={color} />;
      case 'competition': return <CompetitionIcon size={size} color={color} />;
      case 'user': return <UserIcon size={size} color={color} />;
      default: return <div style={{ width: size, height: size }} />;
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-runner-black/95 backdrop-blur-lg border-t border-runner-border z-50">
      <div className="safe-bottom">
        <div className="flex justify-around py-2">
          {navigationItems.map((item) => {
            const active = isActive(item.path);
            const isEmphasis = item.isEmphasis;

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all duration-200 relative',
                  active
                    ? 'text-runner-lime'
                    : isEmphasis
                      ? 'text-runner-lime/60 hover:text-runner-lime'
                      : 'text-runner-text-subtle hover:text-runner-text-muted',
                  isEmphasis && 'scale-110'
                )}
              >
                {/* Active indicator */}
                {active && (
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-runner-lime rounded-full"></div>
                )}

                {/* Special background for RUN tab */}
                {isEmphasis && (
                  <div className="absolute inset-0 bg-runner-lime/10 rounded-lg -z-10"></div>
                )}

                {renderIcon(item.icon, active, isEmphasis)}
                <span className={cn(
                  "font-medium text-xs uppercase tracking-wide",
                  isEmphasis && "font-bold"
                )}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  )
}
