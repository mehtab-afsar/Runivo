import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type GlowColor = 'cyan' | 'magenta' | 'gold' | 'green' | 'orange';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'hero' | 'compact';
  glowColor?: GlowColor;
  className?: string;
}

const glowMap: Record<GlowColor, string> = {
  cyan:    'shadow-[0_2px_16px_rgba(0,180,198,0.1)] border-teal-200',
  magenta: 'shadow-[0_2px_16px_rgba(220,38,127,0.1)] border-pink-200',
  gold:    'shadow-[0_2px_16px_rgba(245,158,11,0.1)] border-amber-200',
  green:   'shadow-[0_2px_16px_rgba(16,185,129,0.1)] border-emerald-200',
  orange:  'shadow-[0_2px_16px_rgba(249,115,22,0.1)] border-orange-200',
};

export function StatCard({
  label, value, unit, icon, trend, trendValue,
  variant = 'default', glowColor, className,
}: StatCardProps) {
  if (variant === 'hero') {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn('flex flex-col items-center justify-center py-6', className)}
      >
        <span className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-medium mb-2">
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-stat text-5xl font-bold text-gray-900 leading-none">{value}</span>
          {unit && (
            <span className="text-stat text-lg text-gray-400 font-medium">{unit}</span>
          )}
        </div>
      </motion.div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex flex-col items-center py-3', className)}>
        <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1">{label}</span>
        <span className="text-stat text-xl font-semibold text-gray-900">
          {value}
          {unit && <span className="text-sm text-gray-400 ml-0.5">{unit}</span>}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      className={cn(
        'bg-white rounded-2xl p-4 flex flex-col gap-2',
        'border border-gray-100 shadow-sm',
        glowColor && glowMap[glowColor],
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.15em] text-gray-400 font-medium">
          {label}
        </span>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-stat text-2xl font-bold text-gray-900">{value}</span>
        {unit && <span className="text-stat text-sm text-gray-400">{unit}</span>}
      </div>
      {trend && trendValue && (
        <div className={cn(
          'flex items-center gap-1 text-xs font-medium',
          trend === 'up'      && 'text-emerald-500',
          trend === 'down'    && 'text-red-500',
          trend === 'neutral' && 'text-gray-400',
        )}>
          {trend === 'up' && '↑'}
          {trend === 'down' && '↓'}
          {trendValue}
        </div>
      )}
    </motion.div>
  );
}
