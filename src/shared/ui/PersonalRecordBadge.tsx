import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';

interface PersonalRecordBadgeProps {
  type?: string;
  label: string;
  value: string;
  previousValue?: string;
}

export function PersonalRecordBadge({ label, value, previousValue }: PersonalRecordBadgeProps) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring' }}
      className="bg-amber-50 rounded-xl border border-amber-200 p-3 flex items-center gap-3"
    >
      <Trophy className="w-5 h-5 text-amber-500 flex-shrink-0" />

      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-amber-600 font-bold">
          New PR!
        </span>
        <span className="text-sm font-semibold text-gray-900">{label}</span>
        <span className="text-xs text-gray-600">{value}</span>
      </div>

      {previousValue && (
        <span className="text-[10px] text-amber-400 ml-auto flex-shrink-0 whitespace-nowrap">
          was {previousValue}
        </span>
      )}
    </motion.div>
  );
}
