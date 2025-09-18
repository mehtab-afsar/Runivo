import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Mock data for activities
const mockActivities = [
  {
    id: '1',
    type: 'territory-run',
    title: 'Morning Territory Run',
    date: 'Today, 7:32 AM',
    distance: '5.24 km',
    duration: '26:35',
    pace: '5:04 /km',
    territories: { claimed: 3, defended: 2 },
    kudos: 12,
    map_thumbnail: '🗺️'
  },
  {
    id: '2',
    type: 'defense-run',
    title: 'Defense Patrol',
    date: 'Yesterday, 6:15 PM',
    distance: '3.8 km',
    duration: '19:42',
    pace: '5:12 /km',
    territories: { claimed: 0, defended: 4 },
    kudos: 8,
    map_thumbnail: '🗺️'
  },
  {
    id: '3',
    type: 'free-run',
    title: 'Evening Free Run',
    date: 'Yesterday, 5:45 AM',
    distance: '7.2 km',
    duration: '38:15',
    pace: '5:18 /km',
    territories: { claimed: 1, defended: 0 },
    kudos: 15,
    map_thumbnail: '🗺️'
  }
];

const mockStats = {
  weekly: {
    distance: '32.4 km',
    runs: 5,
    territories: { claimed: 8, defended: 12 },
    avgPace: '5:12 /km'
  },
  monthly: {
    distance: '127.8 km',
    runs: 18,
    territories: { claimed: 23, defended: 41 },
    avgPace: '5:08 /km'
  }
};

export const Activity: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'runs' | 'territory' | 'stats'>('runs');
  const [statsView, setStatsView] = useState<'weekly' | 'monthly'>('weekly');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'territory-run': return '🎯';
      case 'defense-run': return '🛡️';
      case 'explore-run': return '🗺️';
      case 'attack-run': return '⚔️';
      case 'free-run': return '🏃';
      default: return '▶️';
    }
  };

  const currentStats = statsView === 'weekly' ? mockStats.weekly : mockStats.monthly;

  return (
    <div className="min-h-screen bg-runner-black text-runner-text">
      {/* Header */}
      <div className="safe-top pt-6 pb-4 px-6 border-b border-runner-border">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-runner-text mb-1">
            Activity
          </h1>
          <p className="text-sm text-runner-text-muted">
            Track your territory conquest
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6 pt-4">
        <div className="flex bg-runner-dark rounded-lg p-1">
          {[
            { id: 'runs', label: 'My Runs', icon: '🏃' },
            { id: 'territory', label: 'Territory Log', icon: '🗺️' },
            { id: 'stats', label: 'Stats', icon: '📊' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'runs' | 'territory' | 'stats')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md font-medium text-sm transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-runner-lime text-runner-black'
                  : 'text-runner-text-muted hover:text-runner-text'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content based on active tab */}
      <div className="px-6 pt-6 pb-24">
        {activeTab === 'runs' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-runner-text mb-4">Recent Runs</h2>
            {mockActivities.map((activity) => (
              <div
                key={activity.id}
                className="bg-runner-card border border-runner-border rounded-lg p-4 hover:border-runner-border-light transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-runner-dark rounded-lg flex items-center justify-center text-xl">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-runner-text truncate">
                        {activity.title}
                      </h3>
                      <div className="text-xs text-runner-text-muted">
                        {activity.date}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-runner-text-muted">Distance:</span>
                        <span className="text-runner-lime font-medium ml-2">{activity.distance}</span>
                      </div>
                      <div>
                        <span className="text-runner-text-muted">Duration:</span>
                        <span className="text-runner-text font-medium ml-2">{activity.duration}</span>
                      </div>
                      <div>
                        <span className="text-runner-text-muted">Pace:</span>
                        <span className="text-runner-text font-medium ml-2">{activity.pace}</span>
                      </div>
                      <div>
                        <span className="text-runner-text-muted">Territories:</span>
                        <span className="text-runner-gold font-medium ml-2">
                          +{activity.territories.claimed} -{activity.territories.defended}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'territory' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-runner-text mb-4">Territory Log</h2>
            {[
              { type: 'claimed', territory: 'Downtown District', time: '2 hours ago', value: '0.8km²' },
              { type: 'defended', territory: 'Riverside Park', time: '1 day ago', value: '1.2km²' },
              { type: 'lost', territory: 'Market Square', time: '3 days ago', value: '0.5km²' },
              { type: 'upgraded', territory: 'Tech Quarter', time: '1 week ago', value: '2.1km²' }
            ].map((log, index) => (
              <div
                key={index}
                className="bg-runner-card border border-runner-border rounded-lg p-4"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${
                    log.type === 'claimed' ? 'bg-runner-success' :
                    log.type === 'defended' ? 'bg-runner-info' :
                    log.type === 'lost' ? 'bg-runner-danger' :
                    'bg-runner-warning'
                  }`}></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-runner-text">
                        {log.type === 'claimed' ? '📍 Claimed' :
                         log.type === 'defended' ? '🛡️ Defended' :
                         log.type === 'lost' ? '💔 Lost' :
                         '⬆️ Upgraded'} {log.territory}
                      </span>
                      <span className="text-xs text-runner-text-muted">{log.time}</span>
                    </div>
                    <div className="text-sm text-runner-text-muted mt-1">
                      Territory size: <span className="text-runner-lime">{log.value}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-lg font-bold text-runner-text">Statistics</h2>
              <div className="flex bg-runner-dark rounded-lg p-1">
                <button
                  onClick={() => setStatsView('weekly')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                    statsView === 'weekly'
                      ? 'bg-runner-lime text-runner-black'
                      : 'text-runner-text-muted hover:text-runner-text'
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setStatsView('monthly')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                    statsView === 'monthly'
                      ? 'bg-runner-lime text-runner-black'
                      : 'text-runner-text-muted hover:text-runner-text'
                  }`}
                >
                  Month
                </button>
              </div>
            </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div
              className="glass-card p-4 rounded-2xl"
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="text-2xl font-light mb-1" style={{ color: 'var(--text-primary)' }}>
                {currentStats.distance}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Distance
              </div>
            </div>

            <div
              className="glass-card p-4 rounded-2xl"
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="text-2xl font-light mb-1" style={{ color: 'var(--text-primary)' }}>
                {currentStats.runs}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Runs
              </div>
            </div>

            <div
              className="glass-card p-4 rounded-2xl"
              style={{
                background: 'rgba(255, 71, 71, 0.1)',
                borderColor: 'rgba(255, 71, 71, 0.3)'
              }}
            >
              <div className="text-2xl font-light mb-1" style={{ color: 'var(--accent-primary)' }}>
                {currentStats.territories.claimed}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Claimed
              </div>
            </div>

            <div
              className="glass-card p-4 rounded-2xl"
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <div className="text-2xl font-light mb-1" style={{ color: 'var(--text-primary)' }}>
                {currentStats.avgPace}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Avg Pace
              </div>
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  );
};