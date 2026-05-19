import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Runivo — Own your city',
};

const features = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <polygon points="10,1 17,5 17,13 10,17 3,13 3,5" stroke="#C8391A" strokeWidth="1.5" fill="none" />
        <circle cx="10" cy="9" r="2" fill="#C8391A" />
      </svg>
    ),
    title: 'Territory Claiming',
    body: 'Run through zones to claim them as yours. Defend against rivals or conquer entire neighbourhoods.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <polygon points="10,2 12,8 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,8" stroke="#C8391A" strokeWidth="1.5" fill="none" />
      </svg>
    ),
    title: 'PACE Economy',
    body: 'Every kilometre earns PACE tokens. Spend them on exclusive gear discounts and partner rewards.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="8" stroke="#C8391A" strokeWidth="1.5" />
        <path d="M7 10c0-1.657 1.343-3 3-3s3 1.343 3 3-1.343 3-3 3" stroke="#C8391A" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="10" r="1" fill="#C8391A" />
      </svg>
    ),
    title: 'AI Coach',
    body: 'Your personal running coach analyses every run, adapts your plan, and keeps you at peak performance.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="7" cy="8" r="3" stroke="#C8391A" strokeWidth="1.5" />
        <circle cx="13" cy="8" r="3" stroke="#C8391A" strokeWidth="1.5" />
        <path d="M1 16c0-2.761 2.686-5 6-5M19 16c0-2.761-2.686-5-6-5M10 11c1.657 0 3 1.343 3 3v2H7v-2c0-1.657 1.343-3 3-3z" stroke="#C8391A" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    title: 'City Leaderboards',
    body: 'Compete with runners in your city. Climb the ranks, form clubs, and dominate local territory.',
  },
];

const steps = [
  { num: '01', title: 'Download the app', body: 'Available on iOS. Sign up in under 60 seconds.' },
  { num: '02', title: 'Lace up and run', body: 'GPS tracks your route in real time. Every step counts.' },
  { num: '03', title: 'Claim your territory', body: 'Run through zones to claim them. Return to defend.' },
  { num: '04', title: 'Earn & spend PACE', body: 'Convert kilometres into rewards with partner brands.' },
];

