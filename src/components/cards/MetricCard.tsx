import React from 'react'
import { cn } from '@/lib/utils'
import type { MetricCardProps } from '@/types'

export const MetricCard: React.FC<MetricCardProps> = ({
  value,
  unit,
  label,
  color = 'default',
  className
}) => {
  const colorClasses = {
    default: 'text-stealth-white drop-shadow-lg',
    accent: 'text-stealth-lime drop-shadow-lg',
    error: 'text-stealth-error drop-shadow-lg',
    success: 'text-stealth-success drop-shadow-lg'
  }

  const glowClasses = {
    default: 'group-hover:shadow-stealth-white/10',
    accent: 'group-hover:shadow-stealth-lime/20',
    error: 'group-hover:shadow-stealth-error/20',
    success: 'group-hover:shadow-stealth-success/20'
  }

  return (
    <div className={cn('metric-card group', glowClasses[color], className)}>
      <div className={cn('text-metric font-extrabold tracking-tight', colorClasses[color])}>
        {value}
        {unit && <span className="text-body font-medium text-stealth-gray ml-1">{unit}</span>}
      </div>
      <div className="text-caption text-stealth-gray font-semibold uppercase tracking-wide mt-3">
        {label}
      </div>
    </div>
  )
}
