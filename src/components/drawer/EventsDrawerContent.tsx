import React from 'react'
import { Calendar, Users, Clock, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EventsDrawerContentProps {
  isPeek: boolean
}

export const EventsDrawerContent: React.FC<EventsDrawerContentProps> = ({ isPeek }) => {
  const activeEvents = [
    {
      name: 'Weekend Challenge',
      description: 'Run 50km over the weekend to earn bonus points',
      participants: 1240,
      endsIn: '2 days',
      reward: '500 pts',
      progress: 35
    },
    {
      name: 'Territory War',
      description: 'Compete for the most territory captures this week',
      participants: 890,
      endsIn: '5 days',
      reward: '1000 pts',
      progress: 18
    },
    {
      name: 'Speed Demon',
      description: 'Achieve your fastest 5K time this month',
      participants: 567,
      endsIn: '12 days',
      reward: '750 pts',
      progress: 60
    }
  ]

  if (isPeek) {
    // Peek view: Show daily challenge + next event
    const dailyChallenge = activeEvents[0]

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-light flex items-center gap-2">
          <Trophy size={20} className="text-primary" strokeWidth={1.5} />
          Daily Challenge
        </h3>

        <div className="p-4 rounded-lg liquid-blur-subtle">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-normal">{dailyChallenge.name}</h4>
            <span className="text-xs font-light bg-primary/10 text-primary px-2 py-1 rounded-full">
              {dailyChallenge.reward}
            </span>
          </div>
          <p className="text-xs font-light text-muted-foreground mb-3">
            {dailyChallenge.description}
          </p>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-light text-muted-foreground">
              <span>Progress</span>
              <span>{dailyChallenge.progress}%</span>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${dailyChallenge.progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-light text-muted-foreground">
          <Clock size={14} strokeWidth={1.5} />
          <span>Ends in {dailyChallenge.endsIn}</span>
        </div>
      </div>
    )
  }

  // Expanded view: All events
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-light flex items-center gap-2">
        <Calendar size={24} className="text-primary" strokeWidth={1.5} />
        Active Events
      </h2>

      <div className="space-y-3">
        {activeEvents.map((event, index) => (
          <div key={index} className="p-4 rounded-lg liquid-blur-subtle">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-normal">{event.name}</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-light bg-blue-500/10 text-blue-600">
                    challenge
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
  )
}
