import { motion } from 'framer-motion';
import { Ruler, Bell } from 'lucide-react';
import { haptic } from '@shared/lib/haptics';

interface Props {
  distanceUnit: 'km' | 'mi';
  notifications: boolean;
  onUnitChange: (u: 'km' | 'mi') => void;
  onNotificationsChange: (v: boolean) => void;
}

export default function PreferencesStep({ distanceUnit, notifications, onUnitChange, onNotificationsChange }: Props) {
  return (
    <div className="flex flex-col h-full px-6">
      <div className="mb-6">
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Quick preferences</h2>
        <p className="text-[13px] text-gray-400 mt-1">Almost done</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
      >
        {/* Distance units */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-50">
          <Ruler className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
          <span className="flex-1 text-[14px] text-gray-900 font-medium">Distance units</span>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['km', 'mi'] as const).map(u => (
              <button
                key={u}
                onClick={() => { onUnitChange(u); haptic('light'); }}
                className="px-4 py-1.5 rounded-md text-[12px] font-semibold transition"
                style={distanceUnit === u ? {
                  backgroundColor: '#FFFFFF',
                  color: '#D93518',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                } : { color: '#9CA3AF' }}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="flex items-center gap-3 px-4 py-4">
          <Bell className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
          <span className="flex-1 text-[14px] text-gray-900 font-medium">Run reminders</span>
          <button
            onClick={() => { onNotificationsChange(!notifications); haptic('light'); }}
            className="w-11 h-6 rounded-full transition-colors"
            style={{ backgroundColor: notifications ? '#D93518' : '#E5E7EB' }}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${notifications ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
