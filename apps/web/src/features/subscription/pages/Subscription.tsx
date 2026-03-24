import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Navigation, X } from 'lucide-react';
import { supabase } from '@shared/services/supabase';
import { haptic } from '@shared/lib/haptics';
import { HexWatermark } from '../components/HexWatermark';

// ── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  bg:      '#F8F6F3',
  white:   '#FFFFFF',
  stone:   '#F0EDE8',
  mid:     '#E8E4DF',
  border:  '#DDD9D4',
  black:   '#0A0A0A',
  t2:      '#6B6B6B',
  t3:      '#ADADAD',
  red:     '#D93518',
  redLo:   '#FEF0EE',
  green:   '#1A6B40',
  greenLo: '#EDF7F2',
  F:       "'Barlow', system-ui, sans-serif",
  FP:      "'Playfair Display', Georgia, serif",
};

// ── Feature list ───────────────────────────────────────────────────────────────
const FEATURES = [
  {
    name: 'Unlimited territory',
    sub:  'No cap on zones you can claim and own',
  },
  {
    name: 'AI Coach',
    sub:  'Personalised training plans, weekly briefs, race predictions',
  },
  {
    name: 'Real-time alerts',
    sub:  'Notified the moment a rival enters your zone',
  },
  {
    name: 'Create clubs & events',
    sub:  'Build your running crew, host races',
  },
  {
    name: 'Smart nutrition + AI',
    sub:  'Calorie tracker with run-aware coaching',
  },
  {
    name: 'Advanced analytics',
    sub:  'Pace zones, performance trends, VDOT',
  },
];

const FREE_LIMITS = [
  'Max 20 territories',
  'No AI Coach',
  'No territory alerts',
];

