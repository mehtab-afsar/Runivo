import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Mock data for comprehensive compete section
const mockLeaderboard = [
  { rank: 1, name: 'MaxRunner', avatar: '🥇', territories: 847, trend: 'up' },
  { rank: 2, name: 'SpeedDemon', avatar: '🥈', territories: 792, trend: 'up' },
  { rank: 3, name: 'NightWolf', avatar: '🥉', territories: 743, trend: 'stable' },
  { rank: 4, name: 'CityKing', avatar: '👑', territories: 698, trend: 'down' },
  { rank: 5, name: 'StreetRunner', avatar: '🏃', territories: 645, trend: 'up' },
  { rank: 147, name: 'You', avatar: '📍', territories: 23, trend: 'up', isUser: true }
];

const mockLiveFeed = [
  {
    id: '1',
    type: 'territory_claimed',
    user: 'Sarah',
    action: 'claimed Central Station',
    time: 'now',
    icon: '💥'
  },
  {
    id: '2',
    type: 'defense',
    user: 'You',
    action: 'defended North Park',
    time: '2m',
    icon: '🛡️'
  },
  {
    id: '3',
    type: 'attack',
    user: 'Mike',
    action: 'attacked your East Bridge',
    time: '5m',
    icon: '⚔️'
  },
  {
    id: '4',
    type: 'kudos',
    user: 'Anna',
    action: 'gave you kudos',
    time: '8m',
    icon: '👏'
  },
  {
    id: '5',
    type: 'run_completed',
    user: 'Tom',
    action: 'completed 10K run',
    time: '12m',
    icon: '🏃'
  }
];

const mockChallenges = [
  {
    id: '1',
    title: 'Weekend Warrior',
    description: 'Claim 10 territories',
    progress: 7,
    target: 10,
    timeLeft: '2 days',
    participants: 234,
    reward: 'Warrior Badge + 100XP',
    type: 'individual'
  },
  {
    id: '2',
    title: 'City Conquest - TEAM',
    description: 'Team Red vs Team Blue',
    progress: 489,
    target: 1000,
    timeLeft: '5 days',
    participants: 1250,
    reward: 'Premium 1 week',
    type: 'team',
    teamScore: { red: 489, blue: 456 }
  },
  {
    id: '3',
    title: 'Speed Demon',
    description: 'Complete a sub-20 minute 5K',
    progress: 0,
    target: 1,
    timeLeft: '1 week',
    participants: 89,
    reward: 'Speed Badge + 50XP',
    type: 'individual'
  }
];

