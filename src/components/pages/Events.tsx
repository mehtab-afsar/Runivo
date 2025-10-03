import React from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { Calendar, Users, Trophy, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Events: React.FC = () => {
  const activeEvents = [
    {
      name: 'Weekend Challenge',
      description: 'Run 50km over the weekend to earn bonus points',
      participants: 1240,
      endsIn: '2 days',
      reward: '500 pts',
      progress: 35,
      type: 'challenge'
    },
    {
      name: 'Territory War',
      description: 'Compete for the most territory captures this week',
      participants: 890,
      endsIn: '5 days',
      reward: '1000 pts',
      progress: 18,
      type: 'competition'
    },
    {
      name: 'Speed Demon',
      description: 'Achieve your fastest 5K time this month',
      participants: 567,
      endsIn: '12 days',
      reward: '750 pts',
      progress: 60,
      type: 'challenge'
    },
  ]

  const upcomingEvents = [
    {
      name: 'Global Marathon',
      date: 'Nov 15, 2024',
      participants: 0,
      reward: '2500 pts'
    },
    {
      name: 'Club Wars',
      date: 'Nov 20, 2024',
      participants: 0,
      reward: '5000 pts'
    },
  ]

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Events" showBack={true} showProfile={true} />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Active Events */}
        <div className="card-breathable">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={20} className="text-primary" strokeWidth={1.5} />
            <h2 className="text-lg font-light">Active Events</h2>
          </div>

          <div className="space-y-4">
            {activeEvents.map((event, index) => (
              <div
                key={index}
                className="p-4 rounded-lg bg-background border border-border hover:bg-secondary transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-normal">{event.name}</h3>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-light",
                        event.type === 'challenge'
                          ? 'bg-blue-500/10 text-blue-600'
                          : 'bg-purple-500/10 text-purple-600'
                      )}>
                        {event.type}
                      </span>
                    </div>
                    <p className="text-xs font-light text-muted-foreground mb-2">
                      {event.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs font-light text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users size={14} strokeWidth={1.5} />
                        <span>{event.participants} joined</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} strokeWidth={1.5} />
                        <span>Ends in {event.endsIn}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-light bg-primary/10 text-primary px-3 py-1 rounded-full whitespace-nowrap">
                    {event.reward}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-light text-muted-foreground">
                    <span>Your Progress</span>
                    <span>{event.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${event.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="card-breathable">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={20} className="text-primary" strokeWidth={1.5} />
            <h2 className="text-lg font-light">Upcoming Events</h2>
          </div>

          <div className="space-y-3">
            {upcomingEvents.map((event, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg bg-background border border-border hover:bg-secondary transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar size={20} className="text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="text-sm font-normal mb-0.5">{event.name}</div>
                    <div className="text-xs font-light text-muted-foreground">
                      {event.date}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-light bg-primary/10 text-primary px-3 py-1 rounded-full mb-1">
                    {event.reward}
                  </div>
                  <button className="text-xs font-light text-primary hover:underline">
                    Notify Me
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Event Rules Card */}
        <div className="card-breathable bg-primary/5 border-primary/20">
          <div className="text-sm font-light text-foreground/80 space-y-2">
            <p className="font-normal">Event Rules:</p>
            <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
              <li>Complete events before the deadline to earn rewards</li>
              <li>Progress is tracked automatically through your runs</li>
              <li>Rewards are distributed within 24 hours of completion</li>
              <li>Some events may have minimum participation requirements</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
