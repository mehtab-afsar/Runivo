import Link from 'next/link';
import { Logo } from './Logo';
import { APP_STORE_URL, SUPPORT_EMAIL } from '@/lib/site';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div style={{ maxWidth: 300 }}>
            <Logo size={24} />
            <p className="muted" style={{ fontSize: 15, marginTop: 14 }}>
              Run smarter. AI coaching, live crews and your city.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
            <div>
              <h4>Product</h4>
              <a className="fl" href={APP_STORE_URL}>Download</a>
              <Link className="fl" href="/#how">How it works</Link>
            </div>
            <div>
              <h4>Legal</h4>
              <Link className="fl" href="/privacy">Privacy</Link>
              <Link className="fl" href="/terms">Terms</Link>
            </div>
            <div>
              <h4>Company</h4>
              <Link className="fl" href="/partners">Partners</Link>
              <Link className="fl" href="/support">Support</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Runivo. All rights reserved.</span>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </div>
      </div>
    </footer>
  );
}
