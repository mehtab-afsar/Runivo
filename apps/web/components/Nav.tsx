import Link from 'next/link';
import { Logo } from './Logo';
import { MobileMenu } from './MobileMenu';
import { APP_STORE_URL } from '@/lib/site';

export function Nav() {
  return (
    <header className="nav">
      <nav className="container nav-in" aria-label="Main">
        <Logo />
        <div className="nav-links">
          <Link href="/#how" className="nav-link">How it works</Link>
          <Link href="/partners" className="nav-link">Partners</Link>
          <Link href="/support" className="nav-link">Support</Link>
          <a href={APP_STORE_URL} className="btn btn-dark btn-sm" style={{ marginLeft: 8 }}>Download</a>
          <MobileMenu />
        </div>
      </nav>
    </header>
  );
}
