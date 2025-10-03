import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Home, TrendingUp, Circle, User } from 'lucide-react'

const navigationItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'home',
    path: '/home'
  },
  {
    id: 'feed',
    label: 'Feed',
    icon: 'feed',
    path: '/feed'
  },
  {
    id: 'run',
    label: 'Record',
    icon: 'run',
    path: '/active-run',
    isEmphasis: true
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: 'user',
    path: '/profile'
  }
]

export const BottomNavigation = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => {
    if (path === '/home') {
      return location.pathname === '/' || location.pathname === '/home'
    }
    if (path === '/feed') {
      return location.pathname === '/feed' || location.pathname.startsWith('/feed/')
    }
    if (path === '/active-run') {
      return location.pathname === '/run' || location.pathname === '/active-run'
    }
    if (path === '/profile') {
      return location.pathname === '/profile' || location.pathname.startsWith('/profile/')
    }
    return location.pathname === path
  }

  const renderIcon = (iconType: string, isActiveTab: boolean, isEmphasis = false) => {
    const size = isEmphasis ? 28 : 24;
    const strokeWidth = 1.5;

    const iconClass = cn(
      'transition-colors',
      isActiveTab && 'text-primary',
      !isActiveTab && !isEmphasis && 'text-muted-foreground',
      !isActiveTab && isEmphasis && 'text-primary/70'
    );

    switch (iconType) {
      case 'home': return <Home size={size} strokeWidth={strokeWidth} className={iconClass} />;
      case 'feed': return <TrendingUp size={size} strokeWidth={strokeWidth} className={iconClass} />;
      case 'run': return <Circle size={size} strokeWidth={strokeWidth} className={iconClass} fill={isActiveTab || isEmphasis ? 'currentColor' : 'none'} />;
      case 'user': return <User size={size} strokeWidth={strokeWidth} className={iconClass} />;
      default: return <div style={{ width: size, height: size }} />;
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 liquid-blur-footer z-50 safe-area-bottom">
      <div className="flex justify-around items-center py-3 px-4">
          {navigationItems.map((item) => {
            const active = isActive(item.path);
            const isEmphasis = item.isEmphasis;

            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-2 px-4 rounded-xl transition-all duration-200 relative',
                  'hover:bg-secondary/50 active:scale-95',
                  active && 'text-primary',
                  !active && 'text-muted-foreground',
                  isEmphasis && 'scale-105'
                )}
              >
                {/* Special styling for Record button */}
                {isEmphasis && (
                  <div className={cn(
                    "absolute inset-0 rounded-xl -z-10 transition-all",
                    active ? "bg-primary/10" : "bg-primary/5"
                  )}></div>
                )}

                {renderIcon(item.icon, active, isEmphasis)}

                <span className={cn(
                  "text-[10px] font-light tracking-wide transition-colors",
                  active && "font-normal"
                )}>
                  {item.label}
                </span>

                {/* Active indicator - minimal line */}
                {active && !isEmphasis && (
                  <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"></div>
                )}
              </button>
            );
          })}
      </div>
    </div>
  )
}
