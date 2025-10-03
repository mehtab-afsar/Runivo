import React from 'react'
import { Trophy, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeaderboardDrawerContentProps {
  isPeek: boolean
}

export const LeaderboardDrawerContent: React.FC<LeaderboardDrawerContentProps> = ({ isPeek }) => {
  const leaders = [
    { rank: 1, name: 'Alex Runner', distance: 245.3, territories: 45, points: 12450, avatar: 'AR' },
    { rank: 2, name: 'Sarah Speed', distance: 232.1, territories: 42, points: 11840, avatar: 'SS' },
    { rank: 3, name: 'Mike Fast', distance: 218.7, territories: 38, points: 10920, avatar: 'MF' },
    { rank: 4, name: 'You', distance: 127.5, territories: 23, points: 6580, avatar: 'YO' },
    { rank: 5, name: 'Emma Quick', distance: 115.2, territories: 21, points: 5890, avatar: 'EQ' },
    { rank: 6, name: 'John Dash', distance: 108.4, territories: 19, points: 5420, avatar: 'JD' },
    { rank: 7, name: 'Lisa Sprint', distance: 98.7, territories: 17, points: 4890, avatar: 'LS' },
  ]

  if (isPeek) {
    // Peek view: Show top 3 + your position
    const topThree = leaders.slice(0, 3)
    const yourPosition = leaders.find(l => l.name === 'You')

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-light flex items-center gap-2">
          <Trophy size={20} className="text-primary" strokeWidth={1.5} />
          Top Runners
        </h3>

        {topThree.map((leader) => (
          <div
            key={leader.rank}
            className="flex items-center gap-3 p-3 rounded-lg liquid-blur-subtle"
          >
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-sm font-light',
              leader.rank === 1 ? 'bg-yellow-500 text-yellow-50' :
              leader.rank === 2 ? 'bg-gray-400 text-gray-50' :
              'bg-orange-600 text-orange-50'
            )}>
              {leader.rank}
            </div>
            <div className="flex-1">
              <div className="text-sm font-normal">{leader.name}</div>
              <div className="text-xs font-light text-muted-foreground">
                {leader.points} pts
              </div>
            </div>
          </div>
        ))}

        {yourPosition && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-light">
              {yourPosition.rank}
            </div>
            <div className="flex-1">
              <div className="text-sm font-normal">Your Position</div>
              <div className="text-xs font-light text-muted-foreground">
                {yourPosition.points} pts
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Expanded view: Full leaderboard
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-light flex items-center gap-2">
          <Trophy size={24} className="text-primary" strokeWidth={1.5} />
          Global Leaderboard
        </h2>
        <TrendingUp size={20} className="text-primary" strokeWidth={1.5} />
      </div>

      <div className="space-y-2">
        {leaders.map((leader) => (
          <div
            key={leader.rank}
            className={cn(
              'flex items-center gap-4 p-4 rounded-lg transition-all',
              leader.name === 'You'
                ? 'bg-primary/10 border border-primary/20'
                : 'liquid-blur-subtle'
            )}
          >
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center text-sm font-light',
              leader.rank === 1 ? 'bg-yellow-500 text-yellow-50' :
              leader.rank === 2 ? 'bg-gray-400 text-gray-50' :
              leader.rank === 3 ? 'bg-orange-600 text-orange-50' :
              'bg-secondary text-foreground'
            )}>
              {leader.rank}
            </div>

            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-light">
              {leader.avatar}
            </div>

            <div className="flex-1">
              <div className="text-sm font-normal">{leader.name}</div>
              <div className="text-xs font-light text-muted-foreground">
                {leader.distance} km • {leader.territories} territories
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-normal">{leader.points}</div>
              <div className="text-xs font-light text-muted-foreground">points</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
