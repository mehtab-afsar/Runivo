import { Bell, Zap, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatusIndicatorsProps {
  notifications?: number
  energy?: 'HI' | 'MED' | 'LO'
  achievements?: number
}

export const StatusIndicators = ({
  notifications = 0,
  energy = 'LO',
  achievements = 9
}: StatusIndicatorsProps) => {
  const getEnergyColor = (level: string) => {
    switch (level) {
      case 'HI':
        return 'bg-green-500 text-green-50'
      case 'MED':
        return 'bg-yellow-500 text-yellow-50'
      case 'LO':
        return 'bg-orange-500 text-orange-50'
      default:
        return 'bg-gray-500 text-gray-50'
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Notifications */}
      <button className="relative p-3 liquid-blur-card rounded-xl hover:bg-white/20 transition-colors">
        <Bell size={20} strokeWidth={1.5} className="text-foreground" />
        {notifications > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-light rounded-full flex items-center justify-center">
            {notifications}
          </span>
        )}
      </button>

      {/* Energy Level */}
      <button className={cn(
        'relative p-3 rounded-xl hover:opacity-90 transition-all',
        getEnergyColor(energy)
      )}>
        <Zap size={20} strokeWidth={1.5} fill="currentColor" />
        <span className="absolute -bottom-1 -right-1 text-[10px] font-normal liquid-blur-card px-1.5 py-0.5 rounded-full">
          {energy}
        </span>
      </button>

      {/* Achievements/Tasks */}
      <button className="relative p-3 bg-primary/20 backdrop-blur-md border border-primary/30 rounded-xl hover:bg-primary/30 transition-colors">
        <Award size={20} strokeWidth={1.5} className="text-primary" />
        <span className="absolute -bottom-1 -right-1 text-[10px] font-normal bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
          {achievements}
        </span>
      </button>
    </div>
  )
}
