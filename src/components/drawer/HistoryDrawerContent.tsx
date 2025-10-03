import React from 'react'
import { History, Trophy, Shield, Sword, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HistoryDrawerContentProps {
  isPeek: boolean
}

interface HistoryItem {
  id: string
  type: 'capture' | 'defend' | 'attack' | 'lost'
  territory: string
  timestamp: string
  details?: string
}

export const HistoryDrawerContent: React.FC<HistoryDrawerContentProps> = ({ isPeek }) => {
  const historyItems: HistoryItem[] = [
    { id: '1', type: 'capture', territory: 'Downtown', timestamp: '2 hours ago', details: 'First capture of the day' },
    { id: '2', type: 'defend', territory: 'Central Park', timestamp: '5 hours ago', details: 'Successfully defended' },
    { id: '3', type: 'lost', territory: 'Riverside', timestamp: 'Yesterday', details: 'Captured by Mike Fast' },
    { id: '4', type: 'capture', territory: 'Harbor District', timestamp: '2 days ago' },
    { id: '5', type: 'defend', territory: 'Old Town', timestamp: '3 days ago' },
    { id: '6', type: 'attack', territory: 'University', timestamp: '4 days ago', details: 'Attack unsuccessful' },
    { id: '7', type: 'capture', territory: 'Market Square', timestamp: '5 days ago' }
  ]

  const getItemIcon = (type: HistoryItem['type']) => {
    switch (type) {
      case 'capture': return Trophy
      case 'defend': return Shield
      case 'attack': return Sword
      case 'lost': return MapPin
    }
  }

  const getItemColor = (type: HistoryItem['type']) => {
    switch (type) {
      case 'capture': return 'text-green-600 bg-green-500/10'
      case 'defend': return 'text-blue-600 bg-blue-500/10'
      case 'attack': return 'text-orange-600 bg-orange-500/10'
      case 'lost': return 'text-red-600 bg-red-500/10'
    }
  }

  const getItemLabel = (type: HistoryItem['type']) => {
    switch (type) {
      case 'capture': return 'Captured'
      case 'defend': return 'Defended'
      case 'attack': return 'Attacked'
      case 'lost': return 'Lost'
    }
  }

  if (isPeek) {
    // Peek view: Last 3 activities
    const recent = historyItems.slice(0, 3)

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-light flex items-center gap-2">
          <History size={20} className="text-primary" strokeWidth={1.5} />
          Recent Activity
        </h3>

        {recent.map((item) => {
          const Icon = getItemIcon(item.type)
          const colorClass = getItemColor(item.type)
          const label = getItemLabel(item.type)

          return (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg liquid-blur-subtle">
              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', colorClass)}>
                <Icon size={18} strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-normal">
                  {label} {item.territory}
                </div>
                <div className="text-xs font-light text-muted-foreground">
                  {item.timestamp}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Expanded view: Full history
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-light flex items-center gap-2">
        <History size={24} className="text-primary" strokeWidth={1.5} />
        Activity History
      </h2>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-3 rounded-lg liquid-blur-subtle text-center">
          <div className="text-lg font-light mb-0.5 text-green-600">12</div>
          <div className="text-xs font-light text-muted-foreground">Captured</div>
        </div>
        <div className="p-3 rounded-lg liquid-blur-subtle text-center">
          <div className="text-lg font-light mb-0.5 text-blue-600">28</div>
          <div className="text-xs font-light text-muted-foreground">Defended</div>
        </div>
        <div className="p-3 rounded-lg liquid-blur-subtle text-center">
          <div className="text-lg font-light mb-0.5 text-orange-600">15</div>
          <div className="text-xs font-light text-muted-foreground">Attacked</div>
        </div>
        <div className="p-3 rounded-lg liquid-blur-subtle text-center">
          <div className="text-lg font-light mb-0.5 text-red-600">3</div>
          <div className="text-xs font-light text-muted-foreground">Lost</div>
        </div>
      </div>

      {/* History Timeline */}
      <div className="space-y-2">
        {historyItems.map((item) => {
          const Icon = getItemIcon(item.type)
          const colorClass = getItemColor(item.type)
          const label = getItemLabel(item.type)

          return (
            <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg liquid-blur-subtle">
              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', colorClass)}>
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
  )
}
