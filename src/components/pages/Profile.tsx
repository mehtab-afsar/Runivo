import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserIcon, RunningIcon, MapIcon, CrownIcon, FireIcon, TeamIcon, EnergyIcon, GlobeIcon, TrophyIcon, ClockIcon, TreeIcon, ShieldIcon, StarIcon } from '@/components/ui/icons';

// Mock user profile data
const mockProfile = {
  id: 'user-1',
  username: '@territoryking',
  displayName: 'Territory King',
  avatar: 'user',
  bio: 'Running the city, one block at a time',
  location: 'San Francisco',
  level: 23,
  title: 'Territory Baron',
  joinedDate: 'Jan 2025',
  stats: {
    territories: 23,
    totalRuns: 142,
    totalDistance: 1247, // km
    followers: 89,
    following: 124
  }
};

const mockAchievements = [
  { id: '1', title: 'First Run', icon: 'running', unlocked: true, rarity: 'common' },
  { id: '2', title: 'Explorer', icon: 'map', unlocked: true, rarity: 'rare', description: '10 new areas' },
  { id: '3', title: 'Territory King', icon: 'crown', unlocked: true, rarity: 'epic', description: '50 claims' },
  { id: '4', title: '7-Day Streak', icon: 'fire', unlocked: true, rarity: 'rare' },
  { id: '5', title: 'Social Runner', icon: 'team', unlocked: true, rarity: 'common' },
  // Progress achievements
  { id: '6', title: 'Speed Demon', icon: 'energy', unlocked: false, rarity: 'epic', progress: 65, target: 100, description: 'Run sub-20 5K' },
  { id: '7', title: 'World Traveler', icon: 'globe', unlocked: false, rarity: 'legendary', progress: 40, target: 100, description: 'Run in 10 cities' },
];

const mockPRs = [
  { distance: '1K', time: '3:42', icon: 'running' },
  { distance: '5K', time: '19:23', icon: 'running' },
  { distance: '10K', time: '41:15', icon: 'running' },
  { distance: 'Half', time: '1:32:45', icon: 'running' }
];

const mockTerritoryRecords = [
  { title: 'Most in Day', value: '8', icon: 'trophy' },
  { title: 'Longest Held', value: 'Downtown (42 days)', icon: 'clock' },
  { title: 'Biggest Conquest', value: 'Central Park', icon: 'tree' },
  { title: 'Perfect Defense Week', value: '3 times', icon: 'shield' }
];