export default function HomePage() {
  return (
    <>
      <Nav />

      {/* Hero */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '120px 24px 80px',
        textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle radial glow behind headline */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,57,26,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <p style={{
          fontSize: 11, letterSpacing: '0.2em', color: 'var(--accent)',
          fontFamily: 'var(--font-body)', fontWeight: 600,
          textTransform: 'uppercase', marginBottom: 24,
        }}>
          The running app that fights back
        </p>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic',
          fontSize: 'clamp(56px, 8vw, 96px)',
          lineHeight: 1.05, letterSpacing: '-0.03em',
          color: 'var(--t1)',
          marginBottom: 24, maxWidth: 900,
        }}>
          Own your city.
        </h1>

        <p style={{
          fontSize: 'clamp(15px, 2vw, 18px)',
          color: 'var(--t2)', fontFamily: 'var(--font-body)', fontWeight: 300,
          lineHeight: 1.7, maxWidth: 520, marginBottom: 48,
        }}>
          Claim territory as you run. Earn PACE tokens. Compete with every runner in your city. This isn&apos;t a fitness tracker — it&apos;s a city-scale game.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="https://apps.apple.com" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 28px', borderRadius: 999,
            background: 'var(--accent)', color: '#fff',
            fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-body)',
            letterSpacing: '0.01em',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Download for iOS
          </a>
          <a href="#how-it-works" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '14px 28px', borderRadius: 999,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--t2)', fontSize: 15, fontFamily: 'var(--font-body)',
          }}>
            How it works
          </a>
        </div>

        {/* Phone mockup placeholder */}
        <div style={{
          marginTop: 80,
          width: 280, height: 520,
          borderRadius: 40,
          border: '1px solid var(--border)',
          background: 'linear-gradient(160deg, var(--surface) 0%, var(--bg) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 50% 30%, rgba(200,57,26,0.18) 0%, transparent 65%)',
          }} />
          <svg width="64" height="64" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.5 }}>
            <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="#C8391A" strokeWidth="1" fill="none" />
            <text x="16" y="21" textAnchor="middle" fontFamily="serif" fontSize="11" fill="#FFFFFF" fontStyle="italic">R</text>
          </svg>
        </div>
      </section>

      {/* Features grid */}
      <section style={{
        padding: '100px 24px',
        maxWidth: 'var(--max-w)', margin: '0 auto',
      }}>
        <p style={{
          fontSize: 11, letterSpacing: '0.16em', color: 'var(--t3)',
          fontFamily: 'var(--font-body)', fontWeight: 600,
          textTransform: 'uppercase', marginBottom: 16, textAlign: 'center',
        }}>
          Everything you need
        </p>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic',
          fontSize: 'clamp(32px, 4vw, 48px)',
          textAlign: 'center', marginBottom: 64,
          color: 'var(--t1)',
        }}>
          Running, reimagined.
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 1,
          border: '1px solid var(--border)',
          borderRadius: 24, overflow: 'hidden',
          background: 'var(--border)',
        }}>
          {features.map((f) => (
            <div key={f.title} style={{
              background: 'var(--bg)',
              padding: '36px 32px',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'var(--accent-muted)',
                border: '1px solid rgba(200,57,26,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {f.icon}
              </div>
              <div>
                <h3 style={{
                  fontSize: 16, fontWeight: 600,
                  fontFamily: 'var(--font-body)', color: 'var(--t1)',
                  marginBottom: 8,
                }}>
                  {f.title}
                </h3>
                <p style={{
                  fontSize: 14, color: 'var(--t3)',
                  fontFamily: 'var(--font-body)', lineHeight: 1.65,
                }}>
                  {f.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{
        padding: '100px 24px',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
          <p style={{
            fontSize: 11, letterSpacing: '0.16em', color: 'var(--t3)',
            fontFamily: 'var(--font-body)', fontWeight: 600,
            textTransform: 'uppercase', marginBottom: 16, textAlign: 'center',
          }}>
            How it works
          </p>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 'clamp(32px, 4vw, 48px)',
            textAlign: 'center', marginBottom: 72, color: 'var(--t1)',
          }}>
            From zero to city ruler.
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 40,
          }}>
            {steps.map((s) => (
              <div key={s.num} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <span style={{
                  fontFamily: 'var(--font-display)', fontStyle: 'italic',
                  fontSize: 40, color: 'var(--accent)', lineHeight: 1,
                  opacity: 0.7,
                }}>
                  {s.num}
                </span>
                <h3 style={{
                  fontSize: 17, fontWeight: 600, color: 'var(--t1)',
                  fontFamily: 'var(--font-body)', lineHeight: 1.3,
                }}>
                  {s.title}
                </h3>
                <p style={{
                  fontSize: 14, color: 'var(--t3)',
                  fontFamily: 'var(--font-body)', lineHeight: 1.65,
                }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{
        padding: '120px 24px',
        textAlign: 'center',
        maxWidth: 'var(--max-w)', margin: '0 auto',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic',
          fontSize: 'clamp(36px, 5vw, 64px)',
          color: 'var(--t1)', marginBottom: 20,
          letterSpacing: '-0.02em',
        }}>
          Ready to run?
        </h2>
        <p style={{
          fontSize: 16, color: 'var(--t2)', fontFamily: 'var(--font-body)',
          fontWeight: 300, lineHeight: 1.7,
          maxWidth: 420, margin: '0 auto 40px',
        }}>
          Join thousands of runners already claiming their city. Download Runivo and take your first step.
        </p>
        <a href="https://apps.apple.com" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '16px 36px', borderRadius: 999,
          background: 'var(--accent)', color: '#fff',
          fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-body)',
        }}>
          Download Runivo — Free
        </a>
        <p style={{
          fontSize: 12, color: 'var(--t3)', fontFamily: 'var(--font-body)',
          marginTop: 14,
        }}>
          iOS · Free to download
        </p>
      </section>

      <Footer />
    </>
  );
}
