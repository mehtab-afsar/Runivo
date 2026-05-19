import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Terms of Service — Runivo',
  description: 'Terms and conditions for using Runivo.',
};

const prose: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--t2)', lineHeight: 1.75,
};
const h2Style: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24,
  color: 'var(--t1)', marginTop: 48, marginBottom: 16,
};
const h3Style: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--t3)', fontFamily: 'var(--font-body)', marginTop: 28, marginBottom: 8,
};

export default function TermsPage() {
  return (
    <>
      <Nav />
      <div style={{ padding: '120px 24px 80px' }}>
        <article style={{ maxWidth: 680, margin: '0 auto' }}>
          <p style={{
            fontSize: 11, letterSpacing: '0.16em', color: 'var(--accent)',
            fontFamily: 'var(--font-body)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 16,
          }}>
            Legal
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 'clamp(36px, 5vw, 56px)', color: 'var(--t1)',
            marginBottom: 12, letterSpacing: '-0.02em',
          }}>
            Terms of Service
          </h1>
          <p style={{ ...prose, color: 'var(--t3)', marginBottom: 48 }}>
            Last updated: May 2026
          </p>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 48 }}>

            <h2 style={h2Style}>Agreement to Terms</h2>
            <p style={prose}>
              By downloading or using Runivo, you agree to be bound by these Terms of Service. If you do not agree, do not use the app.
            </p>

            <h2 style={h2Style}>1. Eligibility</h2>
            <p style={prose}>
              You must be at least 13 years old to use Runivo. By using the service you represent that you meet this requirement. If you are under 18, you must have parental consent.
            </p>

            <h2 style={h2Style}>2. Account</h2>

            <h3 style={h3Style}>Registration</h3>
            <p style={prose}>
              You must create an account to use Runivo. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account.
            </p>

            <h3 style={h3Style}>Usernames</h3>
            <p style={prose}>
              Usernames must not impersonate others, contain offensive language, or infringe trademarks. We reserve the right to reclaim usernames that violate these rules.
            </p>

            <h2 style={h2Style}>3. Acceptable Use</h2>
            <p style={prose}>
              You agree not to: use Runivo to harass, threaten, or harm other users; manipulate GPS data or exploit bugs to gain unfair territory advantages; use automated scripts or bots; resell or commercially exploit Runivo content; or attempt to access other users&apos; accounts.
            </p>

            <h2 style={h2Style}>4. PACE Tokens</h2>
            <p style={prose}>
              PACE tokens are a virtual in-app currency with no monetary value. They cannot be exchanged for real money, transferred between accounts, or redeemed outside of Runivo&apos;s partner reward programme. We reserve the right to modify PACE earn rates and redemption rules at any time with reasonable notice.
            </p>

            <h2 style={h2Style}>5. Territory</h2>
            <p style={prose}>
              Territory claims are a game mechanic. They confer no real-world rights over any location. Territory can be lost through natural decay or by other runners claiming zones. We make no guarantees about the persistence of any territory claim.
            </p>

            <h2 style={h2Style}>6. Content</h2>
            <p style={prose}>
              You retain ownership of content you create (photos, descriptions). By submitting content you grant Runivo a non-exclusive, royalty-free licence to use, display, and distribute it within the app. You must not submit content that is illegal, hateful, or infringes third-party rights.
            </p>

            <h2 style={h2Style}>7. Disclaimers</h2>
            <p style={prose}>
              Runivo is provided &ldquo;as is&rdquo; without warranties of any kind. GPS accuracy varies by device and environment. Runivo is a game — always follow traffic laws and exercise safely. We are not responsible for any injury, accident, or loss arising from your use of the app.
            </p>

            <h2 style={h2Style}>8. Limitation of Liability</h2>
            <p style={prose}>
              To the maximum extent permitted by law, Runivo&apos;s total liability for any claim arising from these Terms shall not exceed the amount you paid to Runivo in the 12 months preceding the claim, or £10, whichever is greater.
            </p>

            <h2 style={h2Style}>9. Termination</h2>
            <p style={prose}>
              We may suspend or terminate your account if you violate these Terms. You may delete your account at any time in Settings. Upon termination, your data will be deleted in accordance with our Privacy Policy.
            </p>

            <h2 style={h2Style}>10. Governing Law</h2>
            <p style={prose}>
              These Terms are governed by the laws of England and Wales. Any disputes shall be resolved in the courts of England and Wales.
            </p>

            <h2 style={h2Style}>11. Changes</h2>
            <p style={prose}>
              We may update these Terms from time to time. We will notify you of material changes 30 days in advance. Continued use after the effective date constitutes acceptance.
            </p>

            <h2 style={h2Style}>12. Contact</h2>
            <p style={prose}>
              Questions about these Terms? Email{' '}
              <a href="mailto:support@runivo.com" style={{ color: 'var(--accent)' }}>support@runivo.com</a>.
            </p>
          </div>
        </article>
      </div>
      <Footer />
    </>
  );
}