export const Compete: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'leaderboards' | 'live-feed' | 'challenges' | 'events'>('leaderboards');
  const [leaderboardFilter, setLeaderboardFilter] = useState<'global' | 'country' | 'city' | 'friends'>('global');
  const [timeFilter, setTimeFilter] = useState<'weekly' | 'monthly' | 'all-time'>('weekly');

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      case 'stable': return '→';
      default: return '';
    }
  };

  const getProgressColor = (progress: number, target: number) => {
    const percentage = (progress / target) * 100;
    if (percentage >= 80) return '#00D46A'; // Success green
    if (percentage >= 50) return '#FFB800'; // Warning yellow
    return '#FF4747'; // Error red
  };

  return (
    <div className="min-h-screen bg-runner-black text-runner-text">
      {/* Header */}
      <div className="safe-top pt-6 pb-4 px-6 border-b border-runner-border">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-runner-text mb-1">
            Battle Arena
          </h1>
          <p className="text-sm text-runner-text-muted">
            Compete for territorial dominance
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6 pt-4">
        <div className="flex gap-1 bg-runner-dark rounded-lg p-1 mb-6">
          {[
            { id: 'leaderboards', label: 'Rankings', icon: '🏆' },
            { id: 'live-feed', label: 'Live', icon: '⚡' },
            { id: 'challenges', label: 'Challenges', icon: '🎯' },
            { id: 'events', label: 'Events', icon: '📅' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-runner-lime text-runner-black'
                  : 'text-runner-text-muted hover:text-runner-text'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-6">
        {/* Leaderboards Tab */}
        {activeTab === 'leaderboards' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {['global', 'country', 'city', 'friends'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setLeaderboardFilter(filter as any)}
                  className={`px-4 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap ${
                    leaderboardFilter === filter
                      ? 'bg-runner-lime text-runner-black'
                      : 'bg-runner-card text-runner-text-muted hover:text-runner-text border border-runner-border'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            {/* Time Filter */}
            <div className="flex gap-2">
              {['weekly', 'monthly', 'all-time'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter as any)}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-all ${
                    timeFilter === filter
                      ? 'bg-runner-lime text-runner-black'
                      : 'bg-runner-dark text-runner-text-muted hover:text-runner-text'
                  }`}
                >
                  {filter.replace('-', ' ')}
                </button>
              ))}
            </div>

            {/* Leaderboard List */}
            <div className="space-y-3">
              {mockLeaderboard.map((entry, index) => (
                <div
                  key={entry.rank}
                  className={`bg-runner-card border rounded-lg p-4 ${
                    entry.isUser ? 'border-runner-lime bg-runner-lime/5' : 'border-runner-border hover:border-runner-border-light'
                  } transition-colors`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`text-xl font-bold min-w-[40px] text-center ${
                        entry.rank <= 3 ? 'text-runner-gold' : 'text-runner-text-muted'
                      }`}>
                        {entry.rank}
                      </div>
                      <div className="text-2xl">{entry.avatar}</div>
                      <div>
                        <div className={`font-semibold ${
                          entry.isUser ? 'text-runner-lime' : 'text-runner-text'
                        }`}>
                          {entry.name}
                        </div>
                        <div className="text-sm text-runner-text-muted">
                          {entry.territories} territories
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getTrendIcon(entry.trend)}</span>
                      {entry.isUser && (
                        <span className="text-xs px-2 py-1 rounded-full bg-runner-lime/20 text-runner-lime font-bold">
                          ↑5
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Feed Tab */}
        {activeTab === 'live-feed' && (
          <div className="space-y-3">
            {mockLiveFeed.map((item) => (
              <div
                key={item.id}
                className="bg-runner-card border border-runner-border rounded-lg p-4 hover:border-runner-border-light transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <div className="flex-1">
                    <span className="text-runner-text">
                      <span className={`font-semibold ${
                        item.user === 'You' ? 'text-runner-lime' : 'text-runner-text'
                      }`}>
                        {item.user}
                      </span>{' '}
                      {item.action}
                    </span>
                  </div>
                  <span className="text-sm text-runner-text-subtle">
                    [{item.time}]
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Challenges Tab */}
        {activeTab === 'challenges' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-4 text-runner-text">
                Active Challenges
              </h2>
              <div className="space-y-4">
                {mockChallenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className={`border rounded-lg p-6 ${
                      challenge.type === 'team'
                        ? 'bg-runner-gold/5 border-runner-gold/30'
                        : 'bg-runner-card border-runner-border'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg mb-1 text-runner-text">
                          {challenge.title}
                        </h3>
                        <p className="text-sm mb-2 text-runner-text-muted">
                          {challenge.description}
                        </p>
                        {challenge.type === 'team' && challenge.teamScore && (
                          <div className="text-sm text-runner-text-muted">
                            Team Red: {challenge.teamScore.red} vs Team Blue: {challenge.teamScore.blue}
                          </div>
                        )}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        challenge.type === 'team'
                          ? 'bg-runner-gold/20 text-runner-gold'
                          : 'bg-runner-dark text-runner-text-muted'
                      }`}>
                        {challenge.type.toUpperCase()}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-runner-text-muted">
                          Progress: {challenge.progress}/{challenge.target}
                        </span>
                        <span className="text-sm font-bold" style={{ color: getProgressColor(challenge.progress, challenge.target) }}>
                          {Math.round((challenge.progress / challenge.target) * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-runner-dark rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${Math.min((challenge.progress / challenge.target) * 100, 100)}%`,
                            background: getProgressColor(challenge.progress, challenge.target)
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <div className="text-runner-text-muted">
                        ⏰ {challenge.timeLeft} • 👥 {challenge.participants} participants
                      </div>
                      <div className="font-semibold text-runner-lime">
                        🏆 {challenge.reward}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-lg font-bold mb-2 text-runner-text">
                Coming Soon!
              </h3>
              <p className="text-runner-text-muted">
                Virtual races and local events will be available in the next update.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom padding for navigation */}
      <div className="pb-24"></div>
    </div>
  );
};