import { useState, useEffect, useCallback } from 'react';
import { PlayerStats, Territory, GameAction, Challenge, Achievement } from '@/types/game';

// Mock initial game state
const mockPlayerStats: PlayerStats = {
  id: 'player-1',
  level: 23,
  xp: 4750,
  xpToNext: 1250,
  currencies: {
    coins: 1250,
    gems: 45,
    brandPoints: {
      decathlon: 120,
      nike: 85,
      adidas: 65
    }
  },
  energy: {
    current: 85,
    max: 100,
    lastRegen: new Date(),
    regenRate: 1 // per 5 minutes
  },
  territories: {
    owned: 23,
    defended: 142,
    attacked: 89,
    dailyIncome: 230
  },
  subscription: {
    tier: 'free',
    benefits: []
  },
  achievements: ['first-run', 'explorer', 'territory-king', '7-day-streak'],
  dailyStreak: 12,
  lastActive: new Date()
};

export const useGameState = () => {
  const [playerStats, setPlayerStats] = useState<PlayerStats>(mockPlayerStats);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<Challenge[]>([]);
  const [activeActions, setActiveActions] = useState<GameAction[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Energy regeneration system
  useEffect(() => {
    const energyInterval = setInterval(() => {
      setPlayerStats(prev => {
        if (prev.energy.current < prev.energy.max) {
          const now = new Date();
          const timeDiff = now.getTime() - prev.energy.lastRegen.getTime();
          const minutesPassed = Math.floor(timeDiff / (1000 * 60));

          if (minutesPassed >= 5) {
            const energyToAdd = Math.floor(minutesPassed / 5) * prev.energy.regenRate;
            const newEnergy = Math.min(prev.energy.current + energyToAdd, prev.energy.max);

            return {
              ...prev,
              energy: {
                ...prev.energy,
                current: newEnergy,
                lastRegen: now
              }
            };
          }
        }
        return prev;
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(energyInterval);
  }, []);

  // Daily income collection
  useEffect(() => {
    const now = new Date();
    const lastActive = new Date(playerStats.lastActive);
    const daysPassed = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

    if (daysPassed > 0) {
      const income = playerStats.territories.dailyIncome * daysPassed;
      setPlayerStats(prev => ({
        ...prev,
        currencies: {
          ...prev.currencies,
          coins: prev.currencies.coins + income
        },
        lastActive: now
      }));
    }
  }, []);

  const calculateTerritoryRequirements = useCallback((territory: Territory) => {
    const baseDistance = 1.0; // km
    const defenseMultiplier = territory.defenseStrength / 100;

    return {
      distance: baseDistance * (1 + defenseMultiplier),
      energyCost: Math.ceil(10 * (1 + defenseMultiplier)),
      minPace: territory.defenseStrength > 66 ? '6:30' : territory.defenseStrength > 33 ? '8:00' : undefined
    };
  }, []);

  const canPerformAction = useCallback((action: GameAction) => {
    const hasEnergy = playerStats.energy.current >= action.requirements.energyCost;
    const isPremium = playerStats.subscription.tier !== 'free';

    return hasEnergy || isPremium;
  }, [playerStats.energy.current, playerStats.subscription.tier]);

  const startTerritoryAction = useCallback(async (
    actionType: 'claim' | 'attack' | 'defend' | 'fortify',
    territoryId: string
  ) => {
    const territory = territories.find(t => t.id === territoryId);
    if (!territory) return false;

    const requirements = calculateTerritoryRequirements(territory);

    const action: GameAction = {
      id: `action-${Date.now()}`,
      type: actionType,
      playerId: playerStats.id,
      territoryId,
      requirements,
      rewards: {
        xp: actionType === 'claim' ? 50 : actionType === 'attack' ? 75 : 25,
        coins: actionType === 'claim' ? 25 : actionType === 'attack' ? 40 : 15,
        gems: actionType === 'attack' ? 5 : undefined
      },
      startTime: new Date(),
      duration: Math.ceil(requirements.distance * 6), // 6 minutes per km
      status: 'pending'
    };

    if (!canPerformAction(action)) {
      return false;
    }

    // Deduct energy (unless premium)
    if (playerStats.subscription.tier === 'free') {
      setPlayerStats(prev => ({
        ...prev,
        energy: {
          ...prev.energy,
          current: prev.energy.current - requirements.energyCost
        }
      }));
    }

    setActiveActions(prev => [...prev, action]);
    return true;
  }, [territories, playerStats, calculateTerritoryRequirements, canPerformAction]);

  const completeAction = useCallback((actionId: string, success: boolean) => {
    setActiveActions(prev => {
      const action = prev.find(a => a.id === actionId);
      if (!action) return prev;

      if (success) {
        // Award rewards
        setPlayerStats(prevStats => ({
          ...prevStats,
          xp: prevStats.xp + action.rewards.xp,
          currencies: {
            ...prevStats.currencies,
            coins: prevStats.currencies.coins + action.rewards.coins,
            gems: prevStats.currencies.gems + (action.rewards.gems || 0)
          }
        }));

        // Update territory if claiming/attacking
        if (action.type === 'claim' || action.type === 'attack') {
          setTerritories(prevTerritories =>
            prevTerritories.map(t =>
              t.id === action.territoryId
                ? {
                    ...t,
                    state: 'owned',
                    owner: {
                      id: playerStats.id,
                      name: 'You',
                      level: playerStats.level,
                      avatar: '👤'
                    },
                    defenseStrength: 50,
                    history: {
                      ...t.history,
                      claimedAt: new Date(),
                      attackCount: t.history.attackCount + (action.type === 'attack' ? 1 : 0)
                    }
                  }
                : t
            )
          );
        }
      }

      return prev.map(a =>
        a.id === actionId
          ? { ...a, status: success ? 'completed' : 'failed' }
          : a
      );
    });
  }, [playerStats.id, playerStats.level]);

  const purchasePremium = useCallback((tier: PlayerStats['subscription']['tier']) => {
    const benefits: { [key: string]: string[] } = {
      'runner-plus': [
        'Unlimited energy',
        'No ads',
        '2x daily coins',
        'Advanced analytics',
        'Custom colors'
      ],
      'territory-lord': [
        'AI route optimization',
        'Real-time alerts',
        'Auto-defense',
        'Exclusive territories',
        'Weekly coaching'
      ],
      'empire-builder': [
        'Create challenges',
        'Found clubs',
        'Territory naming',
        'Personal trainer AI',
        'Beta access'
      ]
    };

    setPlayerStats(prev => ({
      ...prev,
      subscription: {
        tier,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        benefits: benefits[tier] || []
      },
      energy: {
        ...prev.energy,
        max: tier !== 'free' ? 999 : 100,
        current: tier !== 'free' ? 999 : prev.energy.current
      }
    }));
  }, []);

  const collectDailyReward = useCallback(() => {
    const rewards = {
      coins: 50 + (playerStats.dailyStreak * 10),
      xp: 25 + (playerStats.dailyStreak * 5),
      gems: playerStats.dailyStreak >= 7 ? 5 : 0
    };

    setPlayerStats(prev => ({
      ...prev,
      currencies: {
        ...prev.currencies,
        coins: prev.currencies.coins + rewards.coins,
        gems: prev.currencies.gems + rewards.gems
      },
      xp: prev.xp + rewards.xp,
      dailyStreak: prev.dailyStreak + 1,
      lastActive: new Date()
    }));

    return rewards;
  }, [playerStats.dailyStreak]);

  // Initialize game data
  useEffect(() => {
    const loadGameData = async () => {
      setIsLoading(true);

      // Simulate API calls
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Load mock data
      const mockTerritories: Territory[] = Array.from({ length: 50 }, (_, i) => ({
        id: `territory-${i}`,
        hexId: `hex-${i}`,
        coordinates: {
          lat: 37.7749 + (Math.random() - 0.5) * 0.1,
          lng: -122.4194 + (Math.random() - 0.5) * 0.1,
          vertices: []
        },
        state: Math.random() > 0.7 ? 'owned' : Math.random() > 0.5 ? 'enemy' : 'unclaimed',
        defenseStrength: Math.floor(Math.random() * 100),
        dailyIncome: 10,
        claimRequirements: {
          distance: 1.0 + Math.random() * 2
        },
        history: {
          claimedAt: new Date(),
          attackCount: 0,
          defenseCount: 0
        }
      }));

      setTerritories(mockTerritories);
      setIsLoading(false);
    };

    loadGameData();
  }, []);

  return {
    // State
    playerStats,
    territories,
    activeChallenges,
    activeActions,
    achievements,
    isLoading,

    // Actions
    startTerritoryAction,
    completeAction,
    purchasePremium,
    collectDailyReward,
    canPerformAction,
    calculateTerritoryRequirements
  };
};