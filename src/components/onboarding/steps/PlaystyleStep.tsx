import { motion } from 'framer-motion';
import { Swords, Shield, Compass, Users } from 'lucide-react';
import { haptic } from '../../../lib/haptics';

type Playstyle = 'conqueror' | 'defender' | 'explorer' | 'social';

interface Props {
  value: Playstyle;
  onChange: (v: Playstyle) => void;
}

const options: { id: Playstyle; label: string; desc: string; icon: typeof Swords; color: string; selectedBg: string }[] = [
  { id: 'conqueror', label: 'Conqueror', desc: 'Capture as much territory as possible', icon: Swords, color: 'text-red-400', selectedBg: 'bg-red-50 border-red-200' },
  { id: 'defender', label: 'Defender', desc: 'Build an unbreakable fortress', icon: Shield, color: 'text-blue-400', selectedBg: 'bg-blue-50 border-blue-200' },
  { id: 'explorer', label: 'Explorer', desc: 'Discover every corner of the map', icon: Compass, color: 'text-green-500', selectedBg: 'bg-green-50 border-green-200' },
  { id: 'social', label: 'Social Runner', desc: 'Team up and compete with friends', icon: Users, color: 'text-purple-400', selectedBg: 'bg-purple-50 border-purple-200' },
];

export default function PlaystyleStep({ value, onChange }: Props) {
  return (
    <div className="flex flex-col h-full px-6">
      <div className="mb-6">
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Choose your playstyle</h2>
        <p className="text-[13px] text-gray-400 mt-1">How do you want to conquer the map?</p>
      </div>

      <div className="space-y-2.5">
        {options.map((opt, i) => {
          const selected = value === opt.id;
          const Icon = opt.icon;
          return (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: selected ? 1 : value ? 0.55 : 1, x: 0 }}
              transition={{ delay: i * 0.07, type: 'spring', damping: 22 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { onChange(opt.id); haptic('medium'); }}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border transition-all ${
                selected ? opt.selectedBg : 'bg-white border-gray-100'
              }`}
            >
              <div className={`w-11 h-11 rounded-xl ${selected ? opt.selectedBg : 'bg-gray-50'} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${opt.color}`} strokeWidth={1.8} />
              </div>
              <div className="text-left">
                <span className="text-[14px] font-bold text-gray-900 block">{opt.label}</span>
                <span className="text-[12px] text-gray-400">{opt.desc}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
