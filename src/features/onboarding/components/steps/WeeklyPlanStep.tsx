import { motion } from 'framer-motion';
import { haptic } from '@shared/lib/haptics';
import WeeklyGoalRing from '@shared/ui/WeeklyGoalRing';

type PreferredDistance = 'short' | '5k' | '10k' | 'long';

interface Props {
  frequency: number;
  distance: PreferredDistance;
  onFrequencyChange: (days: number) => void;
  onDistanceChange: (d: PreferredDistance) => void;
  weeklyGoalKm: number;
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DISTANCES: { id: PreferredDistance; label: string }[] = [
  { id: 'short', label: '< 3km' },
  { id: '5k', label: '3-5km' },
  { id: '10k', label: '5-10km' },
  { id: 'long', label: '10km+' },
];

export default function WeeklyPlanStep({ frequency, distance, onFrequencyChange, onDistanceChange, weeklyGoalKm }: Props) {
  // Toggle days: maintain a set of selected day indices
  // For simplicity, we select first N days based on frequency
  const handleDayToggle = (index: number) => {
    haptic('light');
    // Simple: just cycle frequency up/down based on taps
    // We'll use a simpler model: tapping increments, wraps at 7
    const newFreq = index < frequency ? index : index + 1;
    onFrequencyChange(Math.min(7, Math.max(1, newFreq)));
  };

  return (
    <div className="flex flex-col h-full px-6">
      <div className="mb-6">
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Set your weekly rhythm</h2>
        <p className="text-[13px] text-gray-400 mt-1">You can always change this later</p>
      </div>

      {/* Days per week */}
      <div className="mb-5">
        <span className="text-[11px] text-gray-400 uppercase tracking-wider font-medium block mb-2.5">
          How often do you run?
        </span>
        <div className="flex gap-2 justify-between mb-2">
          {DAYS.map((day, i) => {
            const active = i < frequency;
            return (
              <motion.button
                key={i}
                whileTap={{ scale: 0.85 }}
                onClick={() => handleDayToggle(i)}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold transition-all ${
                  active
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {day}
              </motion.button>
            );
          })}
        </div>
        <p className="text-center">
          <span className="text-stat text-lg font-bold text-gray-900">{frequency}</span>
          <span className="text-[13px] text-gray-400 ml-1">days per week</span>
        </p>
      </div>

      {/* Distance preference */}
      <div className="mb-6">
        <span className="text-[11px] text-gray-400 uppercase tracking-wider font-medium block mb-2.5">
          Typical run distance
        </span>
        <div className="flex bg-gray-100 rounded-xl p-1 relative">
          {DISTANCES.map((d) => {
            const selected = distance === d.id;
            return (
              <button
                key={d.id}
                onClick={() => { onDistanceChange(d.id); haptic('light'); }}
                className={`flex-1 py-2.5 rounded-lg text-[12px] font-semibold transition-all relative z-10 ${
                  selected ? 'text-teal-600' : 'text-gray-400'
                }`}
              >
                {selected && (
                  <motion.div
                    layoutId="distance-indicator"
                    className="absolute inset-0 bg-white rounded-lg shadow-sm"
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  />
                )}
                <span className="relative z-10">{d.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Goal preview */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col items-center"
      >
        <span className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-3">Your weekly goal</span>
        <WeeklyGoalRing currentKm={0} goalKm={weeklyGoalKm} />
      </motion.div>
    </div>
  );
}
