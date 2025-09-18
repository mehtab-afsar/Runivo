import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/cards/MetricCard';
import { mockLeaderboard } from '@/data/mockData';

interface LeaderboardEntry {
  id: string;
  name: string;
  avatar?: string;
  territories: number;
  totalArea: number;
  totalDistance: number;
  weeklyRuns: number;
  lastActive: Date;
  trend: 'up' | 'down' | 'stable';
  rank: number;
}

interface ActivityFeedItem {
  id: string;
  userId: string;
  userName: string;
  type: 'territory_claimed' | 'territory_lost' | 'run_completed' | 'achievement_unlocked' | 'challenge_won';
  message: string;
  timestamp: Date;
  details?: any;
}

export const Leaderboards: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'leaderboards' | 'live-feed' | 'challenges' | 'events'>('leaderboards');
  const [timeFilter, setTimeFilter] = useState<'weekly' | 'monthly' | 'all-time'>('weekly');
  const [categoryFilter, setCategoryFilter] = useState<'territories' | 'distance' | 'defense' | 'streak'>('territories');

  // Extended leaderboard data
  const leaderboardData: LeaderboardEntry[] = useMemo(() => [
    {
      id: 'rival-1',
      name: 'SpeedRunner',
      territories: 67,
      totalArea: 345000,
      totalDistance: 245.8,
      weeklyRuns: 8,
      lastActive: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
      trend: 'up',
      rank: 1,
    },
    {
      id: 'rival-2',
      name: 'TerritoryKing',
      territories: 52,
      totalArea: 289000,
      totalDistance: 198.4,
      weeklyRuns: 6,
      lastActive: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      trend: 'down',
      rank: 2,
    },
    {
      id: 'current-user',
      name: 'You',
      territories: 45,
      totalArea: 234000,
      totalDistance: 127.5,
      weeklyRuns: 4,
      lastActive: new Date(),
      trend: 'up',
      rank: 3,
    },
    {
      id: 'rival-3',
      name: 'FastFeet',
      territories: 38,
      totalArea: 198000,
      totalDistance: 156.2,
      weeklyRuns: 5,
      lastActive: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
      trend: 'stable',
      rank: 4,
    },
    {
      id: 'rival-4',
      name: 'RunnerX',
      territories: 31,
      totalArea: 167000,
      totalDistance: 142.8,
      weeklyRuns: 3,
      lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      trend: 'down',
      rank: 5,
    },
  ], []);

  // Mock activity feed
  const activityFeed: ActivityFeedItem[] = useMemo(() => [
    {
      id: '1',
      userId: 'rival-1',
      userName: 'SpeedRunner',
      type: 'territory_claimed',
      message: 'claimed 3 territories in Eastern District',
      timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 min ago
      details: { territories: 3, area: 'Eastern District' },
    },
    {
      id: '2',
      userId: 'rival-2',
      userName: 'TerritoryKing',
      type: 'run_completed',
      message: 'completed a 5.2km run and claimed 2 territories',
      timestamp: new Date(Date.now() - 1000 * 60 * 45), // 45 min ago
      details: { distance: 5.2, territories: 2 },
    },
    {
      id: '3',
      userId: 'rival-3',
      userName: 'FastFeet',
      type: 'achievement_unlocked',
      message: 'unlocked "Speed Demon" achievement',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      details: { achievement: 'Speed Demon' },
    },
    {
      id: '4',
      userId: 'current-user',
      userName: 'You',
      type: 'territory_claimed',
      message: 'claimed River District territory',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
      details: { territories: 1, area: 'River District' },
    },
    {
      id: '5',
      userId: 'rival-4',
      userName: 'RunnerX',
      type: 'challenge_won',
      message: 'won the "Weekly Distance" challenge',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8), // 8 hours ago
      details: { challenge: 'Weekly Distance' },
    },
  ], []);

  const sortedLeaderboard = useMemo(() => {
    return [...leaderboardData].sort((a, b) => {
      switch (categoryFilter) {
        case 'distance': return b.totalDistance - a.totalDistance;
        case 'area': return b.totalArea - a.totalArea;
        default: return b.territories - a.territories;
      }
    });
  }, [leaderboardData, categoryFilter]);

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➖';
    }
  };

  const getActivityIcon = (type: ActivityFeedItem['type']) => {
    switch (type) {
      case 'territory_claimed': return '🎯';
      case 'territory_lost': return '💔';
      case 'run_completed': return '🏃‍♂️';
      case 'achievement_unlocked': return '🏆';
      case 'challenge_won': return '👑';
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="container mx-auto px-5 py-16 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-h1">Competition Center</h1>
        <p className="text-body text-stealth-gray">Track your performance against other runners</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-stealth-card rounded-full p-1">
        {[
          { key: 'leaderboard', label: 'Leaderboard' },
          { key: 'activity', label: 'Activity Feed' },
          { key: 'stats', label: 'Statistics' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-stealth-lime text-stealth-black'
                : 'text-stealth-gray hover:text-stealth-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto">
            {[
              { key: 'territories', label: 'Territories' },
              { key: 'distance', label: 'Distance' },
              { key: 'area', label: 'Total Area' },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setCategoryFilter(filter.key as any)}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                  categoryFilter === filter.key
                    ? 'bg-stealth-lime text-stealth-black'
                    : 'bg-stealth-card text-stealth-gray border border-stealth-border'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Leaderboard List */}
          <div className="space-y-2">
            {sortedLeaderboard.map((entry, index) => (
              <Card
                key={entry.id}
                className={`${
                  entry.id === 'current-user' ? 'border-stealth-lime bg-stealth-lime/5' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="text-2xl min-w-[40px]">
                      {getRankBadge(index + 1)}
                    </div>

                    {/* Player Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="text-body-lg font-medium">{entry.name}</div>
                        {entry.id === 'current-user' && (
                          <div className="text-xs bg-stealth-lime text-stealth-black px-2 py-1 rounded-full">
                            YOU
                          </div>
                        )}
                        <div className="text-sm">{getTrendIcon(entry.trend)}</div>
                      </div>
                      <div className="text-caption text-stealth-gray">
                        Last active: {formatTime(entry.lastActive)}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right">
                      <div className="text-metric text-stealth-lime">
                        {categoryFilter === 'territories' && entry.territories}
                        {categoryFilter === 'distance' && `${entry.totalDistance.toFixed(1)}km`}
                        {categoryFilter === 'area' && `${Math.round(entry.totalArea / 1000)}k m²`}
                      </div>
                      <div className="text-caption text-stealth-gray">
                        {entry.weeklyRuns} runs this week
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Activity Feed Tab */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          {activityFeed.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-xl">{getActivityIcon(item.type)}</div>
                  <div className="flex-1">
                    <div className="text-body">
                      <span className={`font-medium ${
                        item.userId === 'current-user' ? 'text-stealth-lime' : ''
                      }`}>
                        {item.userName}
                      </span>{' '}
                      {item.message}
                    </div>
                    <div className="text-caption text-stealth-gray">
                      {formatTime(item.timestamp)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="text-center">
            <Button variant="secondary">Load More Activities</Button>
          </div>
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="stats-grid">
                <MetricCard
                  value={3}
                  unit=""
                  label="Rank"
                  color="accent"
                />
                <MetricCard
                  value="↗️ +2"
                  unit=""
                  label="This Week"
                  color="success"
                />
                <MetricCard
                  value={45}
                  unit=""
                  label="Territories"
                />
                <MetricCard
                  value="234k"
                  unit="m²"
                  label="Total Area"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Competition Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-stealth-surface rounded-xl p-4">
                <div className="text-body-lg font-medium mb-2">📊 Performance Gap</div>
                <div className="text-body text-stealth-gray">
                  You need 22 more territories to reach #1 position
                </div>
              </div>

              <div className="bg-stealth-surface rounded-xl p-4">
                <div className="text-body-lg font-medium mb-2">🎯 Weekly Target</div>
                <div className="text-body text-stealth-gray">
                  Claim 8 territories this week to maintain your position
                </div>
              </div>

              <div className="bg-stealth-surface rounded-xl p-4">
                <div className="text-body-lg font-medium mb-2">⚡ Opportunities</div>
                <div className="text-body text-stealth-gray">
                  3 rivals haven't been active in 24+ hours - prime time for expansion
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => navigate('/active-run')}
            >
              🏃‍♂️ Start Competitive Run
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => navigate('/dashboard')}
            >
              ← Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};