import React, { useState } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { Button } from '@/components/ui/button';

interface PremiumModalProps {
  show: boolean;
  onClose: () => void;
  tier?: 'runner-plus' | 'territory-lord' | 'empire-builder';
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ show, onClose, tier }) => {
  const { playerStats, purchasePremium } = useGameState();
  const [selectedTier, setSelectedTier] = useState<string>(tier || 'runner-plus');

  const premiumTiers = {
    'runner-plus': {
      name: 'Runner Plus',
      price: '$4.99',
      period: 'month',
      color: '#FF4747',
      gradient: 'linear-gradient(135deg, #FF4747 0%, #FF6B6B 100%)',
      popular: true,
      features: [
        'Unlimited energy ⚡',
        'No advertisements 🚫',
        'Double daily coins 💰',
        'Advanced run analytics 📊',
        'Custom app themes 🎨',
        'Priority customer support 🎧'
      ],
      savings: 'Most Popular!'
    },
    'territory-lord': {
      name: 'Territory Lord',
      price: '$9.99',
      period: 'month',
      color: '#FFB800',
      gradient: 'linear-gradient(135deg, #FFB800 0%, #FFC107 100%)',
      popular: false,
      features: [
        'Everything in Runner Plus',
        'AI route optimization 🤖',
        'Real-time territory alerts 🔔',
        'Auto-defense system 🛡️',
        'Exclusive territory access 🗝️',
        'Weekly coaching sessions 🏃‍♂️',
        'Advanced battle strategies ⚔️'
      ],
      savings: 'Best Value!'
    },
    'empire-builder': {
      name: 'Empire Builder',
      price: '$19.99',
      period: 'month',
      color: '#9C27B0',
      gradient: 'linear-gradient(135deg, #9C27B0 0%, #E91E63 100%)',
      popular: false,
      features: [
        'Everything in Territory Lord',
        'Create custom challenges 🎯',
        'Found and manage clubs 👥',
        'Territory naming rights 📝',
        'Personal trainer AI 🏋️‍♂️',
        'Beta access to new features 🚀',
        'Exclusive events & competitions 🏆',
        'Real-world prize eligibility 🎁'
      ],
      savings: 'Ultimate Experience!'
    }
  };

  const handlePurchase = (tierKey: string) => {
    purchasePremium(tierKey as any);
    onClose();
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(20px)' }}
      onClick={onClose}
    >
      <div
        className="glass-card rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--accent-primary)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: 'var(--border-light)' }}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-h2 font-bold" style={{ color: 'var(--accent-primary)' }}>
                Upgrade to Premium
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Unlock unlimited potential and exclusive features
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Current Plan Status */}
        {playerStats.subscription.tier !== 'free' && (
          <div className="p-4 m-6 rounded-2xl" style={{ background: 'rgba(0, 212, 106, 0.1)', border: '1px solid #00D46A' }}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">👑</span>
              <div>
                <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  You're a {premiumTiers[playerStats.subscription.tier as keyof typeof premiumTiers]?.name} member!
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {playerStats.subscription.expires && `Expires: ${playerStats.subscription.expires.toLocaleDateString()}`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tier Selection */}
        <div className="p-6">
          <div className="grid gap-4">
            {Object.entries(premiumTiers).map(([key, tierData]) => (
              <div
                key={key}
                className={`relative p-6 rounded-3xl border-2 cursor-pointer transition-all duration-300 ${
                  selectedTier === key ? 'scale-105' : 'hover:scale-102'
                }`}
                style={{
                  background: selectedTier === key
                    ? `${tierData.color}15`
                    : 'rgba(255, 255, 255, 0.05)',
                  borderColor: selectedTier === key
                    ? tierData.color
                    : 'rgba(255, 255, 255, 0.1)',
                  boxShadow: selectedTier === key
                    ? `0 0 30px ${tierData.color}40`
                    : 'none'
                }}
                onClick={() => setSelectedTier(key)}
              >
                {/* Popular Badge */}
                {tierData.popular && (
                  <div
                    className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded-full text-sm font-bold"
                    style={{
                      background: tierData.gradient,
                      color: '#000000'
                    }}
                  >
                    {tierData.savings}
                  </div>
                )}

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-h3 font-bold" style={{ color: 'var(--text-primary)' }}>
                      {tierData.name}
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold" style={{ color: tierData.color }}>
                        {tierData.price}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        /{tierData.period}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedTier === key ? 'border-current' : 'border-gray-400'
                    }`}
                    style={{ borderColor: selectedTier === key ? tierData.color : 'rgba(255, 255, 255, 0.3)' }}
                  >
                    {selectedTier === key && (
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: tierData.color }}
                      />
                    )}
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-2">
                  {tierData.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                        style={{ background: `${tierData.color}20`, color: tierData.color }}
                      >
                        ✓
                      </div>
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Special Savings Text */}
                {!tierData.popular && (
                  <div className="mt-4 text-center">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: tierData.color }}
                    >
                      {tierData.savings}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t space-y-4" style={{ borderColor: 'var(--border-light)' }}>
          <Button
            onClick={() => handlePurchase(selectedTier)}
            className="w-full py-4 rounded-2xl font-bold text-lg"
            style={{
              background: premiumTiers[selectedTier as keyof typeof premiumTiers].gradient,
              color: '#000000',
              boxShadow: `0 0 20px ${premiumTiers[selectedTier as keyof typeof premiumTiers].color}40`
            }}
          >
            {playerStats.subscription.tier === 'free' ? 'Start Free Trial' : 'Upgrade Plan'}
          </Button>

          <div className="text-center">
            <button
              onClick={onClose}
              className="text-sm opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
            >
              Maybe later
            </button>
          </div>

          {/* Terms */}
          <div className="text-xs text-center space-y-1" style={{ color: 'var(--text-secondary)' }}>
            <p>7-day free trial for new subscribers</p>
            <p>Cancel anytime. Auto-renewal can be turned off in account settings.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface EnergyUpgradePromptProps {
  show: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export const EnergyUpgradePrompt: React.FC<EnergyUpgradePromptProps> = ({ show, onClose, onUpgrade }) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="glass-card p-6 rounded-3xl max-w-sm w-full text-center"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--accent-primary)'
        }}
      >
        <div className="text-4xl mb-4">⚡</div>
        <h3 className="text-h3 font-bold mb-2" style={{ color: 'var(--accent-primary)' }}>
          Low Energy!
        </h3>
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          You don't have enough energy for this mission. Upgrade to Premium for unlimited energy!
        </p>

        <div className="space-y-3">
          <Button
            onClick={onUpgrade}
            className="w-full py-3 rounded-2xl font-semibold"
            style={{
              background: 'var(--accent-primary)',
              color: '#000000'
            }}
          >
            <span className="mr-2">👑</span>
            Upgrade to Premium
          </Button>

          <Button
            onClick={onClose}
            className="w-full py-3 rounded-2xl font-semibold"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'var(--text-primary)'
            }}
          >
            Wait for Energy
          </Button>
        </div>

        <div className="mt-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Energy regenerates every 5 minutes
        </div>
      </div>
    </div>
  );
};

interface FeatureLockedProps {
  show: boolean;
  onClose: () => void;
  featureName: string;
  requiredTier: string;
  onUpgrade: () => void;
}

export const FeatureLocked: React.FC<FeatureLockedProps> = ({
  show,
  onClose,
  featureName,
  requiredTier,
  onUpgrade
}) => {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="glass-card p-6 rounded-3xl max-w-sm w-full text-center"
        style={{
          background: 'var(--bg-card)',
          borderColor: '#FFB800'
        }}
      >
        <div className="text-4xl mb-4">🔒</div>
        <h3 className="text-h3 font-bold mb-2" style={{ color: '#FFB800' }}>
          Premium Feature
        </h3>
        <p className="mb-2" style={{ color: 'var(--text-primary)' }}>
          <strong>{featureName}</strong> is available for {requiredTier} members
        </p>
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          Unlock this feature and many more with a premium subscription
        </p>

        <div className="space-y-3">
          <Button
            onClick={onUpgrade}
            className="w-full py-3 rounded-2xl font-semibold"
            style={{
              background: '#FFB800',
              color: '#000000'
            }}
          >
            <span className="mr-2">👑</span>
            Upgrade Now
          </Button>

          <Button
            onClick={onClose}
            className="w-full py-3 rounded-2xl font-semibold"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'var(--text-primary)'
            }}
          >
            Maybe Later
          </Button>
        </div>
      </div>
    </div>
  );
};

// Premium benefits display component
export const PremiumBenefits: React.FC<{ tier: string }> = ({ tier }) => {
  const benefits = {
    'runner-plus': [
      'Unlimited Energy ⚡',
      'No Ads 🚫',
      '2x Daily Coins 💰',
      'Advanced Analytics 📊',
      'Custom Themes 🎨'
    ],
    'territory-lord': [
      'AI Route Optimization 🤖',
      'Real-time Alerts 🔔',
      'Auto-defense System 🛡️',
      'Exclusive Territories 🗝️',
      'Weekly Coaching 🏃‍♂️'
    ],
    'empire-builder': [
      'Create Challenges 🎯',
      'Found Clubs 👥',
      'Territory Naming 📝',
      'Personal Trainer AI 🏋️‍♂️',
      'Beta Access 🚀'
    ]
  };

  const tierBenefits = benefits[tier as keyof typeof benefits] || [];

  if (!tierBenefits.length) return null;

  return (
    <div
      className="glass-card p-4 rounded-2xl mb-4"
      style={{
        background: 'rgba(255, 71, 71, 0.1)',
        borderColor: 'var(--accent-primary)'
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">👑</span>
        <span className="font-semibold" style={{ color: 'var(--accent-primary)' }}>
          Premium Active
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {tierBenefits.map((benefit, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
              style={{ background: 'var(--accent-primary)', color: '#000000' }}
            >
              ✓
            </div>
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {benefit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};