import React from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { cn } from '@/lib/utils'
import { Trophy, TrendingUp } from 'lucide-react'

export const Leaderboard: React.FC = () => {
  const leaders = [
    { rank: 1, name: 'Alex Runner', distance: 245.3, territories: 45, points: 12450, avatar: 'AR' },
    { rank: 2, name: 'Sarah Speed', distance: 232.1, territories: 42, points: 11840, avatar: 'SS' },
    { rank: 3, name: 'Mike Fast', distance: 218.7, territories: 38, points: 10920, avatar: 'MF' },
    { rank: 4, name: 'You', distance: 127.5, territories: 23, points: 6580, avatar: 'YO' },
    { rank: 5, name: 'Emma Quick', distance: 115.2, territories: 21, points: 5890, avatar: 'EQ' },
    { rank: 6, name: 'John Dash', distance: 108.4, territories: 19, points: 5420, avatar: 'JD' },
    { rank: 7, name: 'Lisa Sprint', distance: 98.7, territories: 17, points: 4890, avatar: 'LS' },
    { rank: 8, name: 'Tom Pace', distance: 87.3, territories: 15, points: 4320, avatar: 'TP' },
  ]

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Leaderboard" showBack={true} showProfile={true} />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Podium Section */}
        <div className="card-breathable">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={20} className="text-primary" strokeWidth={1.5} />
            <h2 className="text-lg font-light">Top Runners</h2>
          </div>

          <div className="flex items-end justify-center gap-4 py-6">
            {/* 2nd Place */}
            <div className="flex flex-col items-center flex-1">
              <div className="w-16 h-16 rounded-full bg-gray-400 text-white flex items-center justify-center text-xl font-light mb-2">
                {leaders[1].avatar}
              </div>
              <div className="text-sm font-light text-center mb-2">{leaders[1].name}</div>
              <div className="w-full bg-gray-400/10 rounded-t-lg p-4 text-center border border-gray-400/20">
                <div className="text-3xl font-light text-gray-600 mb-1">2</div>
                <div className="text-xs text-muted-foreground">{leaders[1].points} pts</div>
              </div>
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center flex-1">
              <div className="w-20 h-20 rounded-full bg-yellow-500 text-white flex items-center justify-center text-2xl font-light mb-2">
                {leaders[0].avatar}
              </div>
              <div className="text-sm font-normal text-center mb-2">{leaders[0].name}</div>
              <div className="w-full bg-yellow-500/10 rounded-t-lg p-6 text-center border border-yellow-500/20">
                <Trophy size={32} className="text-yellow-600 mx-auto mb-2" />
                <div className="text-4xl font-light text-yellow-600 mb-1">1</div>
                <div className="text-xs text-muted-foreground">{leaders[0].points} pts</div>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center flex-1">
              <div className="w-16 h-16 rounded-full bg-orange-600 text-white flex items-center justify-center text-xl font-light mb-2">
                {leaders[2].avatar}
              </div>
              <div className="text-sm font-light text-center mb-2">{leaders[2].name}</div>
              <div className="w-full bg-orange-600/10 rounded-t-lg p-4 text-center border border-orange-600/20">
                <div className="text-3xl font-light text-orange-700 mb-1">3</div>
                <div className="text-xs text-muted-foreground">{leaders[2].points} pts</div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Rankings */}
        <div className="card-breathable">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-primary" strokeWidth={1.5} />
            <h2 className="text-lg font-light">Global Rankings</h2>
          </div>

          <div className="space-y-3">
            {leaders.map((leader) => (
              <div
                key={leader.rank}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-lg border transition-all',
                  leader.name === 'You'
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-background border-border hover:bg-secondary'
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-light',
                  leader.rank === 1 ? 'bg-yellow-500 text-yellow-50' :
                  leader.rank === 2 ? 'bg-gray-400 text-gray-50' :
                  leader.rank === 3 ? 'bg-orange-600 text-orange-50' :
                  'bg-secondary text-foreground'
                )}>
                  {leader.rank}
                </div>

                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-light">
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
      </div>
    </div>
  )
}
