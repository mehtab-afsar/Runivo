import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Join a club on Runivo',
  description: 'Runivo is the running game where your runs claim territory.',
  robots: { index: false },
};

/**
 * Where a club invite lands (apps/mobile clubService clubInviteLinks builds
 * https://runivo.app/club/<club id>?invite=<code>). Offers to open the club in
 * the app (runivo://club/<id>?invite=<code>, which joins), or to get the app first.
 */
export default async function ClubLinkPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { id: rawId } = await params;
  const { invite } = await searchParams;
  const id = /^[0-9a-f-]{36}$/i.test(rawId) ? rawId.toLowerCase() : null;
  const rawCode = Array.isArray(invite) ? invite[0] : invite;
  // Invite codes are short letters and digits; anything else is dropped, never passed on.
  const code = rawCode && /^[A-Za-z0-9_-]{4,64}$/.test(rawCode) ? rawCode : null;

  return (
    <>
      <Nav />
      <div style={{ padding: '140px 24px 100px' }}>
        <article style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(34px, 5vw, 52px)', color: 'var(--t1)',
            marginBottom: 16, letterSpacing: '-0.02em',
          }}>
            You&apos;re invited to a running club
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
            Runivo is a running game: every run you record can claim a zone on the map, and other runners can take it back.
          </p>
          {id && (
            <a href={`runivo://club/${id}${code ? `?invite=${encodeURIComponent(code)}` : ''}`} style={{
              display: 'inline-block', marginTop: 28, padding: '16px 28px', borderRadius: 999,
              background: '#17181A', color: '#FFFFFF', fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, textDecoration: 'none',
            }}>
              Open the club in Runivo
            </a>
          )}
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--t2)', lineHeight: 1.7, marginTop: 20 }}>
            No app yet? Open the App Store on your iPhone, search for <strong>Runivo</strong>, then open this link again.
          </p>
        </article>
      </div>
      <Footer />
    </>
  );
}
