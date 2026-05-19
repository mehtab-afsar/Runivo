import Link from 'next/link';
import { HexagonLogo } from './HexagonLogo';

export function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      padding: '56px 24px 40px',
    }}>
      <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap',
          alignItems: 'flex-start', justifyContent: 'space-between', gap: 40,
          marginBottom: 48,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <HexagonLogo size={24} />
              <span style={{
                fontFamily: 'var(--font-display)', fontStyle: 'italic',
                fontSize: 16, color: 'var(--t2)',
              }}>
                runivo
              </span>
            </div>
            <p style={{
              fontSize: 13, color: 'var(--t3)', fontFamily: 'var(--font-body)',
              lineHeight: 1.6, maxWidth: 280,
            }}>
              Claim territory. Earn PACE. Own your city.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--t3)', fontFamily: 'var(--font-body)', fontWeight: 600, marginBottom: 16, textTransform: 'uppercase' }}>
                Product
              </p>
              {[['Download', 'https://apps.apple.com']].map(([label, href]) => (
                <a key={href} href={href} style={{ display: 'block', fontSize: 13, color: 'var(--t2)', fontFamily: 'var(--font-body)', marginBottom: 10 }}>{label}</a>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--t3)', fontFamily: 'var(--font-body)', fontWeight: 600, marginBottom: 16, textTransform: 'uppercase' }}>
                Legal
              </p>
              {([['Privacy', '/privacy'], ['Terms', '/terms']] as [string, string][]).map(([label, href]) => (
                <Link key={href} href={href} style={{ display: 'block', fontSize: 13, color: 'var(--t2)', fontFamily: 'var(--font-body)', marginBottom: 10 }}>{label}</Link>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--t3)', fontFamily: 'var(--font-body)', fontWeight: 600, marginBottom: 16, textTransform: 'uppercase' }}>
                Company
              </p>
              {([['Support', '/support']] as [string, string][]).map(([label, href]) => (
                <Link key={href} href={href} style={{ display: 'block', fontSize: 13, color: 'var(--t2)', fontFamily: 'var(--font-body)', marginBottom: 10 }}>{label}</Link>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 24,
          display: 'flex', flexWrap: 'wrap',
          alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <p style={{ fontSize: 12, color: 'var(--t3)', fontFamily: 'var(--font-body)' }}>
            © {new Date().getFullYear()} Runivo. All rights reserved.
          </p>
          <p style={{ fontSize: 12, color: 'var(--t3)', fontFamily: 'var(--font-body)' }}>
            support@runivo.com
          </p>
        </div>
      </div>
    </footer>
  );
}
