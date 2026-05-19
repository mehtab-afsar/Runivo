'use client';

import { useState } from 'react';

const faqs = [
  {
    q: 'Why is GPS inaccurate during my run?',
    a: 'GPS accuracy depends on your device, surroundings, and weather. For best results, start your run in an open area and wait for the GPS lock indicator before moving. Tall buildings and underground routes can reduce accuracy.',
  },
  {
    q: 'How does territory claiming work?',
    a: 'Run through a zone to claim it. Your GPS route must pass through the zone boundary. Zones decay in freshness over time — run through them again to reinforce. Other runners can claim your zones by running through them while you\'re away.',
  },
  {
    q: 'What is PACE and how do I earn it?',
    a: 'PACE is Runivo\'s in-app token. You earn PACE by running (per kilometre), completing daily missions, and claiming new territory. There\'s a weekly earning cap to keep things fair. Spend PACE on partner discounts and rewards in the PACE Store.',
  },
  {
    q: 'Can I lose my territory?',
    a: 'Yes. Zones lose freshness over time if you don\'t revisit them, and other runners can claim them. This is intentional — the game rewards consistent running. A staleness warning appears on your dashboard when zones need reinforcing.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Settings → Account → Delete Account. This permanently deletes your profile, run history, territory claims, and PACE balance. This action cannot be undone. Your data is removed from our servers within 30 days.',
  },
  {
    q: 'Is Runivo available on Android?',
    a: 'Currently Runivo is iOS only. Android is on our roadmap. Join the waitlist by emailing support@runivo.com with the subject "Android Waitlist".',
  },
  {
    q: 'How does the AI Coach work?',
    a: 'The AI Coach analyses your run history, pace trends, and weekly mileage to generate personalised training recommendations. It adjusts based on your goals (speed, endurance, territory domination) and flags signs of overtraining.',
  },
  {
    q: 'How do I report a bug or problem?',
    a: 'Email support@runivo.com with a description of the issue, your device model, and iOS version. Screenshots or screen recordings are always helpful. We aim to respond within 24 hours on weekdays.',
  },
];

export function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div>
      <h2 style={{
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontSize: 28, color: 'var(--t1)', marginBottom: 32,
      }}>
        Frequently asked questions
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {faqs.map((faq, i) => (
          <div
            key={i}
            style={{
              borderRadius: 12,
              border: '1px solid',
              borderColor: open === i ? 'rgba(200,57,26,0.25)' : 'var(--border)',
              background: open === i ? 'rgba(200,57,26,0.05)' : 'var(--surface)',
              overflow: 'hidden',
              transition: 'border-color 0.2s, background 0.2s',
            }}
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{
                width: '100%', textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                padding: '18px 20px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--t1)',
              }}
            >
              <span style={{
                fontSize: 15, fontWeight: 500,
                fontFamily: 'var(--font-body)', lineHeight: 1.4,
                color: open === i ? 'var(--t1)' : 'var(--t2)',
              }}>
                {faq.q}
              </span>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={open === i ? '#C8391A' : 'rgba(255,255,255,0.35)'} strokeWidth="2"
                style={{
                  flexShrink: 0,
                  transform: open === i ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {open === i && (
              <div style={{ padding: '0 20px 20px' }}>
                <p style={{
                  fontSize: 14, color: 'var(--t3)',
                  fontFamily: 'var(--font-body)', lineHeight: 1.7,
                }}>
                  {faq.a}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
