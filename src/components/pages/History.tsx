import React from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { History as HistoryIcon, MapPin, Trophy, Shield, Sword } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HistoryItem {
  id: string
  type: 'capture' | 'defend' | 'attack' | 'lost'
  territory: string
  timestamp: string
  details?: string
}

export const History: React.FC = () => {
  const historyItems: HistoryItem[] = [
    { id: '1', type: 'capture', territory: 'Downtown', timestamp: '2 hours ago', details: 'First capture of the day' },
    { id: '2', type: 'defend', territory: 'Central Park', timestamp: '5 hours ago', details: 'Successfully defended against attack' },
    { id: '3', type: 'lost', territory: 'Riverside', timestamp: 'Yesterday', details: 'Territory captured by Mike Fast' },
    { id: '4', type: 'capture', territory: 'Harbor District', timestamp: '2 days ago' },
    { id: '5', type: 'defend', territory: 'Old Town', timestamp: '3 days ago' },
    { id: '6', type: 'attack', territory: 'University', timestamp: '4 days ago', details: 'Attack attempt unsuccessful' },
    { id: '7', type: 'capture', territory: 'Market Square', timestamp: '5 days ago' },
    { id: '8', type: 'capture', territory: 'Tech Park', timestamp: '6 days ago' },
  ]

  const getItemColor = (type: HistoryItem['type']) => {
    switch (type) {
      case 'capture': return 'text-green-600 bg-green-500/10'
      case 'defend': return 'text-blue-600 bg-blue-500/10'
      case 'attack': return 'text-orange-600 bg-orange-500/10'
      case 'lost': return 'text-red-600 bg-red-500/10'
      default: return 'text-muted-foreground bg-secondary'
    }
  }

  const getItemIcon = (type: HistoryItem['type']) => {
    switch (type) {
      case 'capture': return Trophy
      case 'defend': return Shield
      case 'attack': return Sword
      case 'lost': return MapPin
      default: return HistoryIcon
    }
  }

  const getItemLabel = (type: HistoryItem['type']) => {
    switch (type) {
      case 'capture': return 'Captured'
      case 'defend': return 'Defended'
      case 'attack': return 'Attacked'
      case 'lost': return 'Lost'
      default: return 'Activity'
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Activity History" showBack={true} showProfile={true} />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="card-breathable text-center">
            <div className="text-2xl font-light mb-1 text-green-600">12</div>
            <div className="stat-label">Captured</div>
          </div>
          <div className="card-breathable text-center">
            <div className="text-2xl font-light mb-1 text-blue-600">28</div>
            <div className="stat-label">Defended</div>
          </div>
          <div className="card-breathable text-center">
            <div className="text-2xl font-light mb-1 text-orange-600">15</div>
            <div className="stat-label">Attacked</div>
          </div>
          <div className="card-breathable text-center">
            <div className="text-2xl font-light mb-1 text-red-600">3</div>
            <div className="stat-label">Lost</div>
          </div>
        </div>

        {/* History Timeline */}
        <div className="card-breathable">
          <div className="flex items-center gap-2 mb-4">
            <HistoryIcon size={20} className="text-primary" strokeWidth={1.5} />
            <h2 className="text-lg font-light">Recent Activity</h2>
          </div>

          <div className="space-y-3">
            {historyItems.map((item) => {
              const Icon = getItemIcon(item.type)
              const colorClass = getItemColor(item.type)
              const label = getItemLabel(item.type)

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border hover:bg-secondary transition-all"
                >
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', colorClass)}>
                    <Icon size={18} strokeWidth={1.5} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-normal">{label}</span>
                      <span className="text-sm font-light">{item.territory}</span>
                    </div>
                    {item.details && (
                      <p className="text-xs font-light text-muted-foreground mb-1">
                        {item.details}
                      </p>
                    )}
                    <span className="text-xs font-light text-muted-foreground">
                      {item.timestamp}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
