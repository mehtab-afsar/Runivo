import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { FAQAccordion } from './FAQAccordion';

export const metadata: Metadata = {
  title: 'Support — Runivo',
  description: 'Get help with Runivo. FAQs, troubleshooting, and contact information.',
};

export default function SupportPage() {
  return (
    <>
      <Nav />
      <main id="main" style={{ padding: '120px var(--gutter) 80px' }}>
        <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
          <p style={{
            fontSize: 14, color: 'var(--accent)', fontFamily: 'var(--font-body)', fontWeight: 500, marginBottom: 14,
          }}>
            Help Center
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 56px)', color: 'var(--t1)',
            marginBottom: 60, letterSpacing: '-0.02em',
          }}>
            How can we help?
          </h1>

          <div className="support-grid">
            <FAQAccordion />

            {/* Contact card */}
            <div className="card support-card">
              <h2 style={{
                fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--t1)', marginBottom: 12,
              }}>
                Still stuck?
              </h2>
              <p style={{
                fontSize: 14, color: 'var(--t3)', fontFamily: 'var(--font-body)',
                lineHeight: 1.65, marginBottom: 24,
              }}>
                Our team typically responds within 24 hours on weekdays.
              </p>
              <a
                href="mailto:support@runivo.com"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 18px', borderRadius: 12,
                  background: 'var(--accent)', color: '#fff',
                  fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)',
                  marginBottom: 12,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                support@runivo.com
              </a>
              <div style={{
                paddingTop: 20, marginTop: 8,
                borderTop: '1px solid var(--border)',
              }}>
                <p style={{
                  fontSize: 14, color: 'var(--t3)',
                  fontFamily: 'var(--font-body)', fontWeight: 500, marginBottom: 12,
                }}>
                  Quick links
                </p>
                {[
                  ['Privacy Policy', '/privacy'],
                  ['Terms of Service', '/terms'],
                ].map(([label, href]) => (
                  <a key={href} href={href} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0', borderBottom: '1px solid var(--border2)',
                    fontSize: 13, color: 'var(--t2)', fontFamily: 'var(--font-body)',
                  }}>
                    {label}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
