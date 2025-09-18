import React, { useState, useEffect } from 'react';
import { useGameState } from '@/hooks/useGameState';
import { Button } from '@/components/ui/button';
import { EnergyIcon, CoinIcon, GemIcon, StoreIcon, FireIcon, TrophyIcon } from '@/components/ui/icons';

interface RewardSystemProps {
  show: boolean;
  onClose: () => void;
  rewards: {
    xp: number;
    coins: number;
    gems?: number;
    brandPoints?: { [brand: string]: number };
  };
  reason: string;
}

export const RewardSystem: React.FC<RewardSystemProps> = ({ show, onClose, rewards, reason }) => {
  const [animationPhase, setAnimationPhase] = useState(0);
  const [collectedRewards, setCollectedRewards] = useState<string[]>([]);

  useEffect(() => {
    if (show) {
      setAnimationPhase(0);
      setCollectedRewards([]);

      // Animate rewards appearing one by one
      const phases = ['xp', 'coins', 'gems', 'brandPoints'];
      phases.forEach((phase, index) => {
        setTimeout(() => {
          setAnimationPhase(index + 1);
        }, index * 500);
      });
    }
  }, [show]);

  const collectReward = (type: string) => {
    setCollectedRewards(prev => [...prev, type]);
  };

  const allRewardsCollected = () => {
    const totalRewards = ['xp', 'coins'];
    if (rewards.gems && rewards.gems > 0) totalRewards.push('gems');
    if (rewards.brandPoints) totalRewards.push('brandPoints');

    return totalRewards.every(reward => collectedRewards.includes(reward));
  };

  const handleFinish = () => {
    onClose();
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(20px)' }}
    >
      <div
        className="glass-card p-8 rounded-3xl max-w-md w-full text-center animate-scale-in"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--accent-primary)',
          boxShadow: '0 0 40px var(--accent-glow)'
        }}
      >
        {/* Header */}
        <div className="mb-8">
          <div className="mb-4 flex justify-center animate-bounce">
          <TrophyIcon size={64} color="var(--accent-primary)" />
        </div>
          <h2 className="text-h2 font-bold mb-2" style={{ color: 'var(--accent-primary)' }}>
            Mission Complete!
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>{reason}</p>
        </div>

        {/* Reward Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* XP Reward */}
          <div
            className={`reward-card ${animationPhase >= 1 ? 'animate-slide-up' : 'opacity-0'} ${
              collectedRewards.includes('xp') ? 'collected' : ''
            }`}
            onClick={() => collectReward('xp')}
            style={{
              background: collectedRewards.includes('xp')
                ? 'rgba(0, 212, 106, 0.2)'
                : 'rgba(255, 71, 71, 0.1)',
              border: collectedRewards.includes('xp')
                ? '2px solid #00D46A'
                : '2px solid var(--accent-primary)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              transform: collectedRewards.includes('xp') ? 'scale(0.95)' : 'scale(1)'
            }}
          >
            <div className="p-4 rounded-2xl">
              <div className="mb-2 flex justify-center">
                <EnergyIcon size={32} color="var(--accent-primary)" />
              </div>
              <div className="font-bold text-xl" style={{ color: 'var(--accent-primary)' }}>
                +{rewards.xp}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Experience Points
              </div>
              {collectedRewards.includes('xp') && (
                <div className="text-xs mt-2" style={{ color: '#00D46A' }}>
                  ✓ Collected
                </div>
              )}
            </div>
          </div>

          {/* Coins Reward */}
          <div
            className={`reward-card ${animationPhase >= 2 ? 'animate-slide-up' : 'opacity-0'} ${
              collectedRewards.includes('coins') ? 'collected' : ''
            }`}
            onClick={() => collectReward('coins')}
            style={{
              background: collectedRewards.includes('coins')
                ? 'rgba(0, 212, 106, 0.2)'
                : 'rgba(255, 184, 0, 0.1)',
              border: collectedRewards.includes('coins')
                ? '2px solid #00D46A'
                : '2px solid #FFB800',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              transform: collectedRewards.includes('coins') ? 'scale(0.95)' : 'scale(1)'
            }}
          >
            <div className="p-4 rounded-2xl">
              <div className="mb-2 flex justify-center">
                <CoinIcon size={32} color="#FFB800" />
              </div>
              <div className="font-bold text-xl" style={{ color: '#FFB800' }}>
                +{rewards.coins}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Coins
              </div>
              {collectedRewards.includes('coins') && (
                <div className="text-xs mt-2" style={{ color: '#00D46A' }}>
                  ✓ Collected
                </div>
              )}
            </div>
          </div>

          {/* Gems Reward (if applicable) */}
          {rewards.gems && rewards.gems > 0 && (
            <div
              className={`reward-card ${animationPhase >= 3 ? 'animate-slide-up' : 'opacity-0'} ${
                collectedRewards.includes('gems') ? 'collected' : ''
              }`}
              onClick={() => collectReward('gems')}
              style={{
                background: collectedRewards.includes('gems')
                  ? 'rgba(0, 212, 106, 0.2)'
                  : 'rgba(79, 195, 247, 0.1)',
                border: collectedRewards.includes('gems')
                  ? '2px solid #00D46A'
                  : '2px solid #4FC3F7',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                transform: collectedRewards.includes('gems') ? 'scale(0.95)' : 'scale(1)'
              }}
            >
              <div className="p-4 rounded-2xl">
                <div className="mb-2 flex justify-center">
                <GemIcon size={32} color="#4FC3F7" />
              </div>
                <div className="font-bold text-xl" style={{ color: '#4FC3F7' }}>
                  +{rewards.gems}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Gems
                </div>
                {collectedRewards.includes('gems') && (
                  <div className="text-xs mt-2" style={{ color: '#00D46A' }}>
                    ✓ Collected
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Brand Points Reward (if applicable) */}
          {rewards.brandPoints && (
            <div
              className={`reward-card ${animationPhase >= 4 ? 'animate-slide-up' : 'opacity-0'} ${
                collectedRewards.includes('brandPoints') ? 'collected' : ''
              }`}
              onClick={() => collectReward('brandPoints')}
              style={{
                background: collectedRewards.includes('brandPoints')
                  ? 'rgba(0, 212, 106, 0.2)'
                  : 'rgba(255, 71, 71, 0.1)',
                border: collectedRewards.includes('brandPoints')
                  ? '2px solid #00D46A'
                  : '2px solid var(--accent-primary)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                transform: collectedRewards.includes('brandPoints') ? 'scale(0.95)' : 'scale(1)'
              }}
            >
              <div className="p-4 rounded-2xl">
                <div className="mb-2 flex justify-center">
                <StoreIcon size={32} color="var(--accent-primary)" />
              </div>
                <div className="font-bold text-xl" style={{ color: 'var(--accent-primary)' }}>
                  +{Object.values(rewards.brandPoints).reduce((a, b) => a + b, 0)}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Brand Points
                </div>
                {collectedRewards.includes('brandPoints') && (
                  <div className="text-xs mt-2" style={{ color: '#00D46A' }}>
                    ✓ Collected
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Brand Points Breakdown */}
        {rewards.brandPoints && collectedRewards.includes('brandPoints') && (
          <div className="mb-6 p-4 rounded-2xl" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
            <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Brand Points Earned:
            </h4>
            <div className="space-y-2">
              {Object.entries(rewards.brandPoints).map(([brand, points]) => (
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
                    <span className="capitalize" style={{ color: 'var(--text-primary)' }}>
                      {brand}
                    </span>
                  </div>
                  <span className="font-semibold" style={{ color: 'var(--accent-primary)' }}>
                    +{points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex justify-center gap-2">
            {['xp', 'coins', ...(rewards.gems && rewards.gems > 0 ? ['gems'] : []), ...(rewards.brandPoints ? ['brandPoints'] : [])].map((reward, index) => (
              <div
                key={reward}
                className="w-3 h-3 rounded-full transition-all duration-300"
                style={{
                  background: collectedRewards.includes(reward)
                    ? '#00D46A'
                    : animationPhase > index
                      ? 'var(--accent-primary)'
                      : 'rgba(255, 255, 255, 0.2)'
                }}
              />
            ))}
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={handleFinish}
          disabled={!allRewardsCollected()}
          className="w-full py-3 rounded-2xl font-semibold transition-all duration-300"
          style={{
            background: allRewardsCollected()
              ? 'var(--accent-primary)'
              : 'rgba(255, 255, 255, 0.1)',
            color: allRewardsCollected() ? '#000000' : 'var(--text-secondary)',
            opacity: allRewardsCollected() ? 1 : 0.6
          }}
        >
          {allRewardsCollected() ? 'Continue Adventure' : 'Tap rewards to collect'}
        </Button>

        {/* Skip Option */}
        <button
          onClick={handleFinish}
          className="mt-4 text-sm opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
        >
          Skip animation
        </button>
      </div>
    </div>
  );
};

interface DailyRewardSystemProps {
  show: boolean;
  onClose: () => void;
}

export const DailyRewardSystem: React.FC<DailyRewardSystemProps> = ({ show, onClose }) => {
  const { playerStats, collectDailyReward } = useGameState();
  const [rewards, setRewards] = useState<any>(null);
  const [collecting, setCollecting] = useState(false);

  const handleCollectDaily = async () => {
    setCollecting(true);
    const dailyRewards = collectDailyReward();
    setRewards(dailyRewards);

    setTimeout(() => {
      setCollecting(false);
    }, 1500);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(20px)' }}
    >
      <div
        className="glass-card p-8 rounded-3xl max-w-md w-full text-center"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--accent-primary)'
        }}
      >
        <div className="mb-8">
          <div className="mb-4 flex justify-center">
          <FireIcon size={64} color="#FF4747" />
        </div>
          <h2 className="text-h2 font-bold mb-2" style={{ color: 'var(--accent-primary)' }}>
            Daily Streak Reward
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Day {playerStats.dailyStreak} of your streak!
          </p>
        </div>

        {rewards ? (
          <div className="space-y-4 mb-8">
            <div
              className="p-4 rounded-2xl"
              style={{ background: 'rgba(255, 71, 71, 0.1)', border: '1px solid var(--accent-primary)' }}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="mb-1 flex justify-center">
                  <CoinIcon size={24} color="#FFB800" />
                </div>
                  <div className="font-bold" style={{ color: '#FFB800' }}>+{rewards.coins}</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Coins</div>
                </div>
                <div className="text-center">
                  <div className="mb-1 flex justify-center">
                  <EnergyIcon size={24} color="var(--accent-primary)" />
                </div>
                  <div className="font-bold" style={{ color: 'var(--accent-primary)' }}>+{rewards.xp}</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>XP</div>
                </div>
              </div>
              {rewards.gems > 0 && (
                <div className="text-center mt-4">
                  <div className="mb-1 flex justify-center">
                    <GemIcon size={24} color="#4FC3F7" />
                  </div>
                  <div className="font-bold" style={{ color: '#4FC3F7' }}>+{rewards.gems}</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Bonus Gems!</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <div className="text-2xl mb-4" style={{ color: 'var(--accent-primary)' }}>
              Ready to claim your daily reward?
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Streaks give bonus coins and XP. 7+ day streaks earn gems!
            </div>
          </div>
        )}

        <div className="space-y-4">
          {!rewards && (
            <Button
              onClick={handleCollectDaily}
              disabled={collecting}
              className="w-full py-3 rounded-2xl font-semibold"
              style={{
                background: 'var(--accent-primary)',
                color: '#000000'
              }}
            >
              {collecting ? '✨ Collecting...' : '🎯 Claim Daily Reward'}
            </Button>
          )}

          <Button
            onClick={onClose}
            className="w-full py-3 rounded-2xl font-semibold"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'var(--text-primary)'
            }}
          >
            {rewards ? 'Continue' : 'Maybe Later'}
          </Button>
        </div>
      </div>
    </div>
  );
};