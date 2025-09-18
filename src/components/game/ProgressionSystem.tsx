import React, { useEffect, useState } from 'react';
import { useGameState } from '@/hooks/useGameState';

interface LevelUpModalProps {
  show: boolean;
  onClose: () => void;
  newLevel: number;
  xpGained: number;
}

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ show, onClose, newLevel, xpGained }) => {
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    if (show) {
      setAnimationPhase(0);

      // Animation sequence
      setTimeout(() => setAnimationPhase(1), 300);  // Level number appears
      setTimeout(() => setAnimationPhase(2), 800);  // Rewards appear
      setTimeout(() => setAnimationPhase(3), 1300); // Button appears
    }
  }, [show]);

  const getLevelRewards = (level: number) => {
    const baseRewards = {
      coins: level * 50,
      energyRefill: level % 5 === 0,
      premiumTrial: level === 10,
      exclusiveFeature: level % 10 === 0
    };

    return baseRewards;
  };

  const rewards = getLevelRewards(newLevel);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(20px)' }}
    >
      <div
        className="glass-card p-8 rounded-3xl max-w-md w-full text-center relative overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--accent-primary)',
          boxShadow: '0 0 60px var(--accent-glow)'
        }}
      >
        {/* Animated Background Elements */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            >
              ✨
            </div>
          ))}
        </div>

        <div className="relative z-10">
          {/* Header */}
          <div className="mb-8">
            <div
              className={`text-8xl mb-4 transition-all duration-500 ${
                animationPhase >= 1 ? 'animate-bounce scale-100 opacity-100' : 'scale-50 opacity-0'
              }`}
            >
              🎉
            </div>
            <h2
              className={`text-h1 font-bold mb-2 transition-all duration-500 ${
                animationPhase >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
              style={{ color: 'var(--accent-primary)' }}
            >
              LEVEL UP!
            </h2>
            <div
              className={`text-6xl font-extrabold mb-2 transition-all duration-500 ${
                animationPhase >= 1 ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
              }`}
              style={{
                color: 'var(--accent-primary)',
                textShadow: '0 0 20px var(--accent-glow)'
              }}
            >
              {newLevel}
            </div>
            <p
              className={`transition-all duration-500 ${
                animationPhase >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
              style={{ color: 'var(--text-secondary)' }}
            >
              You've reached level {newLevel}!
            </p>
          </div>

          {/* Level Rewards */}
          <div
            className={`mb-8 transition-all duration-500 ${
              animationPhase >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Level Rewards:
            </h3>

            <div className="space-y-3">
              <div
                className="p-3 rounded-2xl flex justify-between items-center"
                style={{ background: 'rgba(255, 184, 0, 0.1)', border: '1px solid #FFB800' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🪙</span>
                  <span style={{ color: 'var(--text-primary)' }}>Coin Bonus</span>
                </div>
                <span className="font-bold" style={{ color: '#FFB800' }}>
                  +{rewards.coins}
                </span>
              </div>

              {rewards.energyRefill && (
                <div
                  className="p-3 rounded-2xl flex justify-between items-center"
                  style={{ background: 'rgba(0, 212, 106, 0.1)', border: '1px solid #00D46A' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <span style={{ color: 'var(--text-primary)' }}>Energy Refill</span>
                  </div>
                  <span className="font-bold" style={{ color: '#00D46A' }}>
                    FULL
                  </span>
                </div>
              )}

              {rewards.premiumTrial && (
                <div
                  className="p-3 rounded-2xl flex justify-between items-center"
                  style={{ background: 'rgba(255, 71, 71, 0.1)', border: '1px solid var(--accent-primary)' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">👑</span>
                    <span style={{ color: 'var(--text-primary)' }}>Premium Trial</span>
                  </div>
                  <span className="font-bold" style={{ color: 'var(--accent-primary)' }}>
                    3 DAYS
                  </span>
                </div>
              )}

              {rewards.exclusiveFeature && !rewards.premiumTrial && (
                <div
                  className="p-3 rounded-2xl flex justify-between items-center"
                  style={{ background: 'rgba(79, 195, 247, 0.1)', border: '1px solid #4FC3F7' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🎯</span>
                    <span style={{ color: 'var(--text-primary)' }}>New Feature Unlocked</span>
                  </div>
                  <span className="font-bold" style={{ color: '#4FC3F7' }}>
                    NEW
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* XP Progress */}
          <div
            className={`mb-8 transition-all duration-500 ${
              animationPhase >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              XP Gained: +{xpGained}
            </div>
            <div
              className="w-full h-2 rounded-full overflow-hidden"
              style={{ background: 'rgba(255, 255, 255, 0.1)' }}
            >
              <div
                className="h-full transition-all duration-1000"
                style={{
                  width: animationPhase >= 2 ? '25%' : '0%',
                  background: 'linear-gradient(90deg, var(--accent-primary) 0%, #FF6B6B 100%)',
                  boxShadow: '0 0 10px var(--accent-glow)'
                }}
              />
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Next level in {Math.floor(Math.random() * 500) + 200} XP
            </div>
          </div>

          {/* Action Button */}
          <div
            className={`transition-all duration-500 ${
              animationPhase >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            <button
              onClick={onClose}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 hover:scale-105"
              style={{
                background: 'var(--accent-primary)',
                color: '#000000',
                boxShadow: '0 0 20px var(--accent-glow)'
              }}
            >
              Continue Adventure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AchievementUnlockedProps {
  show: boolean;
  onClose: () => void;
  achievement: {
    id: string;
    title: string;
    description: string;
    icon: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    rewards: {
      xp: number;
      gems: number;
      title?: string;
    };
  };
}

export const AchievementUnlocked: React.FC<AchievementUnlockedProps> = ({ show, onClose, achievement }) => {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (show) {
      setRevealed(false);
      setTimeout(() => setRevealed(true), 500);
    }
  }, [show]);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return '#FFD700';
      case 'epic': return '#9C27B0';
      case 'rare': return '#2196F3';
      default: return '#4CAF50';
    }
  };

  const getRarityGlow = (rarity: string) => {
    return `0 0 30px ${getRarityColor(rarity)}, 0 0 60px ${getRarityColor(rarity)}40`;
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(20px)' }}
    >
      <div
        className={`glass-card p-8 rounded-3xl max-w-md w-full text-center transition-all duration-700 ${
          revealed ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
        style={{
          background: 'var(--bg-card)',
          borderColor: getRarityColor(achievement.rarity),
          boxShadow: revealed ? getRarityGlow(achievement.rarity) : 'none'
        }}
      >
        {/* Header */}
        <div className="mb-6">
          <div className="text-4xl mb-4">🏆</div>
          <h2
            className="text-h2 font-bold mb-2"
            style={{ color: getRarityColor(achievement.rarity) }}
          >
            Achievement Unlocked!
          </h2>
          <div
            className="inline-block px-3 py-1 rounded-full text-sm font-bold mb-4"
            style={{
              background: `${getRarityColor(achievement.rarity)}20`,
              color: getRarityColor(achievement.rarity),
              border: `1px solid ${getRarityColor(achievement.rarity)}60`
            }}
          >
            {achievement.rarity.toUpperCase()}
          </div>
        </div>

        {/* Achievement Display */}
        <div
          className={`mb-6 p-6 rounded-3xl transition-all duration-500 ${
            revealed ? 'scale-100' : 'scale-95'
          }`}
          style={{
            background: `${getRarityColor(achievement.rarity)}10`,
            border: `2px solid ${getRarityColor(achievement.rarity)}40`
          }}
        >
          <div className="text-6xl mb-4">{achievement.icon}</div>
          <h3
            className="text-h3 font-bold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {achievement.title}
          </h3>
          <p
            className="text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            {achievement.description}
          </p>
        </div>

        {/* Rewards */}
        <div
          className="mb-6 p-4 rounded-2xl"
          style={{ background: 'rgba(255, 255, 255, 0.05)' }}
        >
          <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Rewards:
          </h4>
          <div className="flex justify-center gap-6">
            <div className="text-center">
              <div className="text-2xl mb-1">⚡</div>
              <div className="font-bold" style={{ color: 'var(--accent-primary)' }}>
                +{achievement.rewards.xp}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                XP
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">💎</div>
              <div className="font-bold" style={{ color: '#4FC3F7' }}>
                +{achievement.rewards.gems}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Gems
              </div>
            </div>
            {achievement.rewards.title && (
              <div className="text-center">
                <div className="text-2xl mb-1">🎖️</div>
                <div className="font-bold" style={{ color: getRarityColor(achievement.rarity) }}>
                  Title
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {achievement.rewards.title}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl font-semibold transition-all duration-300 hover:scale-105"
          style={{
            background: getRarityColor(achievement.rarity),
            color: '#000000',
            boxShadow: `0 0 20px ${getRarityColor(achievement.rarity)}60`
          }}
        >
          Awesome!
        </button>
      </div>
    </div>
  );
};

// Hook for managing progression events
export const useProgression = () => {
  const { playerStats } = useGameState();
  const [levelUpData, setLevelUpData] = useState<{ show: boolean; level: number; xp: number }>({
    show: false,
    level: 0,
    xp: 0
  });
  const [achievementData, setAchievementData] = useState<{ show: boolean; achievement: any }>({
    show: false,
    achievement: null
  });

  const checkLevelUp = (oldXp: number, newXp: number, oldLevel: number) => {
    const xpForNextLevel = (level: number) => level * 100 + 50;

    let currentLevel = oldLevel;
    let remainingXp = newXp;

    while (remainingXp >= xpForNextLevel(currentLevel)) {
      remainingXp -= xpForNextLevel(currentLevel);
      currentLevel++;
    }

    if (currentLevel > oldLevel) {
      setLevelUpData({
        show: true,
        level: currentLevel,
        xp: newXp - oldXp
      });
      return true;
    }

    return false;
  };

  const checkAchievements = (stats: any) => {
    // Check for various achievement conditions
    const achievements = [
      {
        id: 'first-territory',
        condition: () => stats.territories.owned >= 1,
        achievement: {
          id: 'first-territory',
          title: 'First Conquest',
          description: 'Claim your first territory',
          icon: '🏁',
          rarity: 'common' as const,
          rewards: { xp: 50, gems: 5 }
        }
      },
      {
        id: 'speed-demon',
        condition: () => stats.xp >= 1000,
        achievement: {
          id: 'speed-demon',
          title: 'Speed Demon',
          description: 'Reach 1000 total XP',
          icon: '⚡',
          rarity: 'rare' as const,
          rewards: { xp: 100, gems: 10 }
        }
      },
      {
        id: 'territory-lord',
        condition: () => stats.territories.owned >= 10,
        achievement: {
          id: 'territory-lord',
          title: 'Territory Lord',
          description: 'Own 10 territories',
          icon: '👑',
          rarity: 'epic' as const,
          rewards: { xp: 200, gems: 25, title: 'Territory Lord' }
        }
      }
    ];

    const unlockedAchievement = achievements.find(({ id, condition, achievement }) => {
      return condition() && !stats.achievements.includes(id);
    });

    if (unlockedAchievement) {
      setAchievementData({
        show: true,
        achievement: unlockedAchievement.achievement
      });
      return unlockedAchievement.achievement;
    }

    return null;
  };

  const closeLevelUp = () => {
    setLevelUpData({ show: false, level: 0, xp: 0 });
  };

  const closeAchievement = () => {
    setAchievementData({ show: false, achievement: null });
  };

  return {
    levelUpData,
    achievementData,
    checkLevelUp,
    checkAchievements,
    closeLevelUp,
    closeAchievement
  };
};