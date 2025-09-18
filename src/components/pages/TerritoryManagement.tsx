import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/cards/MetricCard';
import { generateMockTerritories, mockTerritoryStats, formatTime } from '@/data/mockData';
import type { Territory } from '@/types';

interface TerritoryWithStats extends Territory {
  defenseStrength: number;
  dailyReward: number;
  timeHeld: number; // in hours
  lastDefended: Date | null;
  threatLevel: 'low' | 'medium' | 'high';
}

export const TerritoryManagement: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'territories' | 'strategy' | 'market'>('overview');
  const [filterStatus, setFilterStatus] = useState<'all' | 'owned' | 'threatened' | 'newly-acquired'>('all');

  const territoriesWithStats: TerritoryWithStats[] = useMemo(() => {
    const territories = generateMockTerritories(50);
    return territories.map(territory => ({
      ...territory,
      defenseStrength: Math.floor(Math.random() * 100) + 1,
      dailyReward: Math.floor(Math.random() * 50) + 10,
      timeHeld: Math.floor(Math.random() * 168), // up to 1 week
      lastDefended: territory.status === 'owned' && Math.random() > 0.3
        ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
        : null,
      threatLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high'
    }));
  }, []);

  const ownedTerritories = territoriesWithStats.filter(t => t.status === 'owned');
  const threatenedTerritories = ownedTerritories.filter(t => t.threatLevel === 'high');
  const newlyAcquired = ownedTerritories.filter(t => t.timeHeld < 24);

  const filteredTerritories = useMemo(() => {
    switch (filterStatus) {
      case 'owned': return ownedTerritories;
      case 'threatened': return threatenedTerritories;
      case 'newly-acquired': return newlyAcquired;
      default: return territoriesWithStats;
    }
  }, [territoriesWithStats, ownedTerritories, threatenedTerritories, newlyAcquired, filterStatus]);

  const totalDailyRewards = ownedTerritories.reduce((sum, t) => sum + t.dailyReward, 0);
  const averageDefenseStrength = ownedTerritories.length > 0
    ? Math.round(ownedTerritories.reduce((sum, t) => sum + t.defenseStrength, 0) / ownedTerritories.length)
    : 0;

  const getThreatColor = (threat: 'low' | 'medium' | 'high') => {
    switch (threat) {
      case 'low': return 'text-stealth-success bg-stealth-success/10 border-stealth-success/30';
      case 'medium': return 'text-stealth-warning bg-stealth-warning/10 border-stealth-warning/30';
      case 'high': return 'text-stealth-error bg-stealth-error/10 border-stealth-error/30';
    }
  };

  const getDefenseStrengthColor = (strength: number) => {
    if (strength >= 75) return 'text-stealth-success';
    if (strength >= 50) return 'text-stealth-warning';
    return 'text-stealth-error';
  };

  const formatTimeHeld = (hours: number) => {
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stealth-black via-stealth-surface to-stealth-black">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start pt-8">
          <div>
            <h1 className="text-h1 font-bold bg-gradient-to-r from-stealth-white to-stealth-lime bg-clip-text text-transparent">
              Territory Command
            </h1>
            <p className="text-body-lg text-stealth-gray font-medium mt-2">
              Manage your empire and plan strategic moves
            </p>
          </div>
          <button
            onClick={() => navigate('/home')}
            className="w-10 h-10 bg-stealth-card/50 border border-stealth-border/30 rounded-2xl flex items-center justify-center text-stealth-gray hover:text-stealth-white transition-colors duration-300"
          >
            ←
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-stealth-card rounded-2xl p-1 overflow-x-auto border border-stealth-border/30">
          {[
            { key: 'overview', label: 'Overview', icon: '📊' },
            { key: 'territories', label: 'My Territories', icon: '🏰' },
            { key: 'strategy', label: 'Strategy', icon: '⚡' },
            { key: 'market', label: 'Market', icon: '💰' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                activeTab === tab.key
                  ? 'bg-stealth-lime text-stealth-black shadow-lg'
                  : 'text-stealth-gray hover:text-stealth-white hover:bg-stealth-surface/30'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Empire Stats */}
            <div className="bg-gradient-to-r from-stealth-card to-stealth-surface rounded-3xl p-6 border border-stealth-border/30 backdrop-blur-sm">
              <h2 className="text-h3 font-bold text-stealth-white mb-6">Empire Statistics</h2>
              <div className="stats-grid">
                <MetricCard
                  value={mockTerritoryStats.owned}
                  unit=""
                  label="Territories Controlled"
                  color="accent"
                />
                <MetricCard
                  value={totalDailyRewards}
                  unit="XP/day"
                  label="Daily Rewards"
                  color="success"
                />
                <MetricCard
                  value={averageDefenseStrength}
                  unit="%"
                  label="Avg Defense"
                  color={averageDefenseStrength >= 75 ? "success" : "error"}
                />
                <MetricCard
                  value={threatenedTerritories.length}
                  unit=""
                  label="Under Threat"
                  color="error"
                />
              </div>
            </div>

            {/* Alert Dashboard */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Threat Alerts */}
              <div className="bg-gradient-to-r from-stealth-card/80 to-stealth-surface/60 border border-stealth-border/30 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🚨</span>
                  <h3 className="text-h3 font-bold text-stealth-white">Threat Alerts</h3>
                </div>
                <div className="space-y-3">
                  {threatenedTerritories.slice(0, 3).map((territory) => (
                    <div key={territory.id} className="flex justify-between items-center p-3 bg-stealth-error/10 border border-stealth-error/30 rounded-xl">
                      <div>
                        <div className="text-body font-semibold text-stealth-white">Territory #{territory.id}</div>
                        <div className="text-caption text-stealth-error">High threat • Needs defense</div>
                      </div>
                      <Button size="sm" variant="destructive">
                        Defend
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily Rewards */}
              <div className="bg-gradient-to-r from-stealth-card/80 to-stealth-surface/60 border border-stealth-border/30 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">💎</span>
                  <h3 className="text-h3 font-bold text-stealth-white">Today's Rewards</h3>
                </div>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-metric text-stealth-lime font-extrabold">{totalDailyRewards}</div>
                    <div className="text-caption text-stealth-gray font-semibold">XP Available</div>
                  </div>
                  <div className="w-full bg-stealth-border rounded-full h-2">
                    <div className="w-3/4 h-full bg-gradient-to-r from-stealth-lime to-stealth-lime-hover rounded-full"></div>
                  </div>
                  <Button className="w-full">
                    Collect Rewards
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* My Territories Tab */}
        {activeTab === 'territories' && (
          <div className="space-y-6">
            {/* Territory Filters */}
            <div className="flex gap-2 overflow-x-auto">
              {[
                { key: 'all', label: 'All Territories', count: territoriesWithStats.length },
                { key: 'owned', label: 'Owned', count: ownedTerritories.length },
                { key: 'threatened', label: 'Threatened', count: threatenedTerritories.length },
                { key: 'newly-acquired', label: 'New', count: newlyAcquired.length },
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setFilterStatus(filter.key as any)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                    filterStatus === filter.key
                      ? 'bg-stealth-lime text-stealth-black'
                      : 'bg-stealth-card text-stealth-gray border border-stealth-border/30 hover:text-stealth-white'
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>

            {/* Territory Grid */}
            <div className="grid gap-4">
              {filteredTerritories.slice(0, 10).map((territory) => (
                <div
                  key={territory.id}
                  className="bg-gradient-to-r from-stealth-card/80 to-stealth-surface/60 border border-stealth-border/30 rounded-2xl p-5 backdrop-blur-sm hover:border-stealth-lime/30 transition-all duration-300 group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-body-lg font-bold text-stealth-white">
                        Territory #{territory.id}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-caption text-stealth-gray">
                          {(territory.areaSquareMeters / 1000).toFixed(1)}k m²
                        </span>
                        <div className={`px-2 py-1 rounded-full text-xs font-bold border ${getThreatColor(territory.threatLevel)}`}>
                          {territory.threatLevel.toUpperCase()} THREAT
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-body font-bold ${getDefenseStrengthColor(territory.defenseStrength)}`}>
                        {territory.defenseStrength}%
                      </div>
                      <div className="text-caption text-stealth-gray">defense</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-metric text-stealth-lime">{territory.dailyReward}</div>
                      <div className="text-caption text-stealth-gray font-semibold">XP/day</div>
                    </div>
                    <div className="text-center">
                      <div className="text-metric text-stealth-white">{formatTimeHeld(territory.timeHeld)}</div>
                      <div className="text-caption text-stealth-gray font-semibold">held</div>
                    </div>
                    <div className="text-center">
                      <div className="text-metric text-stealth-warning">
                        {territory.lastDefended ? '2h' : 'Never'}
                      </div>
                      <div className="text-caption text-stealth-gray font-semibold">last defense</div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button size="sm" variant="secondary" className="flex-1">
                      <span className="mr-2">🛡️</span>
                      Fortify
                    </Button>
                    <Button size="sm" variant="secondary">
                      <span className="mr-2">👁️</span>
                      View
                    </Button>
                    <Button size="sm" variant="outline">
                      <span className="mr-2">❌</span>
                      Abandon
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strategy Tab */}
        {activeTab === 'strategy' && (
          <div className="space-y-6">
            {/* Attack Planner */}
            <div className="bg-gradient-to-r from-stealth-card to-stealth-surface rounded-3xl p-6 border border-stealth-border/30 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">⚔️</span>
                <h2 className="text-h3 font-bold text-stealth-white">Attack Planner</h2>
              </div>
              <div className="grid gap-4">
                {[
                  { name: 'Central Park East', distance: '2.3km', difficulty: 'Medium', reward: '120 XP', owner: 'SpeedRunner' },
                  { name: 'Business District', distance: '3.1km', difficulty: 'Hard', reward: '200 XP', owner: 'TerritoryKing' },
                  { name: 'Riverside Path', distance: '1.8km', difficulty: 'Easy', reward: '80 XP', owner: 'FastFeet' },
                ].map((target, index) => (
                  <div key={index} className="flex justify-between items-center p-4 bg-stealth-surface/50 rounded-xl border border-stealth-border/20">
                    <div>
                      <div className="text-body-lg font-semibold text-stealth-white">{target.name}</div>
                      <div className="text-caption text-stealth-gray">Owned by {target.owner}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-sm font-bold text-stealth-white">{target.distance}</div>
                        <div className="text-xs text-stealth-gray">distance</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-sm font-bold ${target.difficulty === 'Easy' ? 'text-stealth-success' : target.difficulty === 'Medium' ? 'text-stealth-warning' : 'text-stealth-error'}`}>
                          {target.difficulty}
                        </div>
                        <div className="text-xs text-stealth-gray">difficulty</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-stealth-lime">{target.reward}</div>
                        <div className="text-xs text-stealth-gray">reward</div>
                      </div>
                      <Button size="sm">
                        Plan Attack
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Defense Routes */}
            <div className="bg-gradient-to-r from-stealth-card to-stealth-surface rounded-3xl p-6 border border-stealth-border/30 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">🛡️</span>
                <h2 className="text-h3 font-bold text-stealth-white">Defense Routes</h2>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-stealth-warning/10 border border-stealth-warning/30 rounded-xl">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-body-lg font-semibold text-stealth-white">Eastern Border Patrol</div>
                      <div className="text-caption text-stealth-gray">Covers 5 threatened territories</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-sm font-bold text-stealth-white">4.2km</div>
                        <div className="text-xs text-stealth-gray">distance</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold text-stealth-warning">25 min</div>
                        <div className="text-xs text-stealth-gray">estimated</div>
                      </div>
                      <Button size="sm" className="btn-secondary-stealth">
                        Start Patrol
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Market Tab */}
        {activeTab === 'market' && (
          <div className="space-y-6">
            <div className="text-center py-12">
              <span className="text-6xl mb-4 block">🏗️</span>
              <h2 className="text-h2 font-bold text-stealth-white mb-2">Coming Soon</h2>
              <p className="text-body text-stealth-gray">Territory trading and marketplace features</p>
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex gap-4 pb-24">
          <Button
            onClick={() => navigate('/run')}
            className="flex-1 btn-primary-stealth"
          >
            <span className="mr-2">🎯</span>
            Plan Territory Run
          </Button>
          <Button
            onClick={() => navigate('/home')}
            variant="secondary"
            className="px-8"
          >
            View Map
          </Button>
        </div>
      </div>
    </div>
  );
};