const mockFriends = [
  { id: '1', name: 'Sarah Chen', avatar: 'user', level: 18, status: 'online', lastRun: '2h ago' },
  { id: '2', name: 'Mike Runner', avatar: 'user', level: 25, status: 'offline', lastRun: '1 day ago' },
  { id: '3', name: 'Anna Speed', avatar: 'user', level: 15, status: 'running', lastRun: 'now' }
];

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'achievements' | 'records' | 'social' | 'settings'>('profile');

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return '#A0A0A0';
      case 'rare': return '#007AFF';
      case 'epic': return '#FF4747';
      case 'legendary': return '#FFB800';
      default: return '#A0A0A0';
    }
  };

  const renderIcon = (iconName: string, size: number = 24, color: string = 'currentColor') => {
    const iconProps = { size, color };
    switch (iconName) {
      case 'user': return <UserIcon {...iconProps} />;
      case 'running': return <RunningIcon {...iconProps} />;
      case 'map': return <MapIcon {...iconProps} />;
      case 'crown': return <CrownIcon {...iconProps} />;
      case 'fire': return <FireIcon {...iconProps} />;
      case 'team': return <TeamIcon {...iconProps} />;
      case 'energy': return <EnergyIcon {...iconProps} />;
      case 'globe': return <GlobeIcon {...iconProps} />;
      case 'trophy': return <TrophyIcon {...iconProps} />;
      case 'clock': return <ClockIcon {...iconProps} />;
      case 'tree': return <TreeIcon {...iconProps} />;
      case 'shield': return <ShieldIcon {...iconProps} />;
      default: return <UserIcon {...iconProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-runner-black text-runner-text">
      {/* Profile Header */}
      <div className="safe-top pt-6 pb-4 px-6 border-b border-runner-border">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-runner-text mb-1">
            Profile
          </h1>
          <p className="text-sm text-runner-text-muted">
            Your territory conquest stats
          </p>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 bg-runner-lime rounded-full flex items-center justify-center">
            <UserIcon size={40} color="#000000" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-runner-text">
              {mockProfile.displayName}
            </h2>
            <p className="text-runner-text-muted">
              {mockProfile.username}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-runner-lime/20 text-runner-lime">
                Level {mockProfile.level}
              </span>
              <span className="text-xs text-runner-text-muted">
                {mockProfile.title}
              </span>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            className="w-10 h-10 bg-runner-card border border-runner-border rounded-lg flex items-center justify-center hover:border-runner-border-light transition-colors"
          >
            ⚙️
          </button>
        </div>

        <p className="mb-4 text-runner-text-muted">
          {mockProfile.bio}
        </p>

        <div className="flex items-center gap-1 mb-4 text-sm text-runner-text-muted">
          <span>📍</span>
          <span>{mockProfile.location} • Joined {mockProfile.joinedDate}</span>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'Territories', value: mockProfile.stats.territories },
            { label: 'Runs', value: mockProfile.stats.totalRuns },
            { label: 'Distance', value: `${mockProfile.stats.totalDistance}km` },
            { label: 'Followers', value: mockProfile.stats.followers },
            { label: 'Following', value: mockProfile.stats.following }
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-bold text-lg text-runner-text">
                {stat.value}
              </div>
              <div className="text-xs text-runner-text-muted">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <button className="flex-1 bg-runner-lime text-runner-black rounded-lg py-3 font-semibold hover:bg-runner-lime/90 transition-colors">
            Edit Profile
          </button>
          <button className="flex-1 bg-runner-card border border-runner-border text-runner-text rounded-lg py-3 font-semibold hover:border-runner-border-light transition-colors">
            Share
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6 pt-4">
        <div className="flex gap-1 bg-runner-dark rounded-lg p-1 mb-6 overflow-x-auto">
          {[
            { id: 'profile', label: 'Profile', icon: '👤' },
            { id: 'achievements', label: 'Badges', icon: '🏆' },
            { id: 'records', label: 'Records', icon: '📊' },
            { id: 'social', label: 'Social', icon: '👥' },
            { id: 'settings', label: 'Settings', icon: '⚙️' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
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
        {/* Profile Tab - Training Insights */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-h3 font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Training Insights
              </h2>
              <div className="space-y-3">
                <div
                  className="glass-card p-4 rounded-2xl"
                  style={{
                    background: 'rgba(0, 212, 106, 0.1)',
                    borderColor: 'rgba(0, 212, 106, 0.2)'
                  }}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <StarIcon size={16} color="#00D46A" />
                    <span style={{ color: '#00D46A' }}>Your pace improved 8% this month</span>
                  </div>
                </div>
                <div
                  className="glass-card p-4 rounded-2xl"
                  style={{
                    background: 'rgba(255, 184, 0, 0.1)',
                    borderColor: 'rgba(255, 184, 0, 0.2)'
                  }}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span>⏰</span>
                    <span style={{ color: '#FFB800' }}>You run best at 7 AM</span>
                  </div>
                </div>
                <div
                  className="glass-card p-4 rounded-2xl"
                  style={{
                    background: 'rgba(255, 71, 71, 0.1)',
                    borderColor: 'rgba(255, 71, 71, 0.2)'
                  }}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span>💤</span>
                    <span style={{ color: 'var(--accent-primary)' }}>Rest recommended after 5 consecutive days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-h3 font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Badge Collection
              </h2>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  Unlocked
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {mockAchievements.filter(a => a.unlocked).map((achievement) => (
                    <div
                      key={achievement.id}
                      className="glass-card p-4 rounded-2xl text-center"
                      style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        borderColor: getRarityColor(achievement.rarity),
                        borderWidth: '2px'
                      }}
                    >
                      <div className="mb-2">{renderIcon(achievement.icon, 32, getRarityColor(achievement.rarity))}</div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {achievement.title}
                      </div>
                      {achievement.description && (
                        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                          {achievement.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  Progress
                </h3>
                <div className="space-y-3">
                  {mockAchievements.filter(a => !a.unlocked).map((achievement) => (
                    <div
                      key={achievement.id}
                      className="glass-card p-4 rounded-2xl"
                      style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        opacity: 0.7
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="opacity-50">{renderIcon(achievement.icon, 32, getRarityColor(achievement.rarity))}</div>
                        <div className="flex-1">
                          <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                            {achievement.title}
                          </div>
                          <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                            {achievement.description}
                          </div>
                          {achievement.progress && achievement.target && (
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                  {achievement.progress}/{achievement.target}
                                </span>
                                <span
                                  className="text-xs font-semibold"
                                  style={{ color: getRarityColor(achievement.rarity) }}
                                >
                                  {Math.round((achievement.progress / achievement.target) * 100)}%
                                </span>
                              </div>
                              <div className="w-full h-1 bg-black/20 rounded-full">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${(achievement.progress / achievement.target) * 100}%`,
                                    background: getRarityColor(achievement.rarity)
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Records Tab */}
        {activeTab === 'records' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-h3 font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Personal Records
              </h2>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  Distance PRs
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {mockPRs.map((pr) => (
                    <div
                      key={pr.distance}
                      className="glass-card p-4 rounded-2xl text-center"
                      style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      <div className="mb-2">{renderIcon(pr.icon, 24, 'var(--text-primary)')}</div>
                      <div className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                        {pr.time}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {pr.distance}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  Territory Records
                </h3>
                <div className="space-y-2">
                  {mockTerritoryRecords.map((record, index) => (
                    <div
                      key={index}
                      className="glass-card p-4 rounded-2xl"
                      style={{
                        background: 'rgba(0, 0, 0, 0.4)',
                        borderColor: 'rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      <div className="flex items-center gap-4">
                        {renderIcon(record.icon, 20, 'var(--text-primary)')}
                        <div className="flex-1">
                          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {record.title}
                          </div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {record.value}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Social Tab */}
        {activeTab === 'social' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-h3 font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Friends & Followers
              </h2>

              <div className="space-y-3">
                {mockFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="glass-card p-4 rounded-2xl"
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      borderColor: 'rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>{renderIcon(friend.avatar, 24, 'var(--text-primary)')}</div>
                        <div>
                          <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {friend.name}
                          </div>
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Level {friend.level} • Last run: {friend.lastRun}
                          </div>
                        </div>
                      </div>
                      <div
                        className="px-3 py-1 rounded-full text-sm font-medium"
                        style={{
                          background: friend.status === 'online'
                            ? 'rgba(0, 212, 106, 0.2)'
                            : friend.status === 'running'
                            ? 'rgba(255, 71, 71, 0.2)'
                            : 'rgba(255, 255, 255, 0.1)',
                          color: friend.status === 'online'
                            ? '#00D46A'
                            : friend.status === 'running'
                            ? 'var(--accent-primary)'
                            : 'var(--text-secondary)'
                        }}
                      >
                        {friend.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">⚙️</div>
              <h3 className="text-h3 font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Settings
              </h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Account settings, preferences, and privacy controls coming soon.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom padding */}
      <div className="pb-24"></div>
    </div>
  );
};