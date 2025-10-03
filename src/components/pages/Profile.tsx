import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { User, Trophy, Award, Users, Settings, MapPin, Calendar, TrendingUp, Target, Share2, Edit3 } from 'lucide-react'

const mockProfile = {
  id: 'user-1',
  username: '@runner',
  displayName: 'Alex Morgan',
  bio: 'Running enthusiast • Territory explorer',
  location: 'San Francisco, CA',
  joinedDate: 'Jan 2025',
  stats: {
    totalDistance: 1247, // km
    totalRuns: 142,
    territories: 23,
    followers: 89,
    following: 124
  }
}

const mockAchievements = [
  { id: '1', title: 'First 5K', icon: '🏃', unlocked: true },
  { id: '2', title: 'Explorer', icon: '🗺️', unlocked: true },
  { id: '3', title: '100km Club', icon: '💯', unlocked: true },
  { id: '4', title: '7-Day Streak', icon: '🔥', unlocked: true },
  { id: '5', title: 'Early Bird', icon: '🌅', unlocked: true },
  { id: '6', title: 'Night Owl', icon: '🌙', unlocked: false },
]

const mockPRs = [
  { distance: '1K', time: '3:42', date: 'Mar 2025' },
  { distance: '5K', time: '19:23', date: 'Feb 2025' },
  { distance: '10K', time: '41:15', date: 'Jan 2025' },
  { distance: 'Half', time: '1:32:45', date: 'Dec 2024' }
]

type ProfileTab = 'overview' | 'challenges' | 'competitions'

export const Profile: React.FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview')

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Profile Header */}
      <div className="liquid-blur-header sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={36} strokeWidth={1.5} className="text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-light mb-1">{mockProfile.displayName}</h1>
                <p className="text-sm font-light text-muted-foreground">{mockProfile.username}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
            >
              <Settings size={20} strokeWidth={1.5} className="text-muted-foreground" />
            </button>
          </div>

          <p className="text-sm font-light text-muted-foreground mb-4">
            {mockProfile.bio}
          </p>

          <div className="flex items-center gap-4 text-xs font-light text-muted-foreground mb-6">
            <div className="flex items-center gap-1">
              <MapPin size={14} strokeWidth={1.5} />
              <span>{mockProfile.location}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={14} strokeWidth={1.5} />
              <span>Joined {mockProfile.joinedDate}</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-light">{mockProfile.stats.totalDistance}</div>
              <div className="stat-label">km total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-light">{mockProfile.stats.totalRuns}</div>
              <div className="stat-label">runs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-light">{mockProfile.stats.territories}</div>
              <div className="stat-label">territories</div>
            </div>
          </div>

          {/* Social Stats */}
          <div className="flex items-center justify-center gap-6 mb-6 text-sm font-light">
            <button className="hover:text-primary transition-colors">
              <span className="font-normal">{mockProfile.stats.followers}</span>
              <span className="text-muted-foreground ml-1">followers</span>
            </button>
            <button className="hover:text-primary transition-colors">
              <span className="font-normal">{mockProfile.stats.following}</span>
              <span className="text-muted-foreground ml-1">following</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button className="flex-1 py-2.5 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-light hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
              <Edit3 size={16} strokeWidth={1.5} />
              <span>Edit Profile</span>
            </button>
            <button className="py-2.5 px-4 border border-border rounded-lg text-sm font-light hover:bg-secondary transition-colors flex items-center justify-center gap-2">
              <Share2 size={16} strokeWidth={1.5} />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-background border-b border-border sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={cn(
                'px-4 py-3 text-sm font-light transition-colors border-b-2',
                activeTab === 'overview'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('challenges')}
              className={cn(
                'px-4 py-3 text-sm font-light transition-colors border-b-2',
                activeTab === 'challenges'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Challenges
            </button>
            <button
              onClick={() => setActiveTab('competitions')}
              className={cn(
                'px-4 py-3 text-sm font-light transition-colors border-b-2',
                activeTab === 'competitions'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Competitions
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Personal Records */}
            <div className="card-breathable">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-light">Personal Records</h2>
                <Trophy size={20} strokeWidth={1.5} className="text-primary" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {mockPRs.map((pr) => (
                  <div key={pr.distance} className="border border-border rounded-lg p-4">
                    <div className="text-xs font-light text-muted-foreground mb-1">
                      {pr.distance}
                    </div>
                    <div className="text-2xl font-light mb-1">{pr.time}</div>
                    <div className="text-xs font-light text-muted-foreground">
                      {pr.date}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Achievements */}
            <div className="card-breathable">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-light">Achievements</h2>
                <Award size={20} strokeWidth={1.5} className="text-primary" />
              </div>

              <div className="grid grid-cols-4 gap-3">
                {mockAchievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={cn(
                      'aspect-square rounded-lg flex flex-col items-center justify-center gap-1 border transition-all',
                      achievement.unlocked
                        ? 'bg-primary/5 border-primary/20'
                        : 'bg-secondary border-border opacity-40'
                    )}
                  >
                    <span className="text-2xl">{achievement.icon}</span>
                    <span className="text-[10px] font-light text-center px-1">
                      {achievement.title}
                    </span>
                  </div>
                ))}
              </div>

              <button className="w-full mt-4 py-2 text-sm font-light text-primary hover:underline">
                View All Achievements
              </button>
            </div>

            {/* Recent Activity */}
            <div className="card-breathable">
              <h2 className="text-lg font-light mb-4">Recent Activity</h2>

              <div className="space-y-3">
                <ActivityItem
                  title="Morning Run"
                  distance="8.2 km"
                  pace="5:24 /km"
                  time="2 hours ago"
                />
                <ActivityItem
                  title="Evening Jog"
                  distance="5.0 km"
                  pace="6:12 /km"
                  time="Yesterday"
                />
                <ActivityItem
                  title="Long Run"
                  distance="15.3 km"
                  pace="5:48 /km"
                  time="3 days ago"
                />
              </div>

              <button
                onClick={() => navigate('/activity')}
                className="w-full mt-4 py-2 text-sm font-light text-primary hover:underline"
              >
                View All Activities
              </button>
            </div>
          </div>
        )}

        {activeTab === 'challenges' && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Target size={48} className="text-muted-foreground" strokeWidth={1} />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-light text-foreground">No active challenges</h3>
              <p className="text-sm font-light text-muted-foreground max-w-xs">
                Join challenges to compete with other runners and track your progress
              </p>
            </div>
            <button className="mt-4 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-light hover:bg-primary/90 transition-colors">
              Browse Challenges
            </button>
          </div>
        )}

        {activeTab === 'competitions' && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Trophy size={48} className="text-muted-foreground" strokeWidth={1} />
            <div className="text-center space-y-2">
              <h3 className="text-lg font-light text-foreground">No competitions yet</h3>
              <p className="text-sm font-light text-muted-foreground max-w-xs">
                Compete with runners globally and climb the leaderboards
              </p>
            </div>
            <button className="mt-4 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-light hover:bg-primary/90 transition-colors">
              View Leaderboards
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface ActivityItemProps {
  title: string
  distance: string
  pace: string
  time: string
}

const ActivityItem: React.FC<ActivityItemProps> = ({ title, distance, pace, time }) => {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <TrendingUp size={18} strokeWidth={1.5} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-normal mb-0.5">{title}</h3>
        <p className="text-xs font-light text-muted-foreground">{time}</p>
      </div>
      <div className="text-right">
        <div className="text-sm font-light">{distance}</div>
        <div className="text-xs font-light text-muted-foreground">{pace}</div>
      </div>
    </div>
  )
}
