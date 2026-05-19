import Link from 'next/link';
import { HexagonLogo } from './HexagonLogo';

export function Nav() {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      padding: '0 24px', height: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'rgba(10,10,10,0.88)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <HexagonLogo size={28} />
        <span style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 20,
          color: 'var(--t1)',
          letterSpacing: '-0.02em',
        }}>
          runivo
        </span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/support" style={{
          fontSize: 13, color: 'var(--t3)',
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.01em',
        }}>
          Support
        </Link>
        <a
          href="https://apps.apple.com"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 20px', borderRadius: 999,
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 13, fontWeight: 600,
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          Download
        </a>
      </div>
    </nav>
  );
}
