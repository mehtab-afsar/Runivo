import React, { useState } from 'react';
import { useGameState } from '@/hooks/useGameState';
import type { BrandPartnership } from '@/types/game';

interface PartnershipHubProps {
  show: boolean;
  onClose: () => void;
}

export const PartnershipHub: React.FC<PartnershipHubProps> = ({ show, onClose }) => {
  const { playerStats } = useGameState();
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  const brandPartnerships: BrandPartnership[] = [
    {
      id: 'decathlon',
      name: 'Decathlon',
      logo: '🏃‍♂️',
      color: '#0082C3',
      territories: ['territory-1', 'territory-5', 'territory-12'],
      challenges: [],
      rewards: {
        tier1: { threshold: 100, reward: '5% off running gear' },
        tier2: { threshold: 500, reward: '15% off + free water bottle' },
        tier3: { threshold: 1000, reward: '25% off + exclusive merchandise' }
      },
      discounts: {
        permanent: 5,
        seasonal: [
          { start: new Date('2024-06-01'), end: new Date('2024-06-30'), discount: 20 }
        ]
      }
    },
    {
      id: 'nike',
      name: 'Nike',
      logo: '👟',
      color: '#FF5722',
      territories: ['territory-3', 'territory-8', 'territory-15'],
      challenges: [],
      rewards: {
        tier1: { threshold: 150, reward: 'Nike+ membership' },
        tier2: { threshold: 750, reward: '20% off Nike shoes' },
        tier3: { threshold: 1500, reward: 'Custom Nike ID shoes' }
      },
      discounts: {
        permanent: 10,
        seasonal: []
      }
    },
    {
      id: 'adidas',
      name: 'Adidas',
      logo: '🔥',
      color: '#000000',
      territories: ['territory-4', 'territory-9', 'territory-18'],
      challenges: [],
      rewards: {
        tier1: { threshold: 120, reward: 'Adidas Runners membership' },
        tier2: { threshold: 600, reward: '18% off athletic wear' },
        tier3: { threshold: 1200, reward: 'Limited edition Ultraboost' }
      },
      discounts: {
        permanent: 8,
        seasonal: [
          { start: new Date('2024-07-01'), end: new Date('2024-07-31'), discount: 25 }
        ]
      }
    }
  ];

  const getUserBrandPoints = (brandId: string) => {
    return playerStats.currencies.brandPoints[brandId] || 0;
  };

  const getBrandTier = (brandId: string) => {
    const points = getUserBrandPoints(brandId);
    const partnership = brandPartnerships.find(p => p.id === brandId);
    if (!partnership) return 0;

    if (points >= partnership.rewards.tier3.threshold) return 3;
    if (points >= partnership.rewards.tier2.threshold) return 2;
    if (points >= partnership.rewards.tier1.threshold) return 1;
    return 0;
  };

  const getNextTierProgress = (brandId: string) => {
    const points = getUserBrandPoints(brandId);
    const partnership = brandPartnerships.find(p => p.id === brandId);
    if (!partnership) return { current: 0, next: 0, progress: 0 };

    const tier = getBrandTier(brandId);
    let nextThreshold: number;

    switch (tier) {
      case 0: nextThreshold = partnership.rewards.tier1.threshold; break;
      case 1: nextThreshold = partnership.rewards.tier2.threshold; break;
      case 2: nextThreshold = partnership.rewards.tier3.threshold; break;
      default: return { current: points, next: partnership.rewards.tier3.threshold, progress: 100 };
    }

    const prevThreshold = tier === 0 ? 0 :
                         tier === 1 ? partnership.rewards.tier1.threshold :
                         partnership.rewards.tier2.threshold;

    const progress = ((points - prevThreshold) / (nextThreshold - prevThreshold)) * 100;

    return { current: points, next: nextThreshold, progress: Math.min(progress, 100) };
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(20px)' }}
      onClick={onClose}
    >
      <div
        className="glass-card rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-light)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: 'var(--border-light)' }}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-h2 font-bold" style={{ color: 'var(--text-primary)' }}>
                Brand Partnerships
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Earn points with partner brands and unlock exclusive rewards
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

        <div className="flex h-full">
          {/* Brand List */}
          <div className="w-1/3 p-6 border-r" style={{ borderColor: 'var(--border-light)' }}>
            <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Partner Brands
            </h3>
            <div className="space-y-3">
              {brandPartnerships.map((brand) => {
                const tier = getBrandTier(brand.id);
                const points = getUserBrandPoints(brand.id);

                return (
                  <div
                    key={brand.id}
                    className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 ${
                      selectedBrand === brand.id ? 'scale-105' : 'hover:scale-102'
                    }`}
                    style={{
                      background: selectedBrand === brand.id
                        ? `${brand.color}15`
                        : 'rgba(255, 255, 255, 0.05)',
                      border: selectedBrand === brand.id
                        ? `2px solid ${brand.color}`
                        : '2px solid rgba(255, 255, 255, 0.1)'
                    }}
                    onClick={() => setSelectedBrand(brand.id)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                        style={{ background: brand.color }}
                      >
                        {brand.logo}
                      </div>
                      <div>
                        <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {brand.name}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {points} points
                        </div>
                      </div>
                    </div>

                    {/* Tier Status */}
                    <div className="flex items-center gap-2">
                      {[1, 2, 3].map((tierNum) => (
                        <div
                          key={tierNum}
                          className="w-3 h-3 rounded-full"
                          style={{
                            background: tier >= tierNum ? brand.color : 'rgba(255, 255, 255, 0.2)'
                          }}
                        />
                      ))}
                      <span className="text-xs ml-1" style={{ color: 'var(--text-secondary)' }}>
                        Tier {tier}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Brand Details */}
          <div className="flex-1 p-6">
            {selectedBrand ? (
              <BrandDetails
                brand={brandPartnerships.find(b => b.id === selectedBrand)!}
                userPoints={getUserBrandPoints(selectedBrand)}
                userTier={getBrandTier(selectedBrand)}
                progress={getNextTierProgress(selectedBrand)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <div className="text-4xl mb-4">🤝</div>
                  <h3 className="text-h3 font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Select a Brand
                  </h3>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Choose a partner brand to view rewards and progress
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface BrandDetailsProps {
  brand: BrandPartnership;
  userPoints: number;
  userTier: number;
  progress: { current: number; next: number; progress: number };
}

const BrandDetails: React.FC<BrandDetailsProps> = ({ brand, userPoints, userTier, progress }) => {
  const currentSeason = brand.discounts.seasonal.find(season => {
    const now = new Date();
    return now >= season.start && now <= season.end;
  });

  return (
    <div>
      {/* Brand Header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
          style={{ background: brand.color }}
        >
          {brand.logo}
        </div>
        <div>
          <h3 className="text-h3 font-bold" style={{ color: 'var(--text-primary)' }}>
            {brand.name}
          </h3>
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--text-secondary)' }}>Tier {userTier}</span>
            <div className="flex gap-1">
              {[1, 2, 3].map((tier) => (
                <div
                  key={tier}
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: userTier >= tier ? brand.color : 'rgba(255, 255, 255, 0.2)'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Current Discounts */}
      <div className="mb-6">
        <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          Available Discounts
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            className="p-3 rounded-2xl"
            style={{ background: `${brand.color}10`, border: `1px solid ${brand.color}30` }}
          >
            <div className="flex justify-between items-center">
              <span style={{ color: 'var(--text-primary)' }}>Permanent Discount</span>
              <span className="font-bold" style={{ color: brand.color }}>
                {brand.discounts.permanent}%
              </span>
            </div>
          </div>

          {currentSeason && (
            <div
              className="p-3 rounded-2xl animate-pulse"
              style={{ background: 'rgba(255, 71, 71, 0.1)', border: '1px solid var(--accent-primary)' }}
            >
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-primary)' }}>Seasonal Special</span>
                <span className="font-bold" style={{ color: 'var(--accent-primary)' }}>
                  {currentSeason.discount}%
                </span>
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Until {currentSeason.end.toLocaleDateString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress to Next Tier */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Progress to Next Tier
          </h4>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {progress.current} / {progress.next}
          </span>
        </div>
        <div
          className="w-full h-3 rounded-full overflow-hidden"
          style={{ background: 'rgba(255, 255, 255, 0.1)' }}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${progress.progress}%`,
              background: brand.color,
              boxShadow: `0 0 10px ${brand.color}60`
            }}
          />
        </div>
      </div>

      {/* Tier Rewards */}
      <div className="mb-6">
        <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          Tier Rewards
        </h4>
        <div className="space-y-3">
          {Object.entries(brand.rewards).map(([tierKey, reward], index) => {
            const tierNum = index + 1;
            const isUnlocked = userTier >= tierNum;
            const isCurrent = userTier === tierNum - 1 && userTier < 3;

            return (
              <div
                key={tierKey}
                className={`p-4 rounded-2xl border transition-all duration-300 ${
                  isUnlocked ? 'opacity-100' : 'opacity-60'
                } ${isCurrent ? 'animate-pulse' : ''}`}
                style={{
                  background: isUnlocked
                    ? `${brand.color}15`
                    : 'rgba(255, 255, 255, 0.05)',
                  borderColor: isUnlocked
                    ? brand.color
                    : 'rgba(255, 255, 255, 0.1)'
                }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Tier {tierNum}
                      </span>
                      {isUnlocked && (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                          style={{ background: brand.color, color: '#000000' }}
                        >
                          ✓
                        </div>
                      )}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {reward.threshold} points required
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold" style={{ color: isUnlocked ? brand.color : 'var(--text-secondary)' }}>
                      {reward.reward}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Brand Territories */}
      <div>
        <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          Brand Territories
        </h4>
        <div className="grid grid-cols-3 gap-3">
          {brand.territories.map((territoryId) => (
            <div
              key={territoryId}
              className="p-3 rounded-2xl text-center"
              style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
            >
              <div className="text-lg mb-1">{brand.logo}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {territoryId}
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
          Earn bonus brand points when running in these territories
        </div>
      </div>
    </div>
  );
};

interface BrandTerritoryIndicatorProps {
  brandId?: string;
  className?: string;
}

export const BrandTerritoryIndicator: React.FC<BrandTerritoryIndicatorProps> = ({ brandId, className = '' }) => {
  if (!brandId) return null;

  const getBrandInfo = (id: string) => {
    const brands: { [key: string]: { name: string; color: string; logo: string } } = {
      'decathlon': { name: 'Decathlon', color: '#0082C3', logo: '🏃‍♂️' },
      'nike': { name: 'Nike', color: '#FF5722', logo: '👟' },
      'adidas': { name: 'Adidas', color: '#000000', logo: '🔥' }
    };
    return brands[id];
  };

  const brand = getBrandInfo(brandId);
  if (!brand) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-semibold ${className}`}
      style={{
        background: `${brand.color}20`,
        color: brand.color,
        border: `1px solid ${brand.color}40`
      }}
    >
      <span>{brand.logo}</span>
      <span>{brand.name}</span>
      <span className="text-xs opacity-75">+2x points</span>
    </div>
  );
};