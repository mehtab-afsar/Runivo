import React, { useState } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { EnergyIcon, CoinIcon, GemIcon, UserIcon, CrownIcon, FireIcon } from '@/components/ui/icons';

interface GameHUDProps {
  compact?: boolean;
}

export const GameHUD: React.FC<GameHUDProps> = ({ compact = false }) => {
  const { playerStats, collectDailyReward, purchasePremium } = useGameState();
  const [showCurrencies, setShowCurrencies] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const getEnergyColor = (percentage: number) => {
    if (percentage > 70) return '#00FF88'; // runner-success
    if (percentage > 30) return '#FFB800'; // runner-warning
    return '#FF4444'; // runner-danger
  };

  const getEnergyPercentage = () => {
    return (playerStats.energy.current / playerStats.energy.max) * 100;
  };

  const formatTimeUntilRegen = () => {
    if (playerStats.energy.current >= playerStats.energy.max) return 'Full';
    const now = new Date();
    const timeSinceRegen = now.getTime() - playerStats.energy.lastRegen.getTime();
    const minutesUntilNext = 5 - Math.floor(timeSinceRegen / (1000 * 60));
    return `${Math.max(0, minutesUntilNext)}m`;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {/* Energy */}
        <div className="flex items-center gap-1 px-2 py-1 bg-runner-card border border-runner-border rounded-lg text-sm">
          <EnergyIcon size={16} color={getEnergyColor(getEnergyPercentage())} />
          <span style={{ color: getEnergyColor(getEnergyPercentage()) }}>
            {playerStats.energy.current}
          </span>
        </div>

        {/* Coins */}
        <div className="flex items-center gap-1 px-2 py-1 bg-runner-card border border-runner-border rounded-lg text-sm text-runner-text">
          <CoinIcon size={16} color="#FFD700" />
          <span>{playerStats.currencies.coins.toLocaleString()}</span>
        </div>

        {/* Gems */}
        <div className="flex items-center gap-1 px-2 py-1 bg-runner-card border border-runner-border rounded-lg text-sm text-runner-text">
          <GemIcon size={16} color="#00AAFF" />
          <span>{playerStats.currencies.gems}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Full HUD */}
      <div className="bg-runner-card/95 backdrop-blur-lg border border-runner-border rounded-lg p-4">
        {/* Player Info */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-runner-lime rounded-full flex items-center justify-center text-xl">
              <UserIcon size={24} color="#000000" />
            </div>
            <div>
              <div className="font-bold text-runner-text">
                Level {playerStats.level}
              </div>
              <div className="text-sm text-runner-text-muted">
                {playerStats.xp} / {playerStats.xp + playerStats.xpToNext} XP
              </div>
            </div>
          </div>
          {playerStats.subscription.tier === 'free' && (
            <button
              onClick={() => setShowPremiumModal(true)}
              className="px-3 py-1 bg-runner-lime text-runner-black rounded-full text-sm font-semibold hover:bg-runner-lime/90 transition-colors"
            >
              GO PRO
            </button>
          )}
        </div>

        {/* XP Progress Bar */}
        <div className="mb-4">
          <div className="w-full h-2 bg-runner-dark rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${(playerStats.xp / (playerStats.xp + playerStats.xpToNext)) * 100}%`,
                background: 'linear-gradient(90deg, #CAFF00 0%, #00FF88 100%)'
              }}
            />
          </div>
        </div>

        {/* Energy System */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <EnergyIcon size={20} color="var(--accent-primary)" />
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Energy
              </span>
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {playerStats.energy.current} / {playerStats.energy.max}
              {playerStats.subscription.tier === 'free' && ` (${formatTimeUntilRegen()})`}
            </div>
          </div>
          <div className="w-full h-3 bg-black/20 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${getEnergyPercentage()}%`,
                background: getEnergyColor(getEnergyPercentage()),
                boxShadow: `0 0 10px ${getEnergyColor(getEnergyPercentage())}40`
              }}
            />
          </div>
          {playerStats.subscription.tier === 'free' && playerStats.energy.current < 20 && (
            <div className="text-xs mt-1 text-center" style={{ color: 'var(--accent-primary)' }}>
              Low energy! Upgrade to Premium for unlimited energy
            </div>
          )}
        </div>

        {/* Currencies */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="mb-1 flex justify-center">
              <CoinIcon size={32} color="#FFB800" />
            </div>
            <div className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
              {playerStats.currencies.coins.toLocaleString()}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Coins
            </div>
          </div>
          <div className="text-center">
            <div className="mb-1 flex justify-center">
              <GemIcon size={32} color="#4FC3F7" />
            </div>
            <div className="font-bold text-lg" style={{ color: '#4FC3F7' }}>
              {playerStats.currencies.gems}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Gems
            </div>
          </div>
          <div
            className="text-center cursor-pointer"
            onClick={() => setShowCurrencies(!showCurrencies)}
          >
            <div className="mb-1 flex justify-center">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-primary)' }}>
                <span className="text-sm font-bold text-black">BP</span>
              </div>
            </div>
            <div className="font-bold text-sm" style={{ color: 'var(--accent-primary)' }}>
              Brand
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Points
            </div>
          </div>
        </div>

        {/* Brand Points (Expandable) */}
        {showCurrencies && (
          <div className="space-y-2 mb-4">
            {Object.entries(playerStats.currencies.brandPoints).map(([brand, points]) => (
              <div key={brand} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{
                      background: brand === 'decathlon' ? '#0082C3' :
                                 brand === 'nike' ? '#FF5722' :
                                 brand === 'adidas' ? '#000000' : '#666'
                    }}
                  />
                  <span className="text-sm capitalize" style={{ color: 'var(--text-primary)' }}>
                    {brand}
                  </span>
                </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {points}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Daily Streak */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FireIcon size={20} color="#FF4747" />
            <span style={{ color: 'var(--text-primary)' }}>
              {playerStats.dailyStreak} day streak
            </span>
          </div>
          <button
            onClick={collectDailyReward}
            className="px-3 py-1 rounded-lg text-sm font-medium"
            style={{
              background: 'var(--accent-subtle)',
              color: 'var(--accent-primary)',
              border: '1px solid rgba(255, 71, 71, 0.3)'
            }}
          >
            Claim Daily
          </button>
        </div>
      </div>

      {/* Premium Modal */}
      {showPremiumModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowPremiumModal(false)}
        >
          <div
            className="glass-card p-6 rounded-3xl max-w-sm w-full"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-light)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="mb-2 flex justify-center">
                <CrownIcon size={48} color="#FFD700" />
              </div>
              <h2 className="text-h2 font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Go Premium!
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Unlock unlimited energy, exclusive features, and real rewards
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div
                className="p-4 rounded-2xl border cursor-pointer hover:scale-105 transition-transform"
                style={{
                  background: 'rgba(255, 71, 71, 0.1)',
                  borderColor: 'var(--accent-primary)'
                }}
                onClick={() => purchasePremium('runner-plus')}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    Runner Plus
                  </h3>
                  <span className="font-bold" style={{ color: 'var(--accent-primary)' }}>
                    $4.99/mo
                  </span>
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Unlimited energy, no ads, 2x coins
                </div>
              </div>

              <div
                className="p-4 rounded-2xl border cursor-pointer hover:scale-105 transition-transform"
                style={{
                  background: 'rgba(255, 184, 0, 0.1)',
                  borderColor: '#FFB800'
                }}
                onClick={() => purchasePremium('territory-lord')}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                    Territory Lord
                  </h3>
                  <span className="font-bold" style={{ color: '#FFB800' }}>
                    $9.99/mo
                  </span>
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  AI optimization, auto-defense, exclusive territories
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPremiumModal(false)}
                className="flex-1 py-3 rounded-2xl font-semibold"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-primary)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              >
                Later
              </button>
              <button
                onClick={() => {
                  purchasePremium('runner-plus');
                  setShowPremiumModal(false);
                }}
                className="flex-1 py-3 rounded-2xl font-semibold"
                style={{
                  background: 'var(--accent-primary)',
                  color: '#000000'
                }}
              >
                Start Trial
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};