// ── Subscribe handler ──────────────────────────────────────────────────────────
function openStripe(billing: 'monthly' | 'annual') {
  const key = billing === 'annual'
    ? 'VITE_STRIPE_LINK_PREMIUM_ANNUAL'
    : 'VITE_STRIPE_LINK_PREMIUM_MONTHLY';
  const link = import.meta.env[key];
  if (link) {
    window.open(link, '_blank');
  } else {
    alert(`Stripe link not configured.\nSet ${key} in your .env file.`);
  }
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Subscription() {
  const navigate = useNavigate();
  const [billing, setBilling]     = useState<'monthly' | 'annual'>('monthly');
  const [currentTier, setCurrentTier] = useState<string>('free');
  const isAnnual  = billing === 'annual';
  const isPremium = currentTier === 'premium';

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single();
        if (!error && data?.subscription_tier) setCurrentTier(data.subscription_tier);
      } catch { /* offline */ }
    })();
  }, []);

  const handleSubscribe = () => {
    haptic('medium');
    openStripe(billing);
  };

  // ── Subscribed view ──────────────────────────────────────────────────────────
  if (isPremium) {
    return (
      <div style={{ minHeight: '100dvh', background: T.bg, fontFamily: T.F }}>
        <div
          style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: T.bg, borderBottom: `0.5px solid ${T.border}`,
            padding: 'max(16px, env(safe-area-inset-top)) 20px 12px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 34, height: 34, borderRadius: 8,
              background: T.white, border: `0.5px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <ArrowLeft size={15} color={T.t2} strokeWidth={2} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 500, color: T.black }}>Subscription</span>
        </div>
        <div style={{ padding: '32px 24px', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: T.greenLo, border: `0.5px solid rgba(26,107,64,0.2)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Check size={24} color={T.green} strokeWidth={2.5} />
          </div>
          <h2 style={{ fontFamily: T.FP, fontStyle: 'italic', fontSize: 22, color: T.black, marginBottom: 8, fontWeight: 500 }}>
            You're on Premium
          </h2>
          <p style={{ fontSize: 12, fontWeight: 300, color: T.t3, lineHeight: 1.6, marginBottom: 28 }}>
            All features unlocked. You're getting the full Runivo experience.
          </p>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: '100%', padding: '13px', borderRadius: 4,
              background: T.stone, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 500, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: T.t2,
            }}
          >
            Back
          </button>
          <p style={{ marginTop: 16, fontSize: 10, fontWeight: 300, color: T.t3 }}>
            To manage or cancel, visit your App Store subscription settings.
          </p>
        </div>
      </div>
    );
  }

  // ── Full paywall view ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: T.bg, fontFamily: T.F }}>

      {/* ── Back button ── */}
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'transparent',
          padding: 'max(14px, env(safe-area-inset-top)) 16px 0',
          pointerEvents: 'none',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
            border: `0.5px solid rgba(255,255,255,0.2)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', pointerEvents: 'auto',
          }}
        >
          <ArrowLeft size={15} color="rgba(255,255,255,0.7)" strokeWidth={2} />
        </button>
      </div>

      {/* ── Hero block ── */}
      <div
        style={{
          background: T.black,
          padding: '28px 24px 24px',
          position: 'relative',
          overflow: 'hidden',
          marginTop: -52,
          paddingTop: 'calc(28px + max(14px, env(safe-area-inset-top)) + 34px)',
        }}
      >
        <div style={{ position: 'absolute', top: -20, right: -20, pointerEvents: 'none' }}>
          <HexWatermark size={160} opacity={0.06} />
        </div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <p style={{
            fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.40)',
            textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10,
          }}>
            Runivo Premium
          </p>
          <h1 style={{
            fontFamily: T.FP, fontStyle: 'italic',
            fontSize: 26, fontWeight: 400, color: T.white,
            lineHeight: 1.1, letterSpacing: '-0.02em',
            marginBottom: 10, whiteSpace: 'pre-line',
          }}>
            {'Run more.\nOwn more.\nKnow more.'}
          </h1>
          <p style={{
            fontSize: 12, fontWeight: 300, color: 'rgba(255,255,255,0.50)',
            lineHeight: 1.6,
          }}>
            Unlimited territory, AI coaching, and real-time intelligence — all in one.
          </p>
        </div>
      </div>

      {/* ── Billing toggle ── */}
      <div style={{ display: 'flex', width: '100%' }}>
        {/* Monthly button */}
        <button
          onClick={() => setBilling('monthly')}
          style={{
            flex: 1, padding: '9px', textAlign: 'center',
            fontSize: 11, fontWeight: billing === 'monthly' ? 500 : 400,
            fontFamily: T.F,
            background: billing === 'monthly' ? T.black : T.bg,
            color: billing === 'monthly' ? T.white : T.t3,
            border: `0.5px solid ${billing === 'monthly' ? T.black : T.border}`,
            borderRadius: '4px 0 0 4px',
            borderRight: 'none',
            cursor: 'pointer',
            transition: 'background 150ms ease, color 150ms ease',
          }}
        >
          Monthly
        </button>
        {/* Annual button */}
        <button
          onClick={() => setBilling('annual')}
          style={{
            flex: 1, padding: '9px', textAlign: 'center',
            fontSize: 11, fontWeight: billing === 'annual' ? 500 : 400,
            fontFamily: T.F,
            background: billing === 'annual' ? T.black : T.bg,
            color: billing === 'annual' ? T.white : T.t3,
            border: `0.5px solid ${billing === 'annual' ? T.black : T.border}`,
            borderRadius: '0 4px 4px 0',
            cursor: 'pointer',
            transition: 'background 150ms ease, color 150ms ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          Annual
          <span style={{
            fontSize: 9, fontWeight: 500,
            color: billing === 'annual' ? T.white : T.green,
            transition: 'color 150ms ease',
          }}>
            Save 30%
          </span>
        </button>
      </div>

      {/* ── Price block ── */}
      <motion.div
        animate={{
          background: isAnnual ? T.greenLo : T.white,
          borderBottomColor: isAnnual ? 'rgba(26,107,64,0.20)' : T.border,
        }}
        transition={{ duration: 0.2 }}
        style={{
          padding: '20px 22px',
          borderBottom: `0.5px solid ${isAnnual ? 'rgba(26,107,64,0.20)' : T.border}`,
        }}
      >
        {isAnnual ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
              <span style={{
                fontSize: 42, fontWeight: 300, letterSpacing: '-0.04em', lineHeight: 1,
                color: T.green, transition: 'color 200ms ease',
              }}>
                $2.08
              </span>
              <span style={{ fontSize: 14, fontWeight: 300, color: T.t3 }}>/ month</span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 400, color: T.black, marginBottom: 6 }}>
              $24.99 billed once per year
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                background: T.green, color: T.white,
                fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '2px 8px', borderRadius: 2,
              }}>
                Best value
              </span>
              <span style={{ fontSize: 11, fontWeight: 300, color: T.green }}>
                Save $11 vs monthly
              </span>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
              <span style={{
                fontSize: 42, fontWeight: 300, letterSpacing: '-0.04em', lineHeight: 1,
                color: T.black, transition: 'color 200ms ease',
              }}>
                $2.99
              </span>
              <span style={{ fontSize: 14, fontWeight: 300, color: T.t3 }}>/ month</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 300, color: T.t3 }}>
                or&nbsp;
                <span style={{ textDecoration: 'line-through' }}>$35.88</span>
                &nbsp;$24.99/year
              </span>
              <span style={{
                background: T.greenLo, color: T.green,
                fontSize: 9, fontWeight: 500, textTransform: 'uppercase',
                padding: '2px 8px', borderRadius: 2,
              }}>
                Save $11
              </span>
            </div>
          </>
        )}
      </motion.div>

      {/* ── Features list ── */}
      <div style={{ background: T.white, padding: '16px 22px' }}>
        <p style={{
          fontSize: 9, fontWeight: 500, color: T.t3,
          textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10,
        }}>
          Everything included
        </p>
        {FEATURES.map((feat, i) => (
          <div
            key={feat.name}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              marginBottom: i < FEATURES.length - 1 ? 11 : 0,
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              background: T.greenLo, border: `0.5px solid rgba(26,107,64,0.20)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 1,
            }}>
              <Check size={9} color={T.green} strokeWidth={3} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: T.black, marginBottom: 1 }}>
                {feat.name}
              </p>
              <p style={{ fontSize: 10, fontWeight: 300, color: T.t3, lineHeight: 1.4 }}>
                {feat.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Free plan compare ── */}
      <div style={{
        background: T.stone,
        borderTop: `0.5px solid ${T.border}`,
        padding: '12px 22px',
      }}>
        <p style={{
          fontSize: 10, fontWeight: 500, color: T.t3,
          textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 8,
        }}>
          Free plan limits
        </p>
        {FREE_LIMITS.map((limit, i) => (
          <div
            key={limit}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: i < FREE_LIMITS.length - 1 ? 6 : 0,
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: T.mid,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <X size={8} color={T.t3} strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 300, color: T.t2 }}>{limit}</span>
          </div>
        ))}
      </div>

      {/* ── CTA area ── */}
      <div style={{ background: T.white, padding: '14px 22px 0' }}>
        <motion.button
          onClick={handleSubscribe}
          animate={{ background: isAnnual ? T.green : T.black }}
          transition={{ duration: 0.2 }}
          style={{
            width: '100%', padding: 15, borderRadius: 4, border: 'none',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 12, fontWeight: 500, fontFamily: T.F,
            textTransform: 'uppercase', letterSpacing: '0.08em', color: T.white,
          }}
        >
          <Navigation size={14} color={T.white} strokeWidth={2} />
          Start free 7-day trial
        </motion.button>

        <p style={{
          textAlign: 'center', fontSize: 10, fontWeight: 300, color: T.t3,
          marginTop: 8, marginBottom: 10,
        }}>
          {isAnnual
            ? 'Then $24.99/year · Cancel anytime'
            : 'Then $2.99/month · Cancel anytime'}
        </p>

        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'block', width: '100%', background: 'none', border: 'none',
            fontSize: 10, fontWeight: 300, color: T.t3, textAlign: 'center',
            textDecoration: 'underline', cursor: 'pointer', marginBottom: 16,
            fontFamily: T.F,
          }}
        >
          Continue with free plan
        </button>

        <p style={{
          textAlign: 'center', fontSize: 9, fontWeight: 300, color: T.t3,
          lineHeight: 1.5, paddingBottom: 14,
        }}>
          {isAnnual
            ? "Billed annually. Cancel before trial ends and you won't be charged."
            : "Billed monthly. Cancel before trial ends and you won't be charged. Recurring billing until cancelled."}
        </p>
      </div>
    </div>
  );
}
