import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { APP_STORE_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Follow on Runivo',
  description: 'Runivo is the running game where your runs claim territory.',
  robots: { index: false },
};

/**
 * Where a profile QR code or "Send link" lands (apps/mobile profileCard.ts
 * builds https://runivo.in/r/<user id>?u=<username>). Offers to open the
 * runner in the app (runivo://runner/<id>), or to get the app first.
 */
export default async function RunnerLinkPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ u?: string | string[] }>;
}) {
  const { id: rawId } = await params;
  const { u } = await searchParams;
  const id = /^[0-9a-f-]{36}$/i.test(rawId) ? rawId.toLowerCase() : null;
  const rawName = Array.isArray(u) ? u[0] : u;
  // Usernames are letters, digits and underscores; anything else is dropped, never rendered.
  const name = rawName && /^[A-Za-z0-9_]{1,30}$/.test(rawName) ? rawName : null;

  return (
    <>
      <Nav />
      <main id="main" style={{ padding: '140px 24px 100px' }}>
        <article style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(34px, 5vw, 52px)', color: 'var(--t1)',
            marginBottom: 16, letterSpacing: '-0.02em',
          }}>
            {name ? `Follow @${name} on Runivo` : 'Follow this runner on Runivo'}
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
            Runivo is a running game: every run you record can claim a zone on the map, and other runners can take it back.
          </p>
          {id && (
            <a href={`runivo://runner/${id}`} className="btn btn-dark" style={{ marginTop: 28 }}>
              Open in Runivo
            </a>
          )}
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--t2)', lineHeight: 1.7, marginTop: 20 }}>
            No app yet? <a href={APP_STORE_URL} style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Get Runivo on the App Store</a>, then scan the code again.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
