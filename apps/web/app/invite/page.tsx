import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Join Runivo',
  description: 'You have been invited to Runivo, the running game where your runs claim territory.',
};

/**
 * Where the app's "Invite a friend" link lands (apps/mobile PeopleStep builds
 * https://runivo.app/invite?from=<username>). The app link did not exist on
 * the site, so every shared invite was a 404.
 */
export default async function InvitePage({ searchParams }: { searchParams: Promise<{ from?: string | string[]; code?: string | string[] }> }) {
  const { from, code: rawCode } = await searchParams;
  // Invite codes (app Search → "Invite friends"): 8 letters/digits, shown only if well-formed.
  const c = (Array.isArray(rawCode) ? rawCode[0] : rawCode)?.trim().toUpperCase();
  const code = c && /^[A-Z0-9]{6,12}$/.test(c) ? c : null;
  const raw = Array.isArray(from) ? from[0] : from;
  // A username is letters, digits and underscores; anything else is dropped, never rendered.
  const inviter = raw && /^[A-Za-z0-9_]{1,30}$/.test(raw) ? raw : null;

  return (
    <>
      <Nav />
      <div style={{ padding: '140px 24px 100px' }}>
        <article style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 'clamp(34px, 5vw, 52px)', color: 'var(--t1)', marginBottom: 16, letterSpacing: '-0.02em',
          }}>
            {inviter ? `${inviter} invited you to Runivo` : 'You are invited to Runivo'}
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
            Runivo is a running game: every run you record can claim a zone on the map, and other runners can take it back.
            Open the App Store on your iPhone, search for <strong>Runivo</strong>, and follow {inviter ?? 'your friend'} once you are in.
          </p>
          {code && (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--t1)', lineHeight: 1.7, marginTop: 20 }}>
              In the app, open Search, tap <strong>Got a code from a friend?</strong> and enter{' '}
              <strong style={{ letterSpacing: '0.12em' }}>{code}</strong>. You both get 50 PACE after your first 1 km run.
            </p>
          )}
        </article>
      </div>
      <Footer />
    </>
  );
}
