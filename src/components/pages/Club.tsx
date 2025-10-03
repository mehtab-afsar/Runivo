import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, MapPin, TrendingUp, Crown, Shield, User, Circle, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CreateClubModal } from '@/components/club/CreateClubModal'

interface Member {
  id: string
  name: string
  avatar: string
  level: number
  status: 'online' | 'offline' | 'running'
  territories: number
  lastActive: string
  role: 'leader' | 'admin' | 'member'
}

export const Club = () => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const isAdmin = true // This would come from user context

  // Mock list of existing club names (would come from backend)
  const existingClubNames = [
    'Thunder Runners',
    'Speed Demons',
    'Elite Runners',
    'Marathon Masters',
    'Swift Feet'
  ]

  // Mock data
  const clubData = {
    name: 'Thunder Runners',
    level: 12,
    memberCount: 47,
    rank: '#156 Global',
    badge: '⚡',
    totalTerritories: 124,
    weeklyRuns: 38,
    clubStreak: 12,
    dailyIncome: 3200
  }

  const members: Member[] = [
    { id: '1', name: 'Alex Chen', avatar: '👤', level: 28, status: 'online', territories: 12, lastActive: 'Now', role: 'leader' },
    { id: '2', name: 'Sarah Park', avatar: '👤', level: 25, status: 'running', territories: 10, lastActive: '5 min ago', role: 'admin' },
    { id: '3', name: 'Mike Ross', avatar: '👤', level: 23, status: 'online', territories: 8, lastActive: '2 min ago', role: 'admin' },
    { id: '4', name: 'Emma Stone', avatar: '👤', level: 22, status: 'offline', territories: 7, lastActive: '2 hours ago', role: 'member' },
    { id: '5', name: 'John Doe', avatar: '👤', level: 20, status: 'offline', territories: 6, lastActive: '1 day ago', role: 'member' }
  ]

  const topTerritories = [
    { name: 'Central Park NYC', admin: 'Alex Chen' },
    { name: 'Hyde Park London', admin: 'Sarah Park' },
    { name: 'Golden Gate SF', admin: 'Mike Ross' }
  ]

  const activities = [
    { text: 'Alex captured Tokyo Station', time: '2 hours ago' },
    { text: 'Sarah completed weekly challenge', time: '4 hours ago' },
    { text: 'Mike defended London Bridge', time: '6 hours ago' },
    { text: 'Thunder Runners gained 5 new territories', time: '1 day ago' }
  ]

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'leader': return <Crown size={14} className="text-yellow-400" />
      case 'admin': return <Shield size={14} className="text-blue-400" />
      default: return <User size={14} className="text-white/50" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'running': return 'bg-primary'
      case 'offline': return 'bg-gray-500'
    }
  }

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateClub = (clubData: { name: string; logoUrl: string; description: string }) => {
    console.log('Creating club:', clubData)
    // Here you would call your API to create the club
    // In production: upload image to server, create club with returned logo URL
    setShowCreateModal(false)
    // Could add success notification here
    alert(`Club "${clubData.name}" created successfully!`)
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 liquid-blur-header">
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={() => navigate('/home')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-white" />
          </button>
          <h1 className="text-lg font-light text-white">My Club</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Plus size={24} className="text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 px-6 space-y-4">
        {/* Club Header Card */}
        <div className="liquid-blur-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="text-5xl">{clubData.badge}</div>
            <div className="flex-1">
              <h2 className="text-2xl font-light text-white mb-1">{clubData.name}</h2>
              <div className="flex items-center gap-3 text-sm text-white/70">
                <span>Level {clubData.level}</span>
                <span>•</span>
                <span>{clubData.memberCount} members</span>
                <span>•</span>
                <span className="text-primary">{clubData.rank}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="liquid-blur-subtle rounded-xl p-3">
              <div className="text-2xl font-light text-white mb-1">{clubData.totalTerritories}</div>
              <div className="text-xs text-white/60">Territories</div>
            </div>
            <div className="liquid-blur-subtle rounded-xl p-3">
              <div className="text-2xl font-light text-white mb-1">{clubData.weeklyRuns}</div>
              <div className="text-xs text-white/60">Weekly Runs</div>
            </div>
            <div className="liquid-blur-subtle rounded-xl p-3">
              <div className="text-2xl font-light text-white mb-1">{clubData.clubStreak}</div>
              <div className="text-xs text-white/60">Day Streak</div>
            </div>
            <div className="liquid-blur-subtle rounded-xl p-3">
              <div className="text-2xl font-light text-primary mb-1">{clubData.dailyIncome.toLocaleString()}</div>
              <div className="text-xs text-white/60">Coins/Day</div>
            </div>
          </div>
        </div>

        {/* Members Section */}
        <div className="liquid-blur-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-primary" />
              <h3 className="text-lg font-light text-white">Members</h3>
            </div>
            <span className="text-sm text-white/60">{members.length}</span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-primary/50"
            />
          </div>

          {/* Member List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="liquid-blur-subtle rounded-xl p-3 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-lg">
                      {member.avatar}
                    </div>
                    <div className={cn('absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black', getStatusColor(member.status))} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(member.role)}
                      <span className="text-sm font-light text-white truncate">{member.name}</span>
                      <span className="text-xs text-white/50">Lv.{member.level}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <span>{member.territories} territories</span>
                      <span>•</span>
                      <span>{member.lastActive}</span>
                    </div>
                  </div>
                  <Circle size={6} className={cn('fill-current', member.status === 'online' ? 'text-green-500' : member.status === 'running' ? 'text-primary' : 'text-gray-500')} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Territories Section */}
        <div className="liquid-blur-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={20} className="text-primary" />
            <h3 className="text-lg font-light text-white">Top Territories</h3>
          </div>
          <div className="space-y-2">
            {topTerritories.map((territory, idx) => (
              <div key={idx} className="liquid-blur-subtle rounded-xl p-3">
                <div className="text-sm font-light text-white mb-1">{territory.name}</div>
                <div className="text-xs text-white/50">Admin: {territory.admin}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 text-xs">
            <div className="flex-1 liquid-blur-subtle rounded-lg p-2 text-center">
              <div className="text-green-400">+3 new today</div>
            </div>
            <div className="flex-1 liquid-blur-subtle rounded-lg p-2 text-center">
              <div className="text-red-400">2 under attack</div>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="liquid-blur-card rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={20} className="text-primary" />
            <h3 className="text-lg font-light text-white">Recent Activity</h3>
          </div>
          <div className="space-y-2">
            {activities.map((activity, idx) => (
              <div key={idx} className="liquid-blur-subtle rounded-xl p-3">
                <div className="text-sm font-light text-white mb-1">{activity.text}</div>
                <div className="text-xs text-white/40">{activity.time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Admin Controls */}
        {isAdmin && (
          <div className="liquid-blur-card rounded-2xl p-4 space-y-3">
            <h3 className="text-lg font-light text-white mb-2">Admin Controls</h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="bg-primary/20 border border-primary/30 rounded-xl p-3 hover:bg-primary/30 transition-colors">
                <div className="text-sm font-light text-white">Invite Members</div>
              </button>
              <button className="liquid-blur-subtle rounded-xl p-3 hover:bg-white/10 transition-colors">
                <div className="text-sm font-light text-white">Club Settings</div>
              </button>
              <button className="liquid-blur-subtle rounded-xl p-3 hover:bg-white/10 transition-colors">
                <div className="text-sm font-light text-white">Manage Roles</div>
              </button>
              <button className="liquid-blur-subtle rounded-xl p-3 hover:bg-white/10 transition-colors">
                <div className="text-sm font-light text-white">Challenges</div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Club Modal */}
      <CreateClubModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateClub={handleCreateClub}
        existingClubNames={existingClubNames}
      />
    </div>
  )
}
