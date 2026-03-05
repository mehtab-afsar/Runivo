import { useLocation, useNavigate } from 'react-router-dom'
import { haptic } from '@shared/lib/haptics'
import { useNavVisibility } from '@shared/hooks/useNavVisibility'

const tabs = [
  { id: 'home', label: 'Home', path: '/home', icon: 'home' },
  { id: 'map', label: 'Map', path: '/territory-map', icon: 'map' },
  { id: 'run', label: 'Record', path: '/run', icon: 'run' },
  { id: 'feed', label: 'Feed', path: '/feed', icon: 'feed' },
  { id: 'profile', label: 'Profile', path: '/profile', icon: 'profile' },
] as const

function TabIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? '#00B4C6' : 'rgba(0,0,0,0.3)'
  const sw = 1.8

  switch (type) {
    case 'home':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      )
    case 'map':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
      )
    case 'run':
      return null // Special button
    case 'feed':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
      )
    case 'profile':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
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
      <div className="bg-white/95 backdrop-blur-xl border-t border-gray-200/60 shadow-[0_-1px_3px_rgba(0,0,0,0.04)]">
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
                      ? 'bg-gradient-to-br from-teal-500 to-teal-600 shadow-[0_4px_20px_rgba(0,180,198,0.35)]'
                      : 'bg-gradient-to-br from-teal-500 to-teal-600 shadow-[0_2px_12px_rgba(0,180,198,0.2)]'
                  }`}>
                    <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
                      <path d="M2 0L20 11L2 22V0Z" fill="white" />
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
                <TabIcon type={tab.icon} active={active} />
                <span className={`text-[9px] font-medium tracking-wide transition-colors ${
                  active ? 'text-teal-600' : 'text-gray-400'
                }`}>
                  {tab.label}
                </span>
                {active && (
                  <div className="absolute -bottom-0 w-1 h-1 rounded-full bg-teal-500" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
