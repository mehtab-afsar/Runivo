import { useLocation, useNavigate } from 'react-router-dom'
import { haptic } from '@shared/lib/haptics'

const F = "'Barlow', system-ui, sans-serif"

const HIDE_ON: string[] = [
  '/run',
  '/active-run',
  '/run-summary',
  '/missions',
  '/events/create',
  '/subscription',
  '/settings',
  '/calories',
]

const TABS = [
  { id: 'home',    label: 'Home',    path: '/home'         },
  { id: 'map',     label: 'Map',     path: '/territory-map' },
  { id: 'run',     label: 'Record',  path: '/run'          },
  { id: 'feed',    label: 'Feed',    path: '/feed'         },
  { id: 'profile', label: 'Profile', path: '/profile'      },
] as const

const INACTIVE   = '#C4C0BA'
const ACTIVE_RED = '#D93518'
const ACTIVE_INK = '#0A0A0A'

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconHome({ color, sw }: { color: string; sw: number }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color}>
      <path d="M3 10.5L12 3L21 10.5V21H15V15H9V21H3V10.5Z"
        strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconMap({ color, sw }: { color: string; sw: number }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color}>
      <path d="M22 2L11 13" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 2L15 22L11 13L2 9L22 2Z" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconRecord() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <polygon points="7 5 20 12 7 19 7 5" fill="white" />
    </svg>
  )
}

function IconFeed({ color, sw }: { color: string; sw: number }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
        strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="13" r="4" strokeWidth={sw}/>
    </svg>
  )
}

function IconProfile({ color, sw }: { color: string; sw: number }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color}>
      <circle cx="12" cy="7" r="4" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 21C4 17.13 7.58 14 12 14C16.42 14 20 17.13 20 21"
        strokeWidth={sw} strokeLinecap="round"/>
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const BottomNavigation = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const shouldHide = HIDE_ON.some(r => location.pathname.startsWith(r))

  const isActive = (path: string) => {
    if (path === '/home')          return location.pathname === '/' || location.pathname === '/home'
    if (path === '/territory-map') return location.pathname === '/territory-map'
    if (path === '/run')           return location.pathname === '/run' || location.pathname === '/active-run'
    if (path === '/feed')          return location.pathname === '/feed'
    if (path === '/profile')       return location.pathname === '/profile'
    return location.pathname === path
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'rgba(245,243,239,0.72)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '0.5px solid rgba(255,255,255,0.5)',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.06)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-around',
      paddingTop: 5,
      paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      transform: shouldHide ? 'translateY(100%)' : 'translateY(0)',
      transition: shouldHide
        ? 'transform 280ms cubic-bezier(0.4, 0, 1, 1)'
        : 'transform 300ms cubic-bezier(0, 0, 0.2, 1)',
    }}>
      {TABS.map(tab => {
        const active    = isActive(tab.path)
        const isProfile = tab.id === 'profile'
        const color     = active ? (isProfile ? ACTIVE_INK : ACTIVE_RED) : INACTIVE
        const sw        = active ? 1.8 : 1.5
        const fw        = active ? 700 : 400

        // ── Record — always red circle ──────────────────────────────────────
        if (tab.id === 'run') {
          return (
            <button
              key="run"
              onClick={() => { navigate(tab.path); haptic('medium') }}
              aria-label="Start a run"
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 5,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                minHeight: 44,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: '#D93518',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: -10,
                boxShadow: active ? '0 2px 10px rgba(217,53,24,0.35)' : 'none',
                transition: 'box-shadow 150ms',
              }}>
                <IconRecord />
              </div>
              <span style={{
                fontFamily: F, fontSize: 10, fontWeight: 500,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: '#D93518',
              }}>
                {tab.label}
              </span>
            </button>
          )
        }

        return (
          <button
            key={tab.id}
            onClick={() => { navigate(tab.path); haptic('light') }}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 5,
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              minHeight: 44,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {tab.id === 'home'    && <IconHome    color={color} sw={sw} />}
            {tab.id === 'map'     && <IconMap     color={color} sw={sw} />}
            {tab.id === 'feed'    && <IconFeed    color={color} sw={sw} />}
            {tab.id === 'profile' && <IconProfile color={color} sw={sw} />}

            <span style={{
              fontFamily: F,
              fontSize: 10,
              fontWeight: fw,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color,
              transition: 'color 150ms, font-weight 150ms',
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
