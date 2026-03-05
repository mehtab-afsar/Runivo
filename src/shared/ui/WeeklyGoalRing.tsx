import { motion } from 'framer-motion';
import { Target, Check, Pencil } from 'lucide-react';
import { haptic } from '@shared/lib/haptics';

interface WeeklyGoalRingProps {
  currentKm: number;
  goalKm: number;
  onEditGoal?: () => void;
}

export default function WeeklyGoalRing({
  currentKm,
  goalKm,
  onEditGoal,
}: WeeklyGoalRingProps) {
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = Math.min(currentKm / goalKm, 1);
  const strokeDashoffset = circumference * (1 - progress);
  const isComplete = currentKm >= goalKm;

  const accentColor = isComplete ? '#22c55e' : '#14b8a6'; // green-500 / teal-500

  const handleEditClick = () => {
    haptic();
    onEditGoal?.();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2">
      {/* Ring */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-gray-200"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Progress fill */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={accentColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          {isComplete ? (
            <>
              <Check className="w-6 h-6 text-green-500 mb-0.5" />
              <span className="text-stat text-gray-900 text-lg leading-none">
                {currentKm.toFixed(1)}
              </span>
              <span className="text-gray-400 text-[10px] leading-tight mt-0.5">
                /{goalKm} km
              </span>
            </>
          ) : (
            <>
              <span className="text-stat text-gray-900 text-xl leading-none">
                {currentKm.toFixed(1)}
              </span>
              <span className="text-gray-400 text-[10px] leading-tight mt-0.5">
                /{goalKm} km
              </span>
            </>
          )}
        </div>
      </div>

      {/* Label + edit */}
      <div className="flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-gray-400 text-xs font-medium">This Week</span>
        {onEditGoal && (
          <button
            onClick={handleEditClick}
            className="ml-1 p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Edit weekly goal"
          >
            <Pencil className="w-3 h-3 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}
