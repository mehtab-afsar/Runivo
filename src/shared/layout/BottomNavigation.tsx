import { useLocation, useNavigate } from 'react-router-dom'
import { haptic } from '@shared/lib/haptics'
import { useNavVisibility } from '@shared/hooks/useNavVisibility'
import { useTheme } from '@shared/hooks/useTheme'

const tabs = [
  { id: 'home', label: 'Home', path: '/home', icon: 'home' },
  { id: 'map', label: 'Map', path: '/territory-map', icon: 'map' },
  { id: 'run', label: 'Record', path: '/run', icon: 'run' },
  { id: 'feed', label: 'Feed', path: '/feed', icon: 'feed' },
  { id: 'profile', label: 'Profile', path: '/profile', icon: 'profile' },
] as const

function TabIcon({ type, active, dark }: { type: string; active: boolean; dark: boolean }) {
  const color = active ? '#00B4C6' : dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'
  const sw = 1.7

  switch (type) {
    case 'home':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          {/* Clean house with chimney detail */}
          <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V10.5z" fill={active ? 'rgba(0,180,198,0.1)' : 'none'} />
          <polyline points="9 22 9 13 15 13 15 22" />
        </svg>
      )
    case 'map':
      // 3 flat-top hexagons in triangular cluster — territory map
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Top center hex */}
          <polygon
            points="16,7 14,3.54 10,3.54 8,7 10,10.46 14,10.46"
            stroke={color}
            strokeWidth={sw}
            fill={active ? 'rgba(0,180,198,0.18)' : 'none'}
          />
          {/* Bottom-left hex */}
          <polygon
            points="11.5,15.5 9.5,12.04 5.5,12.04 3.5,15.5 5.5,18.96 9.5,18.96"
            stroke={color}
            strokeWidth={sw}
            fill="none"
          />
          {/* Bottom-right hex */}
          <polygon
            points="20.5,15.5 18.5,12.04 14.5,12.04 12.5,15.5 14.5,18.96 18.5,18.96"
            stroke={color}
            strokeWidth={sw}
            fill="none"
          />
        </svg>
      )
    case 'run':
      return null // Special button
    case 'feed':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          {/* Activity card layout */}
          <rect x="3" y="3" width="18" height="18" rx="3" fill={active ? 'rgba(0,180,198,0.08)' : 'none'} />
          {/* Top line (title) */}
          <line x1="7" y1="8.5" x2="17" y2="8.5" />
          {/* Small thumbnail box */}
          <rect x="7" y="11.5" width="4.5" height="4.5" rx="1" fill={active ? 'rgba(0,180,198,0.25)' : 'none'} />
          {/* Text lines next to thumbnail */}
          <line x1="13.5" y1="12.5" x2="17" y2="12.5" />
          <line x1="13.5" y1="14.5" x2="16" y2="14.5" />
          {/* Bottom divider */}
          <line x1="7" y1="18.5" x2="17" y2="18.5" strokeOpacity={0.5} />
        </svg>
      )
    case 'profile':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="7.5" r="3.5" fill={active ? 'rgba(0,180,198,0.15)' : 'none'} />
          <path d="M4.5 21c0-4.142 3.358-7 7.5-7s7.5 2.858 7.5 7" />
        </svg>
      )
    default:
      return null
  }
}

export const BottomNavigation = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { navVisible } = useNavVisibility()
  const { dark } = useTheme()
  if (!navVisible) return null

  const isActive = (path: string) => {
    if (path === '/home') return location.pathname === '/' || location.pathname === '/home'
    if (path === '/territory-map') return location.pathname === '/territory-map'
    if (path === '/run') return location.pathname === '/run' || location.pathname === '/active-run'
    if (path === '/feed') return location.pathname === '/feed'
    if (path === '/profile') return location.pathname === '/profile'
    return location.pathname === path
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border-t border-gray-200/60 dark:border-white/[0.08] shadow-[0_-1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_-1px_3px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-around px-2 h-16">
          {tabs.map((tab) => {
            const active = isActive(tab.path)

            if (tab.id === 'run') {
              return (
                <button
                  key={tab.id}
                  onClick={() => { navigate(tab.path); haptic('light'); }}
                  className="relative -mt-5 flex flex-col items-center"
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    active
                      ? 'bg-gradient-to-br from-teal-400 to-teal-600 shadow-[0_4px_24px_rgba(0,180,198,0.45)]'
                      : 'bg-gradient-to-br from-teal-500 to-teal-600 shadow-[0_2px_14px_rgba(0,180,198,0.25)]'
                  }`}>
                    {/* Running figure */}
                    <svg width="22" height="24" viewBox="0 0 22 24" fill="none">
                      {/* Head */}
                      <circle cx="12.5" cy="4" r="2.8" fill="white" />
                      {/* Body — slight forward lean */}
                      <path d="M12 6.8 L11 14.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
                      {/* Right arm forward */}
                      <path d="M11.5 9.5 L16.5 7.2" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      {/* Left arm back */}
                      <path d="M11.5 9.5 L7 11.8" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      {/* Left leg forward */}
                      <path d="M11 14.5 L15 22" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                      {/* Right leg back */}
                      <path d="M11 14.5 L6.5 21.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <span className={`text-[9px] mt-1 font-medium tracking-wide ${
                    active ? 'text-teal-600' : 'text-gray-400'
                  }`}>
                    {tab.label}
                  </span>
                </button>
              )
            }

            return (
              <button
                key={tab.id}
                onClick={() => { navigate(tab.path); haptic('light'); }}
                className="flex flex-col items-center gap-1 py-2 px-3 relative"
              >
                <TabIcon type={tab.icon} active={active} dark={dark} />
                <span className={`text-[9px] font-medium tracking-wide transition-colors ${
                  active ? 'text-teal-600' : 'text-gray-400'
                }`}>
                  {tab.label}
                </span>
                {active && (
                  <div className="absolute -bottom-0 w-5 h-0.5 rounded-full bg-teal-500 opacity-80" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
