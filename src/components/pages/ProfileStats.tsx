import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/cards/MetricCard';
import { mockRunnerProfile, mockAchievements, formatTime, formatPace, formatDistance } from '@/data/mockData';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'distance' | 'territories' | 'speed' | 'consistency' | 'social' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number;
  target?: number;
  reward: {
    xp: number;
    badge?: string;
    title?: string;
  };
}

interface PersonalRecord {
  id: string;
  type: 'longest_run' | 'fastest_pace' | 'most_territories' | 'longest_streak' | 'best_week';
  title: string;
  value: number;
  unit: string;
  achievedAt: Date;
  previousRecord?: number;
}

interface WeeklyStats {
  week: string;
  totalDistance: number;
  totalRuns: number;
  territoriesClaimed: number;
  averagePace: number;
  totalTime: number;
}

export const ProfileStats: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'records' | 'history'>('overview');
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year' | 'all-time'>('month');

  const achievements: Achievement[] = useMemo(() => [
    {
      id: '1',
      title: 'First Steps',
      description: 'Complete your first run',
      icon: '👟',
      category: 'distance',
      rarity: 'common',
      unlocked: true,
      unlockedAt: new Date('2024-01-01'),
      reward: { xp: 100, badge: 'Beginner' },
    },
    {
      id: '2',
      title: 'Territory Master',
      description: 'Own 50 territories',
      icon: '👑',
      category: 'territories',
      rarity: 'rare',
      unlocked: false,
      progress: 45,
      target: 50,
      reward: { xp: 500, badge: 'Territory Master', title: 'Master' },
    },
    {
      id: '3',
      title: 'Speed Demon',
      description: 'Run at sub-4:00 pace',
      icon: '⚡',
      category: 'speed',
      rarity: 'epic',
      unlocked: false,
      progress: 4.2,
      target: 4.0,
      reward: { xp: 750, badge: 'Speed Demon' },
    },
    {
      id: '4',
      title: 'Marathon Machine',
      description: 'Complete a 42km run',
      icon: '🏃‍♂️',
      category: 'distance',
      rarity: 'legendary',
      unlocked: false,
      progress: 12.8,
      target: 42.0,
      reward: { xp: 1000, badge: 'Marathon Machine', title: 'Marathoner' },
    },
    {
      id: '5',
      title: 'Social Butterfly',
      description: 'Complete 10 community challenges',
      icon: '🦋',
      category: 'social',
      rarity: 'rare',
      unlocked: false,
      progress: 3,
      target: 10,
      reward: { xp: 400, badge: 'Social Butterfly' },
    },
    {
      id: '6',
      title: 'Consistency King',
      description: 'Run 7 days in a row',
      icon: '📅',
      category: 'consistency',
      rarity: 'rare',
      unlocked: true,
      unlockedAt: new Date('2024-01-10'),
      reward: { xp: 300, badge: 'Consistent Runner' },
    },
  ], []);

  const personalRecords: PersonalRecord[] = useMemo(() => [
    {
      id: '1',
      type: 'longest_run',
      title: 'Longest Run',
      value: 12.8,
      unit: 'km',
      achievedAt: new Date('2024-01-15'),
      previousRecord: 8.5,
    },
    {
      id: '2',
      type: 'fastest_pace',
      title: 'Fastest Pace',
      value: 4.2,
      unit: 'min/km',
      achievedAt: new Date('2024-01-12'),
      previousRecord: 4.8,
    },
    {
      id: '3',
      type: 'most_territories',
      title: 'Most Territories (Single Run)',
      value: 15,
      unit: '',
      achievedAt: new Date('2024-01-08'),
      previousRecord: 12,
    },
    {
      id: '4',
      type: 'longest_streak',
      title: 'Longest Running Streak',
      value: 7,
      unit: 'days',
      achievedAt: new Date('2024-01-10'),
    },
  ], []);

  const weeklyHistory: WeeklyStats[] = useMemo(() => [
    {
      week: 'This Week',
      totalDistance: 18.5,
      totalRuns: 4,
      territoriesClaimed: 12,
      averagePace: 5.1,
      totalTime: 5640, // 94 minutes
    },
    {
      week: 'Last Week',
      totalDistance: 22.3,
      totalRuns: 5,
      territoriesClaimed: 18,
      averagePace: 4.9,
      totalTime: 6540, // 109 minutes
    },
    {
      week: '2 Weeks Ago',
      totalDistance: 15.8,
      totalRuns: 3,
      territoriesClaimed: 9,
      averagePace: 5.3,
      totalTime: 5040, // 84 minutes
    },
    {
      week: '3 Weeks Ago',
      totalDistance: 28.1,
      totalRuns: 6,
      territoriesClaimed: 24,
      averagePace: 4.8,
      totalTime: 8100, // 135 minutes
    },
  ], []);

  const getRarityColor = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'common': return 'text-stealth-gray';
      case 'rare': return 'text-stealth-success';
      case 'epic': return 'text-stealth-warning';
      case 'legendary': return 'text-stealth-lime';
    }
  };

  const getRarityBorder = (rarity: Achievement['rarity']) => {
    switch (rarity) {
      case 'common': return 'border-stealth-gray';
      case 'rare': return 'border-stealth-success';
      case 'epic': return 'border-stealth-warning';
      case 'legendary': return 'border-stealth-lime';
    }
  };

  const unlockedAchievements = achievements.filter(a => a.unlocked);
  const inProgressAchievements = achievements.filter(a => !a.unlocked && a.progress !== undefined);

  const calculateLevel = (xp: number) => {
    return Math.floor(xp / 1000) + 1;
  };

  const totalXP = unlockedAchievements.reduce((sum, achievement) => sum + achievement.reward.xp, 0) + 2500; // Base XP
  const currentLevel = calculateLevel(totalXP);

  return (
    <div className="container mx-auto px-5 py-16 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <h1 className="text-h1">Your Profile</h1>
          <p className="text-body text-stealth-gray">Track your progress and achievements</p>
        </div>
        <div className="text-right">
          <div className="text-h2 text-stealth-lime">Level {currentLevel}</div>
          <div className="text-caption text-stealth-gray">{totalXP} XP</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-stealth-card rounded-full p-1 overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'achievements', label: 'Achievements' },
          { key: 'records', label: 'Records' },
          { key: 'history', label: 'History' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-stealth-lime text-stealth-black'
                : 'text-stealth-gray hover:text-stealth-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Current Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="stats-grid">
                <MetricCard
                  value={mockRunnerProfile.totalDistance.toFixed(1)}
                  unit="km"
                  label="Total Distance"
                />
                <MetricCard
                  value={mockRunnerProfile.totalTerritories}
                  unit=""
                  label="Territories Owned"
                  color="accent"
                />
                <MetricCard
                  value={formatPace(mockRunnerProfile.personalBests.fastestPace)}
                  unit="/km"
                  label="Best Pace"
                  color="success"
                />
                <MetricCard
                  value={currentLevel}
                  unit=""
                  label="Level"
                  color="accent"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Achievements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {unlockedAchievements.slice(0, 3).map((achievement) => (
                  <div key={achievement.id} className="flex items-center gap-3 p-3 bg-stealth-surface rounded-lg">
                    <div className="text-2xl">{achievement.icon}</div>
                    <div className="flex-1">
                      <div className={`text-body-lg font-medium ${getRarityColor(achievement.rarity)}`}>
                        {achievement.title}
                      </div>
                      <div className="text-caption text-stealth-gray">{achievement.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-stealth-lime">+{achievement.reward.xp} XP</div>
                      <div className="text-xs text-stealth-gray">
                        {achievement.unlockedAt?.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Progress Towards Next Goals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {inProgressAchievements.slice(0, 3).map((achievement) => (
                  <div key={achievement.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{achievement.icon}</span>
                        <span className="text-body-lg font-medium">{achievement.title}</span>
                      </div>
                      <span className={`text-sm ${getRarityColor(achievement.rarity)}`}>
                        {achievement.progress}/{achievement.target}
                      </span>
                    </div>
                    <div className="w-full bg-stealth-border rounded-full h-2">
                      <div
                        className="bg-stealth-lime h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, ((achievement.progress || 0) / (achievement.target || 1)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Achievements Tab */}
      {activeTab === 'achievements' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-body-lg">
              {unlockedAchievements.length} of {achievements.length} unlocked
            </div>
            <div className="text-caption text-stealth-gray">
              Total XP earned: {unlockedAchievements.reduce((sum, a) => sum + a.reward.xp, 0)}
            </div>
          </div>

          <div className="grid gap-4">
            {achievements.map((achievement) => (
              <Card
                key={achievement.id}
                className={`${
                  achievement.unlocked
                    ? `${getRarityBorder(achievement.rarity)} bg-gradient-to-r from-transparent to-stealth-surface/30`
                    : 'opacity-60'
                } transition-all`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{achievement.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`text-body-lg font-medium ${getRarityColor(achievement.rarity)}`}>
                          {achievement.title}
                        </div>
                        {achievement.unlocked && <div className="text-sm">✅</div>}
                      </div>
                      <div className="text-body text-stealth-gray mb-2">{achievement.description}</div>

                      {!achievement.unlocked && achievement.progress !== undefined && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{achievement.progress}/{achievement.target}</span>
                          </div>
                          <div className="w-full bg-stealth-border rounded-full h-1">
                            <div
                              className="bg-stealth-lime h-1 rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, ((achievement.progress || 0) / (achievement.target || 1)) * 100)}%`
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-end mt-2">
                        <div className="text-xs text-stealth-gray">
                          {achievement.rarity.charAt(0).toUpperCase() + achievement.rarity.slice(1)} • {achievement.category}
                        </div>
                        <div className="text-sm text-stealth-lime">
                          +{achievement.reward.xp} XP
                          {achievement.reward.badge && ` • ${achievement.reward.badge}`}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Records Tab */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {personalRecords.map((record) => (
                  <div key={record.id} className="flex justify-between items-center p-4 bg-stealth-surface rounded-lg">
                    <div>
                      <div className="text-body-lg font-medium">{record.title}</div>
                      <div className="text-caption text-stealth-gray">
                        Set on {record.achievedAt.toLocaleDateString()}
                        {record.previousRecord && ` (Previous: ${record.previousRecord}${record.unit})`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-metric text-stealth-lime">
                        {record.value}{record.unit}
                      </div>
                      {record.previousRecord && (
                        <div className="text-xs text-stealth-success">
                          +{(record.value - record.previousRecord).toFixed(1)} improvement
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All-Time Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="stats-grid">
                <MetricCard
                  value={127.5}
                  unit="km"
                  label="Total Distance"
                />
                <MetricCard
                  value={45}
                  unit=""
                  label="Total Territories"
                />
                <MetricCard
                  value={32}
                  unit=""
                  label="Total Runs"
                />
                <MetricCard
                  value={formatTime(8640)} // 2.4 hours
                  unit=""
                  label="Total Time"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Performance History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {weeklyHistory.map((week, index) => (
                  <div key={week.week} className="border-l-2 border-stealth-lime pl-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-body-lg font-medium">{week.week}</div>
                      <div className="text-sm text-stealth-gray">{week.totalRuns} runs</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-stealth-gray">Distance:</span>{' '}
                        <span className="text-stealth-white">{week.totalDistance}km</span>
                      </div>
                      <div>
                        <span className="text-stealth-gray">Territories:</span>{' '}
                        <span className="text-stealth-white">{week.territoriesClaimed}</span>
                      </div>
                      <div>
                        <span className="text-stealth-gray">Avg Pace:</span>{' '}
                        <span className="text-stealth-white">{formatPace(week.averagePace)}/km</span>
                      </div>
                      <div>
                        <span className="text-stealth-gray">Total Time:</span>{' '}
                        <span className="text-stealth-white">{formatTime(week.totalTime)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/active-run')}>
              🏃‍♂️ Start Run
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/dashboard')}>
              ← Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};