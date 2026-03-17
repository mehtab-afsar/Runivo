import { motion } from 'framer-motion';
import { Footprints, PersonStanding, Zap, Flame } from 'lucide-react';
import { haptic } from '@shared/lib/haptics';

type ExperienceLevel = 'new' | 'casual' | 'regular' | 'competitive';
interface Props { value: ExperienceLevel | null; onChange: (v: ExperienceLevel) => void; }

const options: { id: ExperienceLevel; label: string; sub: string; icon: typeof Zap }[] = [
  { id: 'new',         label: 'Just Starting',  sub: 'Lacing up for the first time', icon: Footprints     },
  { id: 'casual',      label: 'Casual',          sub: 'Easy strolls, no rush',        icon: PersonStanding },
  { id: 'regular',     label: 'Regular',         sub: 'Solid pace, good form',        icon: Zap            },
  { id: 'competitive', label: 'Competitive',     sub: 'Basically a human missile',    icon: Flame          },
];

export default function ExperienceStep({ value, onChange }: Props) {
  return (
    <div className="flex flex-col h-full px-6">
      <div className="mb-6">
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">How do you run?</h2>
        <p className="text-[13px] text-gray-400 mt-1">Sets the right challenge level for you</p>
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
              <div className="flex flex-col items-start">
                <span
                  className="text-[14px] font-semibold leading-tight"
                  style={{ color: selected ? '#FFFFFF' : '#374151' }}
                >
                  {opt.label}
                </span>
                <span
                  className="text-[11px] leading-tight mt-0.5"
                  style={{ color: selected ? 'rgba(255,255,255,0.75)' : '#9CA3AF' }}
                >
                  {opt.sub}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
