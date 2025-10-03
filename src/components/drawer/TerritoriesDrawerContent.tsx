import React from 'react'
import { MapPin, Shield, Sword } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TerritoriesDrawerContentProps {
  isPeek: boolean
}

export const TerritoriesDrawerContent: React.FC<TerritoriesDrawerContentProps> = ({ isPeek }) => {
  const stats = {
    owned: 23,
    defended: 142,
    attacked: 89,
    dailyIncome: 450
  }

  const ownedTerritories = [
    { name: 'Downtown', capturedOn: '2 hours ago', defenseLevel: 'Strong', status: 'safe' },
    { name: 'Central Park', capturedOn: '5 hours ago', defenseLevel: 'Medium', status: 'safe' },
    { name: 'Riverside', capturedOn: 'Yesterday', defenseLevel: 'Weak', status: 'danger' },
    { name: 'Harbor District', capturedOn: '2 days ago', defenseLevel: 'Strong', status: 'safe' },
    { name: 'Old Town', capturedOn: '3 days ago', defenseLevel: 'Medium', status: 'safe' }
  ]

  if (isPeek) {
    // Peek view: Territory summary
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-light flex items-center gap-2">
          <MapPin size={20} className="text-primary" strokeWidth={1.5} />
          Your Territories
        </h3>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg liquid-blur-subtle text-center">
            <div className="text-2xl font-light mb-1 text-green-600">{stats.owned}</div>
            <div className="text-xs font-light text-muted-foreground">Owned</div>
          </div>
          <div className="p-3 rounded-lg liquid-blur-subtle text-center">
            <div className="text-2xl font-light mb-1 text-blue-600">{stats.defended}</div>
            <div className="text-xs font-light text-muted-foreground">Defended</div>
          </div>
          <div className="p-3 rounded-lg liquid-blur-subtle text-center">
            <div className="text-2xl font-light mb-1 text-orange-600">{stats.attacked}</div>
            <div className="text-xs font-light text-muted-foreground">Attacked</div>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
          <div className="text-sm font-light text-muted-foreground">Daily Income</div>
          <div className="text-xl font-light text-primary">+{stats.dailyIncome} pts</div>
        </div>
      </div>
    )
  }

  // Expanded view: Territory list
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-light flex items-center gap-2">
          <MapPin size={24} className="text-primary" strokeWidth={1.5} />
          Territory Management
        </h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-lg liquid-blur-subtle text-center">
          <Shield size={16} className="mx-auto mb-1 text-green-600" strokeWidth={1.5} />
          <div className="text-lg font-light mb-0.5">{stats.owned}</div>
          <div className="text-xs font-light text-muted-foreground">Owned</div>
        </div>
        <div className="p-3 rounded-lg liquid-blur-subtle text-center">
          <Shield size={16} className="mx-auto mb-1 text-blue-600" strokeWidth={1.5} />
          <div className="text-lg font-light mb-0.5">{stats.defended}</div>
          <div className="text-xs font-light text-muted-foreground">Defended</div>
        </div>
        <div className="p-3 rounded-lg liquid-blur-subtle text-center">
          <Sword size={16} className="mx-auto mb-1 text-orange-600" strokeWidth={1.5} />
          <div className="text-lg font-light mb-0.5">{stats.attacked}</div>
          <div className="text-xs font-light text-muted-foreground">Attacked</div>
        </div>
      </div>

      {/* Territory List */}
      <div className="space-y-2">
        <h3 className="text-sm font-light text-muted-foreground">Owned Territories</h3>
        {ownedTerritories.map((territory, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 rounded-lg liquid-blur-subtle"
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
            <div className={cn(
              'text-xs font-light px-2 py-1 rounded-full',
              territory.defenseLevel === 'Strong' ? 'bg-green-500/10 text-green-600' :
              territory.defenseLevel === 'Medium' ? 'bg-yellow-500/10 text-yellow-600' :
              'bg-red-500/10 text-red-600'
            )}>
              {territory.defenseLevel}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
