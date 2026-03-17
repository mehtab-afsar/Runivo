import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Zap } from 'lucide-react';
import { supabase } from '@shared/services/supabase';
import { haptic } from '@shared/lib/haptics';

interface Tier {
  id: 'runner-plus' | 'territory-lord' | 'empire-builder';
  name: string;
  price: string;
  popular?: boolean;
  color: string;
  gradient: string;
  features: string[];
  stripeEnvKey: string;
}

const TIERS: Tier[] = [
  {
    id: 'runner-plus',
    name: 'Runner Plus',
    price: '$4.99/mo',
    color: 'text-[#E8435A]',
    gradient: 'from-[#E8435A] to-[#D03A4F]',
    features: [
      'Unlimited energy',
      'No ads',
      '2x daily coins',
      'Advanced analytics',
      'Custom profile colors',
    ],
    stripeEnvKey: 'VITE_STRIPE_LINK_RUNNER_PLUS',
  },
  {
    id: 'territory-lord',
    name: 'Territory Lord',
    price: '$9.99/mo',
    popular: true,
    color: 'text-violet-600',
    gradient: 'from-violet-500 to-purple-600',
    features: [
      'Everything in Runner Plus',
      'AI route optimization',
      'Real-time territory alerts',
      'Auto-defense system',
      'Exclusive territory types',
      'Weekly coaching tips',
    ],
    stripeEnvKey: 'VITE_STRIPE_LINK_TERRITORY_LORD',
  },
  {
    id: 'empire-builder',
    name: 'Empire Builder',
    price: '$19.99/mo',
    color: 'text-amber-600',
    gradient: 'from-amber-500 to-orange-500',
    features: [
      'Everything in Territory Lord',
      'Create events & challenges',
      'Found & manage clubs',
      'Territory naming rights',
      'Personal trainer AI',
      'Beta feature access',
      '50 diamonds/month bonus',
    ],
    stripeEnvKey: 'VITE_STRIPE_LINK_EMPIRE_BUILDER',
  },
];

export default function Subscription() {
  const navigate = useNavigate();
  const [currentTier, setCurrentTier] = useState<string>('free');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('subscription_tier').eq('id', user.id).single()
        .then(({ data }) => { if (data?.subscription_tier) setCurrentTier(data.subscription_tier); });
    });
  }, []);

  const handleSubscribe = (tier: Tier) => {
    haptic('medium');
    const link = import.meta.env[tier.stripeEnvKey];
    if (link) {
      window.open(link, '_blank');
    } else {
      // Stripe not configured yet — show placeholder
      alert(`Stripe link for ${tier.name} not configured.\nSet ${tier.stripeEnvKey} in your .env file.`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] pb-12">
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-[#FAFAFA]/90 dark:bg-[#0A0A0A]/90 backdrop-blur border-b border-gray-100 px-5 py-4 flex items-center gap-3"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-gray-500" strokeWidth={2} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900">Upgrade Runivo</h1>
          <p className="text-xs text-gray-400">Unlock your full potential</p>
        </div>
      </div>

      {/* Hero */}
      <div className="px-5 pt-6 pb-4 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12, delay: 0.1 }}
          className="text-5xl mb-3"
        >
          ⚡
        </motion.div>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Choose Your Plan</h2>
        <p className="text-[13px] text-gray-400 mt-1">Cancel anytime · Billed monthly</p>
      </div>

      {/* Tier cards */}
      <div className="px-5 space-y-4">
        {TIERS.map((tier, i) => {
          const isCurrent = currentTier === tier.id;
          return (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm ${
                isCurrent ? 'border-[#E8435A]' : tier.popular ? 'border-violet-300' : 'border-gray-100'
              }`}
            >
              {/* Card header */}
              <div className={`px-4 py-3 bg-gradient-to-r ${tier.gradient} relative`}>
                {tier.popular && (
                  <span className="absolute top-2 right-3 text-[9px] font-bold uppercase tracking-wider
                                   bg-white/30 text-white px-2 py-0.5 rounded-full">
                    Most Popular
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute top-2 right-3 text-[9px] font-bold uppercase tracking-wider
                                   bg-white/30 text-white px-2 py-0.5 rounded-full">
                    Current Plan
                  </span>
                )}
                <h3 className="text-sm font-bold text-white">{tier.name}</h3>
                <p className="text-xl font-extrabold text-white mt-0.5">{tier.price}</p>
              </div>

              {/* Features */}
              <div className="px-4 py-4">
                <ul className="space-y-2 mb-4">
                  {tier.features.map(feat => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-[#F9E4E7] flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-[#E8435A]" strokeWidth={3} />
                      </div>
                      <span className="text-[13px] text-gray-700">{feat}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-3 rounded-xl bg-gray-50 border border-gray-100 text-center">
                    <span className="text-sm font-semibold text-gray-400">Current Plan</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(tier)}
                    className={`w-full py-3.5 rounded-xl bg-gradient-to-r ${tier.gradient}
                                text-sm font-bold text-white
                                shadow-[0_2px_12px_rgba(0,0,0,0.12)]
                                active:scale-[0.98] transition-transform`}
                  >
                    <Zap className="w-4 h-4 inline mr-1.5 -mt-0.5" strokeWidth={2.5} />
                    Upgrade to {tier.name}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-gray-300 px-8 mt-6 leading-relaxed">
        Subscriptions auto-renew monthly. Cancel anytime from your app store or account settings.
        Prices in USD. Availability may vary by region.
      </p>
    </div>
  );
}
