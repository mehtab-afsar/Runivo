import { motion } from 'framer-motion';
import { Footprints, Sun, Calendar, Trophy, Check } from 'lucide-react';
import { haptic } from '../../../lib/haptics';

type ExperienceLevel = 'new' | 'casual' | 'regular' | 'competitive';

interface Props {
  value: ExperienceLevel | null;
  onChange: (v: ExperienceLevel) => void;
}

const options: { id: ExperienceLevel; label: string; desc: string; icon: typeof Footprints }[] = [
  { id: 'new', label: 'Just Starting', desc: 'New to running or getting back into it', icon: Footprints },
  { id: 'casual', label: 'Casual', desc: 'A few times a month for fun', icon: Sun },
  { id: 'regular', label: 'Regular', desc: '2-4 times a week consistently', icon: Calendar },
  { id: 'competitive', label: 'Competitive', desc: 'I train seriously and race', icon: Trophy },
];

export default function ExperienceStep({ value, onChange }: Props) {
  return (
    <div className="flex flex-col h-full px-6">
      <div className="mb-6">
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">How would you describe your running?</h2>
        <p className="text-[13px] text-gray-400 mt-1">This helps us set the right challenge level</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((opt, i) => {
          const selected = value === opt.id;
          const Icon = opt.icon;
          return (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, type: 'spring', damping: 22 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { onChange(opt.id); haptic('light'); }}
              className={`relative p-4 rounded-2xl border text-left transition-all ${
                selected
                  ? 'bg-teal-50 border-teal-300'
                  : 'bg-white border-gray-100'
              }`}
            >
              {selected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3 w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center"
                >
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </motion.div>
              )}
              <Icon className={`w-6 h-6 mb-3 ${selected ? 'text-teal-600' : 'text-gray-400'}`} strokeWidth={1.5} />
              <span className={`text-[13px] font-bold block mb-0.5 ${selected ? 'text-teal-700' : 'text-gray-900'}`}>
                {opt.label}
              </span>
              <span className="text-[11px] text-gray-400 leading-relaxed">{opt.desc}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
