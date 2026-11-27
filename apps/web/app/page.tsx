import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Coins, Hexagon, Sparkles, Users } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { HexagonMark } from '@/components/Logo';
import { APP_STORE_URL } from '@/lib/site';

const FEATURES = [
  {
    tile: 'tile-mint', icon: Hexagon, title: 'Claim the streets you run',
    body: 'Run a street to claim a strip along it, or close a loop to own everything inside. Rivals can take it back, so keep running to keep it.',
  },
  {
    tile: 'tile-amber', icon: Coins, title: 'Earn PACE by running',
    body: 'Kilometres and daily missions earn PACE. It is free to earn and cannot be bought. In selected cities you can spend it on partner rewards.',
  },
  {
    tile: 'tile-lavender', icon: Sparkles, title: 'A coach that reads your runs',
    body: 'PaceX turns your runs into a plan around your goal. It only sees your data after you say yes, and you can switch it off at any time.',
  },
  {
    tile: 'tile-ink', icon: Users, title: 'Run with your crew',
    body: 'Join or start a club, chat with clubmates, take part in events and climb the weekly leaderboards in your city.',
  },
] as const;

const STEPS = [
  ['Download the app', 'Free on iPhone. Sign up with Apple, Google or your email.'],
  ['Lace up and run', 'GPS tracks your route, pace and splits, with the screen locked.'],
  ['Claim your zones', 'Streets and loops you run become your territory on the map.'],
  ['Earn and spend PACE', 'Turn kilometres into rewards from partner brands near you.'],
] as const;

const BUILT_FOR_THE_RUN = [
  'Tracking keeps going with the screen locked, with a Live Activity on your Lock Screen.',
  'Reads and saves workouts with Apple Health, only if you choose to connect it.',
  'You decide what the map shows: hide your home and the start of every run.',
  'No ads and no ad trackers.',
] as const;

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        {/* Hero */}
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <p className="eyebrow rise">The running game for your city</p>
              <h1 className="h-display rise rise-2">
                Run <span className="accent">smarter.</span>
              </h1>
              <p className="lead rise rise-3" style={{ marginTop: 22, maxWidth: 520 }}>
                AI coaching. Live crews. Your city. Every run you record can claim real ground on the map,
                and earns PACE you can spend on partner rewards.
              </p>
              <div className="actions rise rise-3">
                <a href={APP_STORE_URL} className="btn btn-dark">Download for iPhone</a>
                <Link href="/#how" className="btn btn-surface">See how it works</Link>
              </div>
              <p className="muted" style={{ fontSize: 14, marginTop: 16 }}>Free to download. iPhone only for now.</p>
            </div>

            <div className="hero-art rise rise-2">
              <Image
                src="/images/welcome-runner.jpg"
                alt="A runner mid-stride inside the Runivo hexagon"
                width={680}
                height={820}
                priority
                sizes="(max-width: 920px) 460px, 520px"
              />
              <span className="chip"><i />Every run claims real ground</span>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="section" id="features">
          <div className="container">
            <p className="eyebrow">Everything in one run</p>
            <h2 className="h-section" style={{ maxWidth: 640, marginBottom: 40 }}>
              A fitness app that plays back.
            </h2>
            <div className="grid-2">
              {FEATURES.map(({ tile, icon: Icon, title, body }) => (
                <article key={title} className="card feature">
                  <div className={`tile ${tile}`}><Icon size={24} strokeWidth={2} aria-hidden /></div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="section" id="how" style={{ paddingTop: 24 }}>
          <div className="container">
            <p className="eyebrow">How it works</p>
            <h2 className="h-section" style={{ maxWidth: 560, marginBottom: 44 }}>
              From first run to your own patch of the map.
            </h2>
            <div className="grid-4">
              {STEPS.map(([title, body], i) => (
                <div key={title} className="step">
                  <div className="step-no">{String(i + 1).padStart(2, '0')}</div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Built for the run */}
        <section className="section-sm">
          <div className="container">
            <div className="band">
              <HexagonMark size={380} color="#fff" />
              <div style={{ position: 'relative', maxWidth: 620 }}>
                <p className="eyebrow">Built for the run</p>
                <h2 className="h-section" style={{ marginBottom: 24 }}>Made to be run with, and trusted.</h2>
                <ul className="checks">
                  {BUILT_FOR_THE_RUN.map(t => <li key={t}>{t}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Final call */}
        <section className="section" style={{ textAlign: 'center' }}>
          <div className="container">
            <h2 className="h-display" style={{ fontSize: 'clamp(38px, 6vw, 72px)' }}>
              Ready to <span className="accent">run?</span>
            </h2>
            <p className="lead" style={{ margin: '18px auto 0', maxWidth: 460 }}>
              Claim the streets you run. Download Runivo and take your first step.
            </p>
            <div className="actions" style={{ justifyContent: 'center' }}>
              <a href={APP_STORE_URL} className="btn btn-dark">
                Download for iPhone <ArrowRight size={18} aria-hidden />
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
