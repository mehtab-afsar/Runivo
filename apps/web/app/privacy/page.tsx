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
            Last updated: November 2026
          </p>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 48 }}>

            <h2 style={h2Style}>Introduction</h2>
            <p style={prose}>
              Runivo (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is a running app where runs claim territory on a map. This policy explains what we collect, why, who receives it, and how you control it. We do not sell your personal data, we do not show ads, and we do not track you across other companies&apos; apps or websites.
            </p>

            <h2 style={h2Style}>1. What We Collect</h2>

            <h3 style={h3Style}>Account information</h3>
            <p style={prose}>
              Your email address and/or phone number, a username, and your name if you sign in with Apple or Google. If you use a password it is stored only as a secure hash. Optional profile details such as a bio, display name, location text and profile photo are stored if you add them.
            </p>

            <h3 style={h3Style}>Precise location (runs)</h3>
            <p style={prose}>
              While you record a run, Runivo collects your GPS location, including in the background after you lock your screen, so your route, distance and territory are accurate. It only does this during a run that you start. We store your route with the run so you can review it and so territory can be calculated on our servers.
            </p>

            <h3 style={h3Style}>Approximate location</h3>
            <p style={prose}>
              We keep an approximate home area (about 1 km) to show runners, clubs and leaderboards near you, and to decide which partner rewards are available in your city. You can set private places and hide your zones from other people&apos;s maps in Settings.
            </p>

            <h3 style={h3Style}>Health and fitness</h3>
            <p style={prose}>
              Distance, time, pace, heart rate, cadence, elevation and similar workout metrics from your runs. If you allow it, Runivo reads your past running workouts from Apple Health to set a starting baseline, and saves completed runs to Apple Health as workouts. If you connect Garmin, COROS or Polar, we receive the workouts they share. You may also give your age range, sex, height, weight and running goals to personalise targets. You can withdraw consent for imported health data at any time in Settings, which deletes what we imported.
            </p>

            <h3 style={h3Style}>Content you create</h3>
            <p style={prose}>
              Photos (profile, run and shoe photos), posts, comments, club and event text, and club chat messages. This content can be seen by other people according to the settings you choose.
            </p>

            <h3 style={h3Style}>Device and usage information</h3>
            <p style={prose}>
              A push notification token for your device, your account ID, and what you do in the app (for example finishing a run or opening a screen), which we use for product analytics. Analytics events are tied to your account ID, not to your name. Crash and performance reports are collected separately and are not linked to your account; coordinates and tokens are removed from them before they are stored.
            </p>

            <h3 style={h3Style}>Purchases</h3>
            <p style={prose}>
              Runivo is free and has no in-app purchases at this time. If paid features are offered later, Apple will process the payment and we will receive only your subscription status, never your card or Apple ID details; this policy will be updated before that happens.
            </p>

            <h2 style={h2Style}>2. How We Use It</h2>
            <p style={prose}>
              To record runs and claim territory; to calculate PACE, missions, ranks and leaderboards; to show you nearby runners, clubs, events and partner rewards; to send notifications you have enabled; to provide the PaceX AI coach if you turn it on; to keep the service safe (reports, blocking and moderation); to understand which features are used so we can improve them; and to provide customer support.
            </p>

            <h2 style={h2Style}>3. Who Receives Your Data</h2>
            <p style={prose}>
              We share data only with the services that help us run Runivo, and only what each needs:
            </p>
            <ul style={{ ...prose, paddingLeft: 22, marginTop: 8 }}>
              <li><strong>Supabase</strong>: hosts our database, sign-in and file storage (everything above).</li>
              <li><strong>Anthropic</strong> (the PaceX AI coach and Foot scan): only if you agree. See section 4.</li>
              <li><strong>PostHog</strong>: product analytics events tied to your account ID. You can turn this off in Settings.</li>
              <li><strong>Sentry</strong>: crash and performance reports, not linked to your account.</li>
              <li><strong>Expo and Apple</strong>: delivering push notifications (your push token).</li>
              <li><strong>Resend</strong>: sending emails such as your optional weekly digest (your email address).</li>
              <li><strong>Twilio</strong>: sending sign-in codes by SMS, if you sign in with a phone number (your phone number).</li>
              <li><strong>Apple and Google</strong>: if you sign in with them. <strong>Garmin, COROS and Polar</strong>: only if you connect them, once those connections are available.</li>
              <li><strong>Map, routing and weather services</strong>: to show maps and plan routes, the map area you view and, for routing and weather, approximate coordinates are sent to CARTO, OpenStreetMap-based routing (routing.openstreetmap.de and OpenRouteService), Open-Meteo. These providers also see your IP address.</li>
              <li><strong>Other Runivo users</strong>: what you choose to share (profile, posts, comments, zones on the map, run stats). Live location sharing is off unless you turn it on, and the safety link is shared only with the people you send it to.</li>
            </ul>
            <p style={{ ...prose, marginTop: 12 }}>
              Every service listed above processes your data only on our instructions and is bound to protect it at least as strictly as this policy. We may also disclose data if required by law or to protect people&apos;s safety.
            </p>

            <h2 style={h2Style}>4. The PaceX AI Coach</h2>
            <p style={prose}>
              PaceX and Foot scan are optional. They are off until you read a screen that names Anthropic and agree. After you agree, PaceX sends Anthropic, the company that provides the AI model: your recent runs (distance, time, pace, heart rate and similar), your goal, experience, age range and weight if you added them, imported health data if you turned that on, and anything you type to PaceX. If you use Foot scan, the photo of your foot that you take is sent to work out your arch type. Neither sends your GPS routes, your name or your email. Anthropic uses the data only to produce your reply or read your photo. You can turn PaceX off at any time in Settings under Privacy and data; after that nothing further is sent.
            </p>

            <h2 style={h2Style}>5. Retention and Deletion</h2>
            <p style={prose}>
              We keep your data while your account is active. When you delete your account in the app, your profile, runs, zones, posts, files and other account data are deleted immediately, and if you signed in with Apple we also revoke Runivo&apos;s Sign in with Apple access. Copies in our encrypted backups are removed as those backups expire. We also ask PostHog to delete the analytics events recorded under your account ID; if that request fails, email us and we will do it by hand. Messages and content other people have already received from you may remain on their devices.
            </p>

            <h2 style={h2Style}>6. Your Choices and Rights</h2>
            <p style={prose}>
              In Settings you can: turn the PaceX AI coach off; turn product analytics off; withdraw consent for imported health data; turn promotional notifications on or off (they are off by default); control who sees your profile and zones; set private places; and report or block anyone. You may also ask to access, correct, export or delete the personal data we hold about you.
            </p>
            <p style={{ ...prose, marginTop: 12 }}>
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:support@runivo.com" style={{ color: 'var(--accent)' }}>support@runivo.com</a>.
              You can delete your account directly in the app: Profile → Settings (gear icon) → Delete account, at the bottom of the screen.
            </p>

            <h2 style={h2Style}>7. Security</h2>
            <p style={prose}>
              We use TLS encryption in transit, encryption at rest for our database, and row-level security so accounts can only read data they are allowed to see. No system is perfectly secure, so we also limit what each service receives.
            </p>

            <h2 style={h2Style}>8. Children&apos;s Privacy</h2>
            <p style={prose}>
              Runivo is not intended for children under 13 and we do not knowingly collect data from them. If you believe a child has given us personal data, contact us and we will delete it promptly.
            </p>

            <h2 style={h2Style}>9. Changes to This Policy</h2>
            <p style={prose}>
              We may update this policy. If a change affects how we use your data in a meaningful way, we will tell you in the app before it takes effect, and we will update the date above.
            </p>

            <h2 style={h2Style}>10. Contact</h2>
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
