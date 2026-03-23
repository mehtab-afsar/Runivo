import { useState } from 'react';
import { motion } from 'framer-motion';
import { haptic } from '@shared/lib/haptics';

type PreferredDistance = 'short' | '5k' | '10k' | 'long';

interface Props {
  frequency: number;
  distance: PreferredDistance;
  onFrequencyChange: (days: number) => void;
  onDistanceChange: (d: PreferredDistance) => void;
  weeklyGoalKm: number;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DISTANCES: { id: PreferredDistance; label: string; sub: string; km: number }[] = [
  { id: 'short', label: '< 3 km',  sub: 'Short',  km: 2   },
  { id: '5k',    label: '3–5 km',  sub: 'Medium', km: 4   },
  { id: '10k',   label: '5–10 km', sub: 'Long',   km: 7.5 },
  { id: 'long',  label: '10 km+',  sub: 'Epic',   km: 12  },
];

function initDays(frequency: number): Set<number> {
  const step = 7 / frequency;
  return new Set(Array.from({ length: frequency }, (_, i) => Math.round(i * step) % 7));
}

export default function WeeklyPlanStep({ frequency, distance, onFrequencyChange, onDistanceChange, weeklyGoalKm }: Props) {
  const [selectedDays, setSelectedDays] = useState<Set<number>>(() => initDays(frequency));
  const distObj = DISTANCES.find(d => d.id === distance)!;

  const toggleDay = (i: number) => {
    haptic('light');
    const next = new Set(selectedDays);
    if (next.has(i)) {
      if (next.size === 1) return; // keep at least 1 day
      next.delete(i);
    } else {
      next.add(i);
    }
    setSelectedDays(next);
    onFrequencyChange(next.size);
  };

  return (
    <div className="flex flex-col h-full px-6">
      <div className="mb-6">
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Set your weekly rhythm</h2>
        <p className="text-[13px] text-gray-400 mt-1">Pick the days you want to run</p>
      </div>

      {/* ── Day picker ── */}
      <div className="mb-5">
        <div className="flex gap-1.5 justify-between">
          {DAYS.map((d, i) => {
            const on = selectedDays.has(i);
            return (
              <motion.button
                key={i}
                animate={{ scale: on ? 1.08 : 1 }}
                transition={{ type: 'spring', damping: 20 }}
                whileTap={{ scale: 0.88 }}
                onClick={() => toggleDay(i)}
                className="flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-2xl border transition-all"
                style={on ? {
                  background: 'linear-gradient(135deg,#E8435A,#D03A4F)',
                  borderColor: 'transparent',
                  boxShadow: '0 3px 10px rgba(232,67,90,0.22)',
                } : {
                  backgroundColor: '#F9FAFB',
                  borderColor: '#F3F4F6',
                }}
              >
                <span className="text-[12px] font-bold" style={{ color: on ? '#fff' : '#9CA3AF' }}>
                  {d[0]}
                </span>
                <span className="text-[9px] font-medium" style={{ color: on ? 'rgba(255,255,255,0.7)' : '#D1D5DB' }}>
                  {d.slice(1)}
                </span>
              </motion.button>
            );
          })}
        </div>
        <p className="text-center mt-3 text-[13px] text-gray-400">
          <span className="font-bold text-gray-900">{selectedDays.size}</span> day{selectedDays.size !== 1 ? 's' : ''} per week
        </p>
      </div>

      {/* ── Distance per run ── */}
      <div className="mb-6">
        <span className="text-[11px] text-gray-400 uppercase tracking-wider font-medium block mb-3">
          Typical run distance
        </span>
        <div className="grid grid-cols-4 gap-2">
          {DISTANCES.map(d => {
            const sel = distance === d.id;
            return (
              <button
                key={d.id}
                onClick={() => { onDistanceChange(d.id); haptic('light'); }}
                className="flex flex-col items-center py-3 rounded-xl border transition-all"
                style={sel ? {
                  background: 'linear-gradient(135deg,#E8435A,#D03A4F)',
                  borderColor: 'transparent',
                  boxShadow: '0 4px 14px rgba(232,67,90,0.2)',
                } : {
                  backgroundColor: '#F9FAFB',
                  borderColor: '#F3F4F6',
                }}
              >
                <span className="text-[13px] font-bold leading-tight" style={{ color: sel ? '#fff' : '#374151' }}>
                  {d.label}
                </span>
                <span className="text-[10px] mt-0.5" style={{ color: sel ? 'rgba(255,255,255,0.7)' : '#9CA3AF' }}>
                  {d.sub}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Weekly goal summary ── */}
      <motion.div
        key={`${selectedDays.size}-${distance}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 24 }}
        className="rounded-2xl px-5 py-4 flex items-center gap-4"
        style={{ background: 'linear-gradient(135deg,rgba(232,67,90,0.07),rgba(208,58,79,0.04))', border: '1px solid rgba(232,67,90,0.12)' }}
      >
        <div className="flex flex-col flex-1">
          <span className="text-[11px] text-[#E8435A] font-semibold uppercase tracking-wider mb-0.5">Weekly goal</span>
          <span className="text-2xl font-extrabold text-gray-900 leading-none">
            ~{weeklyGoalKm} <span className="text-base font-semibold text-gray-400">km</span>
          </span>
          <span className="text-[12px] text-gray-400 mt-1">
            {selectedDays.size} run{selectedDays.size !== 1 ? 's' : ''} × ~{distObj.km} km each
          </span>
        </div>
        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-2xl" style={{ background: 'rgba(232,67,90,0.1)' }}>
          <span className="text-xl">🏃</span>
        </div>
      </motion.div>
    </div>
  );
}
