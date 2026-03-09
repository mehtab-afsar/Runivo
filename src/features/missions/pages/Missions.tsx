import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { MISSION_TEMPLATES } from '../services/missions';
import { setDailyMissions, getTodaysMissions } from '../services/missionStore';
import { haptic } from '@shared/lib/haptics';

const DIFFICULTY_COLORS = {
  easy:   'bg-green-50 border-green-200 text-green-600',
  medium: 'bg-amber-50 border-amber-200 text-amber-600',
  hard:   'bg-red-50 border-red-200 text-red-600',
};

export default function Missions() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [hasMissions, setHasMissions] = useState(false);

  useEffect(() => {
    getTodaysMissions().then(m => {
      if (m.length > 0) {
        setHasMissions(true);
        setSelected(new Set(m.map(x => x.title)));
      }
    });
  }, []);

  const toggle = (title: string) => {
    haptic('light');
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else if (next.size < 3) {
        next.add(title);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    haptic('medium');
    await setDailyMissions(Array.from(selected));
    navigate(-1);
  };

  const groups = ['easy', 'medium', 'hard'] as const;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#FAFAFA]/90 backdrop-blur border-b border-gray-100 px-5 py-4 flex items-center gap-3"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-gray-500" strokeWidth={2} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900">Set Daily Mission</h1>
          <p className="text-xs text-gray-400">Pick up to 3 challenges for today</p>
        </div>
        <span className="text-stat text-sm font-bold text-teal-600">{selected.size}/3</span>
      </div>

      <div className="px-5 pt-5 space-y-6">
        {groups.map(diff => (
          <div key={diff}>
            <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium mb-3 px-1">
              {diff}
            </p>
            <div className="space-y-2.5">
              {MISSION_TEMPLATES.filter(t => t.difficulty === diff).map(template => {
                const isSelected = selected.has(template.title);
                const isDisabled = !isSelected && selected.size >= 3;
                return (
                  <motion.button
                    key={template.title}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => !isDisabled && toggle(template.title)}
                    className={`w-full text-left bg-white rounded-2xl p-4 border shadow-sm transition-all ${
                      isSelected
                        ? 'border-teal-400 shadow-[0_2px_12px_rgba(0,180,198,0.1)]'
                        : isDisabled
                        ? 'border-gray-100 opacity-40'
                        : 'border-gray-100 active:scale-[0.98]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl w-9 h-9 flex items-center justify-center flex-shrink-0">
                        {template.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-gray-900">{template.title}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${DIFFICULTY_COLORS[diff]}`}>
                            {diff}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">{template.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-stat text-[11px] text-teal-600">+{template.rewards.xp} XP</span>
                          <span className="text-stat text-[11px] text-amber-500">+{template.rewards.coins} coins</span>
                          {template.rewards.diamonds && (
                            <span className="text-stat text-[11px] text-purple-500">+{template.rewards.diamonds} diamonds</span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" strokeWidth={2} />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      {selected.size > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-0 left-0 right-0 p-5 bg-[#FAFAFA]/90 backdrop-blur border-t border-gray-100"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                       text-sm font-bold text-white shadow-[0_4px_16px_rgba(0,180,198,0.25)]
                       disabled:opacity-60 active:scale-[0.98] transition-transform"
          >
            {saving ? 'Saving…' : hasMissions ? `Update ${selected.size} Mission${selected.size !== 1 ? 's' : ''}` : `Set ${selected.size} Mission${selected.size !== 1 ? 's' : ''} for Today`}
          </button>
        </motion.div>
      )}
    </div>
  );
}
