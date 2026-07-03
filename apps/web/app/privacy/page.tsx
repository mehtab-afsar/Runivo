import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy — Runivo',
  description: 'How Runivo collects, uses, and protects your personal data.',
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

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <div style={{ paddingTop: 120, paddingBottom: 80, padding: '120px 24px 80px' }}>
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
            Privacy Policy
          </h1>
          <p style={{ ...prose, color: 'var(--t3)', marginBottom: 48 }}>
            Last updated: May 2026
          </p>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 48 }}>

            <h2 style={h2Style}>Introduction</h2>
            <p style={prose}>
              Runivo (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is committed to protecting your privacy. This policy explains what data we collect, why we collect it, and how you can control it.
            </p>

            <h2 style={h2Style}>1. Data We Collect</h2>

            <h3 style={h3Style}>Location Data</h3>
            <p style={prose}>
              To enable run tracking and territory claiming, Runivo collects your GPS location during active runs. With your permission, we may track location in the background to capture territory zones. Location data is processed on your device and stored securely in our database associated with your account.
            </p>

            <h3 style={h3Style}>Health &amp; Activity Metrics</h3>
            <p style={prose}>
              We collect run data including distance, pace, duration, and route coordinates. If you connect Apple Health, we may read or write step counts and workout data. This data is used solely to power your Runivo experience and is never sold.
            </p>

            <h3 style={h3Style}>Account Information</h3>
            <p style={prose}>
              When you create an account we collect your email address, username, and password (stored as a secure hash). Optional profile details such as city, profile photo, and bio are stored if you provide them. During onboarding we also collect your age, gender, height, weight, running experience level, weekly running frequency, primary goal, and preferred distance, to personalise your missions and weekly targets.
            </p>

            <h3 style={h3Style}>Usage Data</h3>
            <p style={prose}>
              We collect standard analytics data (screen views, feature usage, crash reports) to improve the app. This data is aggregated and not linked to your identity. We use Sentry for crash reporting and PostHog for product analytics (e.g. tracking which features are used, such as completing onboarding or finishing a run) — neither ever receives your precise GPS coordinates.
            </p>

            <h2 style={h2Style}>2. How We Use Your Data</h2>
            <p style={prose}>
              Your data is used to: power run tracking and territory claiming; personalise your AI Coach recommendations; compute leaderboards and territory scores; send you push notifications about your zones; process PACE token transactions; and improve the app through aggregated analytics.
            </p>

            <h2 style={h2Style}>3. Data Sharing</h2>
            <p style={prose}>
              We do not sell your personal data. We share data only with: infrastructure providers (Supabase for database hosting, operating under data processing agreements); crash reporting services (Sentry); product analytics services (PostHog); and, only with your explicit action, other Runivo users who can see your public profile, username, territory claims, and run stats you choose to share.
            </p>

            <h2 style={h2Style}>4. Data Retention</h2>
            <p style={prose}>
              Your data is retained for as long as your account is active. Run history older than 3 years may be summarised into aggregate statistics to reduce storage. If you delete your account, all personal data is permanently deleted within 30 days.
            </p>

            <h2 style={h2Style}>5. Your Rights</h2>
            <p style={prose}>
              You have the right to: access the personal data we hold about you; correct inaccurate data; delete your account and all associated data; export your run data in a portable format; withdraw consent for optional data processing at any time.
            </p>
            <p style={{ ...prose, marginTop: 12 }}>
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:support@runivo.com" style={{ color: 'var(--accent)' }}>support@runivo.com</a>.
              Account deletion can also be performed directly in the app under Settings → Delete Account.
            </p>

            <h2 style={h2Style}>6. Security</h2>
            <p style={prose}>
              We use industry-standard security measures including TLS encryption in transit, AES-256 encryption at rest (via Supabase), and row-level security policies on all database tables. We conduct regular security reviews.
            </p>

            <h2 style={h2Style}>7. Children&apos;s Privacy</h2>
            <p style={prose}>
              Runivo is not intended for children under 13. We do not knowingly collect data from children. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.
            </p>

            <h2 style={h2Style}>8. Changes to This Policy</h2>
            <p style={prose}>
              We may update this policy from time to time. We will notify you of significant changes via email or in-app notification. Continued use of Runivo after changes constitutes acceptance of the updated policy.
            </p>

            <h2 style={h2Style}>9. Contact</h2>
            <p style={prose}>
              For privacy questions or requests, contact us at{' '}
              <a href="mailto:support@runivo.com" style={{ color: 'var(--accent)' }}>support@runivo.com</a>.
            </p>
          </div>
        </article>
      </div>
      <Footer />
    </>
  );
}
