import { haptic } from '@shared/lib/haptics';
import { T, F, FD, BASE_CSS, HexMark } from '../components/shared';

interface LandingPageProps {
  onSignIn: () => void;
  onCreateAccount: () => void;
}

export function LandingPage({ onSignIn, onCreateAccount }: LandingPageProps) {
  return (
    <div style={{
      minHeight: '100dvh', background: '#ECEAE6',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '20px 20px 0', boxSizing: 'border-box',
    }}>
      <style>{BASE_CSS}</style>

      <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* ── Hero card ──────────────────────────────────────────────────── */}
        <div style={{ borderRadius: 20, overflow: 'hidden', position: 'relative', background: T.bg }}>

          {/* Grain */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, opacity: 0.03, pointerEvents: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }} />

          {/* Vignette */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 40%, rgba(220,215,208,0.35) 100%)',
          }} />

          {/* Navbar */}
          <nav style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HexMark size={22} darkColor={T.black} lightColor={T.hexMuted} strokeWidth={1.6} />
              <span style={{ fontFamily: F, fontWeight: 300, fontSize: 14, color: T.black, letterSpacing: '-0.01em' }}>runivo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button onClick={() => { haptic('light'); onSignIn(); }} style={{ background: 'none', border: 'none', fontFamily: F, fontSize: 10, fontWeight: 300, color: T.t3, cursor: 'pointer', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>
                Sign in
              </button>
              <button
                onClick={() => { haptic('light'); onCreateAccount(); }}
                style={{ padding: '7px 16px', borderRadius: 3, background: T.black, color: '#fff', border: 'none', fontFamily: F, fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.08em', cursor: 'pointer' }}
              >
                Get started
              </button>
            </div>
          </nav>

          {/* Hero */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 40px 56px', textAlign: 'center' }}>
            <div style={{ marginBottom: 10 }}>
              <HexMark size={88} darkColor={T.red} lightColor={T.redLight} strokeWidth={4.5} animated />
            </div>

            <div style={{ fontSize: 9, fontFamily: F, fontWeight: 400, color: T.t3, textTransform: 'uppercase' as const, letterSpacing: '0.18em', marginBottom: 28 }}>
              Run · Capture · Conquer
            </div>

            <div style={{ fontFamily: FD, fontStyle: 'italic', fontSize: 'clamp(36px, 8vw, 56px)', color: T.black, letterSpacing: '-0.03em', lineHeight: 0.95, marginBottom: 20, animation: 'fadeUp 0.7s 0.2s ease both' }}>
              Your city is<br /><span style={{ color: T.red }}>territory.</span>
            </div>

            <p style={{ fontSize: 14, fontFamily: F, fontWeight: 300, color: T.t2, lineHeight: 1.7, maxWidth: 400, margin: '0 0 32px', animation: 'fadeUp 0.7s 0.35s ease both' }}>
              Turn every run into conquest. Claim hex zones, build your empire, climb the leaderboard.
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, justifyContent: 'center', animation: 'fadeUp 0.7s 0.45s ease both', marginBottom: 16, marginTop: 64 }}>
              <button
                onClick={() => { haptic('light'); onCreateAccount(); }}
                style={{ padding: '14px 32px', borderRadius: 4, background: T.black, color: '#fff', fontFamily: F, fontSize: 12, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.08em', border: 'none', cursor: 'pointer' }}
              >
                Create account
              </button>
              <button
                onClick={() => { haptic('light'); onSignIn(); }}
                style={{ padding: '14px 32px', borderRadius: 4, background: 'transparent', color: T.black, fontFamily: F, fontSize: 12, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.08em', border: `0.5px solid ${T.border}`, cursor: 'pointer' }}
              >
                Sign in
              </button>
            </div>

            <div style={{ fontSize: 10, fontFamily: F, fontWeight: 300, color: T.t3, animation: 'fadeUp 0.7s 0.55s ease both' }}>
              Free to start · No credit card required
            </div>
          </div>

        </div>

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
