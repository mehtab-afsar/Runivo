import { useState } from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { haptic } from '@shared/lib/haptics';

export type Gender = 'male' | 'female' | 'other';

interface Props {
  age: number;
  gender: Gender | '';
  heightCm: number;
  weightKg: number;
  onChange: (
    field: 'age' | 'gender' | 'heightCm' | 'weightKg',
    value: number | Gender | '',
  ) => void;
}

function cmToFtIn(cm: number): string {
  const totalIn = Math.round(cm / 2.54);
  return `${Math.floor(totalIn / 12)}'${totalIn % 12}"`;
}

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'male',   label: 'Male'   },
  { id: 'female', label: 'Female' },
  { id: 'other',  label: 'Other'  },
];

export default function BiometricsStep({ age, gender, heightCm, weightKg, onChange }: Props) {
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');

  const displayWeight = weightUnit === 'lbs'
    ? (weightKg ? String(Math.round(weightKg * 2.2046)) : '')
    : (weightKg ? String(weightKg) : '');

  const handleWeightInput = (val: string) => {
    const n = parseFloat(val) || 0;
    const kg = weightUnit === 'lbs' ? Math.round((n / 2.2046) * 10) / 10 : n;
    onChange('weightKg', kg);
  };

  return (
    <div className="flex flex-col h-full px-6 overflow-y-auto pb-4">
      <div className="mb-6">
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Your body stats</h2>
        <p className="text-[13px] text-gray-400 mt-1">Used for accurate calorie &amp; pace calculations</p>
      </div>

      <div className="space-y-5">
        {/* Gender */}
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pl-1 block mb-2">
            Biological sex
          </label>
          <div className="flex gap-2">
            {GENDERS.map((g, i) => (
              <motion.button
                key={g.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { onChange('gender', g.id); haptic('light'); }}
                className={`flex-1 py-3.5 rounded-2xl text-[13px] font-semibold border transition-all ${
                  gender === g.id
                    ? 'bg-teal-500 border-teal-500 text-white'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}
              >
                {g.label}
              </motion.button>
            ))}
          </div>
          <p className="text-[10px] text-gray-300 mt-1.5 pl-1">Used only for metabolic rate calculation</p>
        </div>

        {/* Age */}
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pl-1 block mb-2">Age</label>
          <div className="flex items-center gap-4 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-3.5">
            <button
              onClick={() => { if (age > 10) { onChange('age', age - 1); haptic('light'); } }}
              className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 shadow-sm active:scale-95 transition-transform"
            >
              <Minus className="w-4 h-4" />
            </button>
            <div className="flex-1 text-center">
              <span className="text-2xl font-bold text-gray-900">{age || '—'}</span>
              <span className="text-[13px] text-gray-400 ml-2">years old</span>
            </div>
            <button
              onClick={() => { onChange('age', (age || 17) + 1); haptic('light'); }}
              className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 shadow-sm active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Height — always cm, ft/in shown as hint */}
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pl-1 block mb-2">Height</label>
          <div className="flex items-center bg-gray-50 rounded-2xl border border-gray-200 px-4 py-3.5 gap-3">
            <input
              type="number"
              inputMode="numeric"
              value={heightCm || ''}
              onChange={e => onChange('heightCm', parseInt(e.target.value) || 0)}
              placeholder="175"
              min={100}
              max={250}
              className="flex-1 bg-transparent text-2xl font-bold text-gray-900 outline-none w-0 min-w-0"
            />
            <span className="text-[13px] text-gray-400 font-medium shrink-0">cm</span>
            {heightCm > 100 && (
              <span className="text-[12px] text-teal-500 font-medium shrink-0">{cmToFtIn(heightCm)}</span>
            )}
          </div>
        </div>

        {/* Weight */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider pl-1">Weight</label>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {(['kg', 'lbs'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => { setWeightUnit(u); haptic('light'); }}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold transition ${
                    weightUnit === u ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center bg-gray-50 rounded-2xl border border-gray-200 px-4 py-3.5 gap-3">
            <input
              type="number"
              inputMode="decimal"
              value={displayWeight}
              onChange={e => handleWeightInput(e.target.value)}
              placeholder={weightUnit === 'kg' ? '70' : '154'}
              min={weightUnit === 'kg' ? 30 : 66}
              step={weightUnit === 'kg' ? 0.5 : 1}
              className="flex-1 bg-transparent text-2xl font-bold text-gray-900 outline-none w-0 min-w-0"
            />
            <span className="text-[13px] text-gray-400 font-medium shrink-0">{weightUnit}</span>
            {weightKg > 0 && (
              <span className="text-[12px] text-teal-500 font-medium shrink-0">
                {weightUnit === 'kg'
                  ? `${Math.round(weightKg * 2.2046)} lbs`
                  : `${weightKg} kg`}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
