import React, { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { Map, Shield, Sword, MapPin, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type TerritoryTab = 'owned' | 'nearby' | 'all'

export const Territories: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TerritoryTab>('owned')

  const stats = [
    { label: 'Owned', value: 23, icon: Shield, color: 'text-green-600' },
    { label: 'Defended', value: 142, icon: Shield, color: 'text-blue-600' },
    { label: 'Attacked', value: 89, icon: Sword, color: 'text-orange-600' },
  ]

  const ownedTerritories = [
    { name: 'Downtown', capturedOn: '2 hours ago', defenseLevel: 'Strong', status: 'safe' },
    { name: 'Central Park', capturedOn: '5 hours ago', defenseLevel: 'Medium', status: 'safe' },
    { name: 'Riverside', capturedOn: 'Yesterday', defenseLevel: 'Weak', status: 'danger' },
    { name: 'Harbor District', capturedOn: '2 days ago', defenseLevel: 'Strong', status: 'safe' },
    { name: 'Old Town', capturedOn: '3 days ago', defenseLevel: 'Medium', status: 'safe' },
  ]

  const nearbyTerritories = [
    { name: 'Market Square', distance: '0.5 km', owner: 'Alex Runner', difficulty: 'Easy' },
    { name: 'University', distance: '1.2 km', owner: 'Sarah Speed', difficulty: 'Medium' },
    { name: 'Tech Park', distance: '2.1 km', owner: 'Mike Fast', difficulty: 'Hard' },
  ]

  const allTerritories = [
    { name: 'Business District', distance: '3.5 km', owner: 'John Dash', difficulty: 'Medium' },
    { name: 'Sports Complex', distance: '4.2 km', owner: 'Emma Quick', difficulty: 'Easy' },
    { name: 'Mountain View', distance: '5.8 km', owner: 'Lisa Sprint', difficulty: 'Hard' },
    { name: 'Beach Front', distance: '7.1 km', owner: 'Tom Pace', difficulty: 'Medium' },
  ]

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Territories" showBack={true} showProfile={true} />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-3">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div key={index} className="card-breathable text-center">
                <Icon size={20} className={cn('mx-auto mb-2', stat.color)} strokeWidth={1.5} />
                <div className="text-2xl font-light mb-1">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            )
          })}
        </div>

        {/* Territory Tabs */}
        <div className="card-breathable">
          <div className="flex items-center gap-2 mb-4 border-b border-border">
            <button
              onClick={() => setActiveTab('owned')}
              className={cn(
                'flex-1 pb-3 text-sm font-light transition-all border-b-2',
                activeTab === 'owned'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Owned ({ownedTerritories.length})
            </button>
            <button
              onClick={() => setActiveTab('nearby')}
              className={cn(
                'flex-1 pb-3 text-sm font-light transition-all border-b-2',
                activeTab === 'nearby'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Nearby ({nearbyTerritories.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={cn(
                'flex-1 pb-3 text-sm font-light transition-all border-b-2',
                activeTab === 'all'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              All
            </button>
          </div>

          {/* Owned Territories */}
          {activeTab === 'owned' && (
            <div className="space-y-3">
              {ownedTerritories.map((territory, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border hover:bg-secondary transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      territory.status === 'safe' ? 'bg-green-500/10' : 'bg-red-500/10'
                    )}>
                      <MapPin
                        size={18}
                        className={territory.status === 'safe' ? 'text-green-600' : 'text-red-600'}
                        strokeWidth={1.5}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-normal">{territory.name}</div>
                      <div className="text-xs font-light text-muted-foreground">
                        Captured {territory.capturedOn}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      'text-xs font-light px-2 py-1 rounded-full',
                      territory.defenseLevel === 'Strong' ? 'bg-green-500/10 text-green-600' :
                      territory.defenseLevel === 'Medium' ? 'bg-yellow-500/10 text-yellow-600' :
                      'bg-red-500/10 text-red-600'
                    )}>
                      {territory.defenseLevel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Nearby Territories */}
          {activeTab === 'nearby' && (
            <div className="space-y-3">
              {nearbyTerritories.map((territory, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border hover:bg-secondary transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <MapPin size={18} className="text-primary" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="text-sm font-normal">{territory.name}</div>
                      <div className="text-xs font-light text-muted-foreground">
                        Owned by {territory.owner}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-light text-muted-foreground mb-1">
                      {territory.distance}
                    </div>
                    <div className={cn(
                      'text-xs font-light px-2 py-1 rounded-full',
                      territory.difficulty === 'Easy' ? 'bg-green-500/10 text-green-600' :
                      territory.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-600' :
                      'bg-red-500/10 text-red-600'
                    )}>
                      {territory.difficulty}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All Territories */}
          {activeTab === 'all' && (
            <div className="space-y-3">
              {allTerritories.map((territory, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border border-border hover:bg-secondary transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <Map size={18} className="text-foreground" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="text-sm font-normal">{territory.name}</div>
                      <div className="text-xs font-light text-muted-foreground">
                        Owned by {territory.owner}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-light text-muted-foreground mb-1">
                      {territory.distance}
                    </div>
                    <div className={cn(
                      'text-xs font-light px-2 py-1 rounded-full',
                      territory.difficulty === 'Easy' ? 'bg-green-500/10 text-green-600' :
                      territory.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-600' :
                      'bg-red-500/10 text-red-600'
                    )}>
                      {territory.difficulty}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Territory Tips */}
        <div className="card-breathable bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-primary" strokeWidth={1.5} />
            <h3 className="text-sm font-normal">Territory Tips</h3>
          </div>
          <div className="text-xs font-light text-muted-foreground space-y-2">
            <p>• Run through unclaimed areas to capture new territories</p>
            <p>• Defend your territories by running through them regularly</p>
            <p>• Challenge other runners to capture their territories</p>
            <p>• Stronger defenses require more effort to capture</p>
          </div>
        </div>
      </div>
    </div>
  )
}
