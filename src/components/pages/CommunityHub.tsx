import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTime, formatDistance } from '@/data/mockData';

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'individual' | 'team' | 'community';
  category: 'distance' | 'territories' | 'time' | 'special';
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'upcoming' | 'active' | 'completed' | 'failed';
  progress: number;
  target: number;
  participants: number;
  maxParticipants?: number;
  startDate: Date;
  endDate: Date;
  rewards: {
    xp: number;
    badge?: string;
    title?: string;
  };
  emoji: string;
}

interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  type: 'tournament' | 'group_run' | 'territory_war' | 'special_event';
  startTime: Date;
  duration: number; // in minutes
  participants: number;
  maxParticipants: number;
  location?: string;
  rewards: string[];
  status: 'upcoming' | 'active' | 'ended';
  emoji: string;
}

export const CommunityHub: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'challenges' | 'events' | 'leaderboard' | 'create'>('challenges');
  const [challengeFilter, setChallengeFilter] = useState<'all' | 'active' | 'completed'>('active');

  const challenges: Challenge[] = useMemo(() => [
    {
      id: '1',
      title: 'Weekly Territory Conqueror',
      description: 'Claim 15 territories in 7 days',
      type: 'individual',
      category: 'territories',
      difficulty: 'medium',
      status: 'active',
      progress: 8,
      target: 15,
      participants: 156,
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4), // 4 days from now
      rewards: { xp: 500, badge: 'Territory Master', title: 'Conqueror' },
      emoji: '⚔️',
    },
    {
      id: '2',
      title: 'Distance Destroyer',
      description: 'Run 50km total this month',
      type: 'individual',
      category: 'distance',
      difficulty: 'hard',
      status: 'active',
      progress: 32.5,
      target: 50,
      participants: 89,
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15), // 15 days ago
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15), // 15 days from now
      rewards: { xp: 1000, badge: 'Marathon Machine' },
      emoji: '🏃‍♂️',
    },
    {
      id: '3',
      title: 'Team Territory Blitz',
      description: 'Work with your team to claim 100 territories collectively',
      type: 'team',
      category: 'territories',
      difficulty: 'hard',
      status: 'active',
      progress: 67,
      target: 100,
      participants: 24,
      maxParticipants: 30,
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5), // 5 days from now
      rewards: { xp: 800, badge: 'Team Player', title: 'Squad Leader' },
      emoji: '🤝',
    },
    {
      id: '4',
      title: 'Speed Demon Sprint',
      description: 'Complete a 5km run in under 20 minutes',
      type: 'individual',
      category: 'time',
      difficulty: 'hard',
      status: 'upcoming',
      progress: 0,
      target: 1,
      participants: 0,
      startDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2), // 2 days from now
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days from now
      rewards: { xp: 750, badge: 'Speed Demon' },
      emoji: '⚡',
    },
    {
      id: '5',
      title: 'Community Cleanup',
      description: 'Participate in the weekly community territory maintenance',
      type: 'community',
      category: 'special',
      difficulty: 'easy',
      status: 'completed',
      progress: 1,
      target: 1,
      participants: 234,
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8), // 8 days ago
      endDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1), // 1 day ago
      rewards: { xp: 200, badge: 'Community Hero' },
      emoji: '🌟',
    },
  ], []);

  const communityEvents: CommunityEvent[] = useMemo(() => [
    {
      id: '1',
      title: 'Friday Night Territory Wars',
      description: 'Intense team-based territory battles across the city',
      type: 'territory_war',
      startTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2), // 2 days from now
      duration: 120,
      participants: 45,
      maxParticipants: 60,
      location: 'City Center',
      rewards: ['Exclusive Title', 'Premium Badge', '1000 XP'],
      status: 'upcoming',
      emoji: '⚔️',
    },
    {
      id: '2',
      title: 'Morning Runners Group',
      description: 'Join fellow early birds for a social 5km run',
      type: 'group_run',
      startTime: new Date(Date.now() + 1000 * 60 * 60 * 16), // tomorrow morning
      duration: 45,
      participants: 12,
      maxParticipants: 20,
      location: 'Central Park',
      rewards: ['Social Badge', 'Community Points'],
      status: 'upcoming',
      emoji: '🌅',
    },
    {
      id: '3',
      title: 'Weekend Warrior Tournament',
      description: 'Compete in multiple challenges over the weekend',
      type: 'tournament',
      startTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5), // 5 days from now
      duration: 1440, // 24 hours
      participants: 78,
      maxParticipants: 100,
      rewards: ['Champion Title', 'Golden Badge', '2000 XP'],
      status: 'upcoming',
      emoji: '🏆',
    },
  ], []);

  const filteredChallenges = useMemo(() => {
    return challenges.filter(challenge => {
      if (challengeFilter === 'all') return true;
      if (challengeFilter === 'active') return challenge.status === 'active';
      if (challengeFilter === 'completed') return challenge.status === 'completed';
      return true;
    });
  }, [challenges, challengeFilter]);

  const getDifficultyColor = (difficulty: Challenge['difficulty']) => {
    switch (difficulty) {
      case 'easy': return 'text-stealth-success';
      case 'medium': return 'text-stealth-warning';
      case 'hard': return 'text-stealth-error';
    }
  };

  const getStatusColor = (status: Challenge['status']) => {
    switch (status) {
      case 'active': return 'bg-stealth-success';
      case 'upcoming': return 'bg-stealth-warning';
      case 'completed': return 'bg-stealth-lime';
      case 'failed': return 'bg-stealth-error';
    }
  };

  const getProgressPercentage = (progress: number, target: number) => {
    return Math.min(100, (progress / target) * 100);
  };

  const formatTimeRemaining = (endDate: Date) => {
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return 'Ending soon';
  };

  return (
    <div className="container mx-auto px-5 py-16 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-h1">Community Hub</h1>
        <p className="text-body text-stealth-gray">Join challenges, events, and compete with others</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-stealth-card rounded-full p-1 overflow-x-auto">
        {[
          { key: 'challenges', label: 'Challenges' },
          { key: 'events', label: 'Events' },
          { key: 'leaderboard', label: 'Teams' },
          { key: 'create', label: 'Create' },
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

      {/* Challenges Tab */}
      {activeTab === 'challenges' && (
        <div className="space-y-4">
          {/* Challenge Filters */}
          <div className="flex gap-2">
            {[
              { key: 'active', label: 'Active' },
              { key: 'completed', label: 'Completed' },
              { key: 'all', label: 'All' },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setChallengeFilter(filter.key as any)}
                className={`px-3 py-1 rounded-full text-sm ${
                  challengeFilter === filter.key
                    ? 'bg-stealth-lime text-stealth-black'
                    : 'bg-stealth-card text-stealth-gray border border-stealth-border'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Challenge List */}
          <div className="space-y-4">
            {filteredChallenges.map((challenge) => (
              <Card key={challenge.id} className="hover:border-stealth-lime/50 transition-all">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{challenge.emoji}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-body-lg font-medium">{challenge.title}</div>
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(challenge.status)}`} />
                        </div>
                        <div className="text-body text-stealth-gray">{challenge.description}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-medium ${getDifficultyColor(challenge.difficulty)}`}>
                        {challenge.difficulty.toUpperCase()}
                      </div>
                      <div className="text-xs text-stealth-gray">
                        {challenge.participants} participants
                      </div>
                    </div>
                  </div>

                  {challenge.status === 'active' && (
                    <>
                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Progress: {challenge.progress}/{challenge.target}</span>
                          <span>{formatTimeRemaining(challenge.endDate)} left</span>
                        </div>
                        <div className="w-full bg-stealth-border rounded-full h-2">
                          <div
                            className="bg-stealth-lime h-2 rounded-full transition-all"
                            style={{ width: `${getProgressPercentage(challenge.progress, challenge.target)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button size="sm" className="flex-1">
                          Continue Challenge
                        </Button>
                        <Button size="sm" variant="secondary">
                          View Details
                        </Button>
                      </div>
                    </>
                  )}

                  {challenge.status === 'upcoming' && (
                    <div className="flex gap-3">
                      <Button size="sm" className="flex-1">
                        Join Challenge
                      </Button>
                      <Button size="sm" variant="secondary">
                        Set Reminder
                      </Button>
                    </div>
                  )}

                  {challenge.status === 'completed' && (
                    <div className="bg-stealth-surface rounded-lg p-3">
                      <div className="text-sm text-stealth-lime font-medium">
                        ✅ Challenge Completed!
                      </div>
                      <div className="text-xs text-stealth-gray">
                        Rewards: {challenge.rewards.xp} XP
                        {challenge.rewards.badge && `, ${challenge.rewards.badge} badge`}
                        {challenge.rewards.title && `, "${challenge.rewards.title}" title`}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {communityEvents.map((event) => (
            <Card key={event.id} className="hover:border-stealth-lime/50 transition-all">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{event.emoji}</div>
                    <div>
                      <div className="text-body-lg font-medium">{event.title}</div>
                      <div className="text-body text-stealth-gray">{event.description}</div>
                      {event.location && (
                        <div className="text-caption text-stealth-gray">📍 {event.location}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-stealth-lime font-medium">
                      {event.startTime.toLocaleDateString()}
                    </div>
                    <div className="text-xs text-stealth-gray">
                      {event.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-3">
                  <div className="text-sm text-stealth-gray">
                    {event.participants}/{event.maxParticipants} participants • {event.duration}min
                  </div>
                  <div className="text-sm text-stealth-lime">
                    {event.rewards.join(', ')}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button size="sm" className="flex-1" disabled={event.participants >= event.maxParticipants}>
                    {event.participants >= event.maxParticipants ? 'Full' : 'Join Event'}
                  </Button>
                  <Button size="sm" variant="secondary">
                    Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Teams Tab */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Teams This Week</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { rank: 1, name: 'Speed Demons', members: 12, territories: 134, badge: '🥇' },
                { rank: 2, name: 'Territory Hunters', members: 8, territories: 128, badge: '🥈' },
                { rank: 3, name: 'Running Rebels', members: 15, territories: 119, badge: '🥉' },
                { rank: 4, name: 'Your Team', members: 6, territories: 89, badge: '🏃‍♂️' },
              ].map((team) => (
                <div key={team.rank} className="flex justify-between items-center p-3 bg-stealth-surface rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{team.badge}</span>
                    <div>
                      <div className={`text-body-lg font-medium ${team.name === 'Your Team' ? 'text-stealth-lime' : ''}`}>
                        {team.name}
                      </div>
                      <div className="text-caption text-stealth-gray">{team.members} members</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-metric text-stealth-lime">{team.territories}</div>
                    <div className="text-caption text-stealth-gray">territories</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-3">
            <Button>Join a Team</Button>
            <Button variant="secondary">Create New Team</Button>
          </div>
        </div>
      )}

      {/* Create Tab */}
      {activeTab === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle>Create Custom Challenge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-body text-stealth-gray mb-4">
              Design your own challenge and invite friends to participate
            </div>

            <div className="grid gap-4">
              <Button className="justify-start">
                🎯 Territory Challenge
              </Button>
              <Button className="justify-start" variant="secondary">
                🏃‍♂️ Distance Challenge
              </Button>
              <Button className="justify-start" variant="secondary">
                ⏱️ Time Challenge
              </Button>
              <Button className="justify-start" variant="secondary">
                🌟 Custom Challenge
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/active-run')}>
              🏃‍♂️ Start Challenge Run
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