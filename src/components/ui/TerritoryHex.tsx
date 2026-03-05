import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type TerritoryStatus = 'owned' | 'enemy' | 'neutral' | 'contested' | 'claiming';

interface TerritoryHexProps {
  status: TerritoryStatus;
  size?: number;
  label?: string;
  defenseLevel?: number; // 0-100
  onClick?: () => void;
  className?: string;
}

const statusColors: Record<TerritoryStatus, { fill: string; stroke: string }> = {
  owned:    { fill: 'rgba(0, 240, 255, 0.15)',  stroke: 'rgba(0, 240, 255, 0.6)' },
  enemy:    { fill: 'rgba(255, 51, 102, 0.15)', stroke: 'rgba(255, 51, 102, 0.6)' },
  neutral:  { fill: 'rgba(255, 255, 255, 0.05)',stroke: 'rgba(255, 255, 255, 0.15)' },
  contested:{ fill: 'rgba(255, 215, 0, 0.15)',  stroke: 'rgba(255, 215, 0, 0.6)' },
  claiming: { fill: 'rgba(0, 255, 136, 0.15)',  stroke: 'rgba(0, 255, 136, 0.6)' },
};

const HEX_PERIMETER = 340; // approximate perimeter for stroke-dasharray

export function TerritoryHex({
  status,
  size = 60,
  label,
  defenseLevel,
  onClick,
  className,
}: TerritoryHexProps) {
  const colors = statusColors[status];
  const filterId = `glow-${status}`;

  return (
    <motion.div
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={cn('relative', onClick && 'cursor-pointer', className)}
      style={{ width: size, height: size * 1.15 }}
    >
      <svg viewBox="0 0 100 115" className="w-full h-full overflow-visible">
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Main hex fill */}
        <motion.polygon
          points="50,2 95,28 95,87 50,113 5,87 5,28"
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth="2"
          filter={status !== 'neutral' ? `url(#${filterId})` : undefined}
          animate={
            status === 'contested'
              ? { opacity: [0.5, 1, 0.5], strokeWidth: [2, 3, 2] }
              : status === 'claiming'
              ? { fillOpacity: [0.1, 0.3, 0.1] }
              : undefined
          }
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Defense ring overlay */}
        {defenseLevel !== undefined && status === 'owned' && (
          <polygon
            points="50,2 95,28 95,87 50,113 5,87 5,28"
            fill="none"
            stroke={colors.stroke}
            strokeWidth="3"
            strokeDasharray={`${(defenseLevel / 100) * HEX_PERIMETER} ${HEX_PERIMETER}`}
            strokeLinecap="round"
            opacity={0.8}
          />
        )}
      </svg>

      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white/80">{label}</span>
        </div>
      )}
    </motion.div>
  );
}
