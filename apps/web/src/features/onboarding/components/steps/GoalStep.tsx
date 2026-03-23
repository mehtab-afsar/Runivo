import { motion } from 'framer-motion';
import { Heart, Flame, Zap, Compass, Swords } from 'lucide-react';
import { haptic } from '@shared/lib/haptics';

type Goal = 'get_fit' | 'lose_weight' | 'run_faster' | 'explore' | 'compete';

interface Props {
  value: Goal | null;
  onChange: (v: Goal) => void;
}

const options: { id: Goal; label: string; icon: typeof Heart }[] = [
  { id: 'get_fit', label: 'Get healthier', icon: Heart },
  { id: 'lose_weight', label: 'Lose weight', icon: Flame },
  { id: 'run_faster', label: 'Run faster', icon: Zap },
  { id: 'explore', label: 'Explore new places', icon: Compass },
  { id: 'compete', label: 'Compete and dominate', icon: Swords },
];

export default function GoalStep({ value, onChange }: Props) {
  return (
    <div className="flex flex-col h-full px-6">
      <div className="mb-6">
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">What's your main goal?</h2>
        <p className="text-[13px] text-gray-400 mt-1">We'll tailor your missions and dashboard</p>
      </div>

      <div className="space-y-2.5">
        {options.map((opt, i) => {
          const selected = value === opt.id;
          const Icon = opt.icon;
          return (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0, scale: selected ? 1.02 : 1 }}
              transition={{ delay: i * 0.06, type: 'spring', damping: 22 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { onChange(opt.id); haptic('light'); }}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl border transition-all"
              style={selected ? {
                background: 'linear-gradient(135deg, #E8435A, #D03A4F)',
                borderColor: 'transparent',
                boxShadow: '0 6px 20px rgba(232,67,90,0.15)',
              } : {
                backgroundColor: '#FFFFFF',
                borderColor: '#F3F3F3',
              }}
            >
              <Icon
                className="w-5 h-5"
                strokeWidth={1.8}
                style={{ color: selected ? '#FFFFFF' : '#9CA3AF' }}
              />
              <span
                className="text-[14px] font-semibold"
                style={{ color: selected ? '#FFFFFF' : '#374151' }}
              >
                {opt.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
