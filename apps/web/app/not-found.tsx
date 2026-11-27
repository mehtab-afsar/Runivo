import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { APP_STORE_URL } from '@/lib/site';

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="status-page">
        <div>
          <p className="status-code">404</p>
          <h1 className="h-section" style={{ marginTop: 12 }}>This route isn’t on the map.</h1>
          <p className="lead" style={{ margin: '14px auto 0', maxWidth: 420 }}>
            The page you’re after has moved or never existed.
          </p>
          <div className="actions" style={{ justifyContent: 'center' }}>
            <Link href="/" className="btn btn-dark">Back to home</Link>
            <a href={APP_STORE_URL} className="btn btn-surface">Get the app</a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
