import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { ApplyForm } from './ApplyForm';

export const metadata: Metadata = {
  title: 'Partners — Runivo',
  description: 'Put your brand in front of runners in your city, at the moment they’ve earned a reward. Apply to the Runivo PACE Store.',
};

const eyebrow = {
  fontSize: 11, letterSpacing: '0.16em', color: 'var(--accent)',
  fontFamily: 'var(--font-body)', fontWeight: 600, textTransform: 'uppercase' as const, marginBottom: 16,
};
const h2 = {
  fontFamily: 'var(--font-display)', fontStyle: 'italic' as const,
  fontSize: 'clamp(28px, 3.6vw, 40px)', color: 'var(--t1)', letterSpacing: '-0.02em', marginBottom: 16,
};
const body = { fontSize: 15, color: 'var(--t2)', fontFamily: 'var(--font-body)', lineHeight: 1.7 };
const card = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: 28,
};

const WHY = [
  { title: 'Runners in your city', body: 'Rewards can be limited to the cities you serve, so every redemption is someone who can actually walk into your store.' },
  { title: 'At the moment they’ve earned it', body: 'Runners spend PACE they earned on their own runs. Your offer lands right after a good week, not between ads.' },
  { title: 'Codes you control', body: 'Upload single-use codes. Each runner gets one, once, and only after 3 runs and 14 days on Runivo.' },
  { title: 'Reports without personal data', body: 'Every month: views, redemptions and redemption rate, by city and runner rank. Never names or contact details.' },
];

const LEVELS = [
  { level: 'Entry', pace: '50 to 100', time: 'About a week of running', example: '20% off running shoes' },
  { level: 'Mid', pace: '200 to 400', time: '3 to 4 weeks', example: 'Free gait analysis, race entry discount' },
  { level: 'Premium', pace: '1,000 to 1,500', time: 'About 3 months, Hunter rank and up', example: 'Free shoes, a sports massage' },
];

const STEPS = [
  ['Apply', 'Tell us who you are, where you are, and what you’d offer runners.'],
  ['Review', 'We reply within 5 working days.'],
  ['Agree', 'One page of terms: offer, stock, dates, cities, codes.'],
  ['Go live', 'Your reward appears in the PACE Store, optionally in a city campaign.'],
  ['Report', 'A monthly report on how it performed.'],
];

export default function PartnersPage() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section style={{ padding: '140px 24px 72px', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 40, right: '-10%', width: 520, height: 520, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(200,57,26,0.14) 0%, transparent 70%)', pointerEvents: 'none',
          }} />
          <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto', position: 'relative' }}>
            <p style={eyebrow}>PACE Store partners</p>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic',
              fontSize: 'clamp(40px, 6vw, 72px)', color: 'var(--t1)', letterSpacing: '-0.03em', lineHeight: 1.02,
              maxWidth: 760, marginBottom: 24,
            }}>
              Be the reward runners work for.
            </h1>
            <p style={{ ...body, fontSize: 17, maxWidth: 560, marginBottom: 32 }}>
              Runivo runners earn PACE by running and claiming their streets. They spend it in the PACE Store on offers
              from brands like yours. Runners can’t buy PACE, so every redemption is earned.
            </p>
            <a href="#apply" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 28px', borderRadius: 999,
              background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-body)',
            }}>
              Apply to partner
            </a>
          </div>
        </section>

        {/* Why */}
        <section style={{ padding: '24px 24px 72px' }}>
          <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto', display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {WHY.map(w => (
              <div key={w.title} style={card}>
                <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, color: 'var(--t1)', marginBottom: 10 }}>{w.title}</h3>
                <p style={{ ...body, fontSize: 14 }}>{w.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Reward levels */}
        <section style={{ padding: '24px 24px 72px' }}>
          <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
            <p style={eyebrow}>How rewards are priced</p>
            <h2 style={h2}>PACE means weeks of running.</h2>
            <p style={{ ...body, maxWidth: 620, marginBottom: 28 }}>
              A runner earns at most 100 PACE a week (150 with Runivo Plus), so the price of your reward is how long
              someone runs to get it.
            </p>
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Level', 'PACE', 'Roughly', 'Example'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '16px 20px', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--t3)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LEVELS.map((l, i) => (
                    <tr key={l.level} style={{ borderBottom: i < LEVELS.length - 1 ? '1px solid var(--border)' : undefined }}>
                      <td style={{ padding: '18px 20px', fontSize: 15, color: 'var(--t1)', fontWeight: 600 }}>{l.level}</td>
                      <td style={{ padding: '18px 20px', fontSize: 15, color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>{l.pace}</td>
                      <td style={{ padding: '18px 20px', fontSize: 14, color: 'var(--t2)' }}>{l.time}</td>
                      <td style={{ padding: '18px 20px', fontSize: 14, color: 'var(--t2)' }}>{l.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Pricing + criteria */}
        <section style={{ padding: '24px 24px 72px' }}>
          <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto', display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            <div style={card}>
              <p style={eyebrow}>What it costs</p>
              <h3 style={{ ...h2, fontSize: 28 }}>Free for our first 10 partners.</h3>
              <p style={{ ...body, fontSize: 14 }}>
                The first 10 partners list free in exchange for a strong offer. After that, you pay a small fixed fee
                only when a runner redeems your code. No listing fee, no fee for views.
              </p>
            </div>
            <div style={card}>
              <p style={eyebrow}>What we look for</p>
              <ul style={{ ...body, fontSize: 14, paddingLeft: 18, display: 'grid', gap: 8 }}>
                <li>A fit for runners: shoes, apparel, nutrition, cafés near parks, physio, races, gyms, health cover.</li>
                <li>An offer worth running for: at least 15% off, or a free item.</li>
                <li>You can honour single-use codes, online or in store.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section style={{ padding: '24px 24px 72px' }}>
          <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
            <p style={eyebrow}>How it works</p>
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {STEPS.map(([t, b], i) => (
                <div key={t} style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 28, color: 'var(--accent)', marginBottom: 8 }}>
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, color: 'var(--t1)', marginBottom: 6 }}>{t}</h3>
                  <p style={{ ...body, fontSize: 14 }}>{b}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Apply */}
        <section id="apply" style={{ padding: '24px 24px 96px', scrollMarginTop: 80 }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <p style={eyebrow}>Apply</p>
            <h2 style={h2}>Tell us about your offer.</h2>
            <p style={{ ...body, marginBottom: 28 }}>
              Takes two minutes. We reply within 5 working days.
            </p>
            <ApplyForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
