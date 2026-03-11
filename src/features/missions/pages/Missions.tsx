import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle, Zap } from 'lucide-react';
import {
  MISSION_TEMPLATES,
  generateBlueprint,
  GOAL_TO_CATEGORY,
  type GoalCategory,
  type Mission,
} from '../services/missions';
import { setDailyMissions, getTodaysMissions } from '../services/missionStore';
import { haptic } from '@shared/lib/haptics';
import { getProfile } from '@shared/services/profile';
import type { PlayerProfile } from '@shared/services/profile';

type CategoryTab = 'recommended' | GoalCategory;

const CATEGORY_TABS: {
  id: CategoryTab;
  label: string;
  emoji: string;
  activeColor: string;
  textColor: string;
  bg: string;
  border: string;
}[] = [
  { id: 'recommended', label: 'For You', emoji: '⭐', activeColor: 'bg-teal-500', textColor: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
  { id: 'weight_loss', label: 'Weight Loss', emoji: '🔥', activeColor: 'bg-orange-500', textColor: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  { id: 'endurance', label: 'Endurance', emoji: '💪', activeColor: 'bg-blue-500', textColor: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { id: 'speed', label: 'Speed', emoji: '⚡', activeColor: 'bg-yellow-500', textColor: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { id: 'territory', label: 'Territory', emoji: '🏴', activeColor: 'bg-purple-500', textColor: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  { id: 'explorer', label: 'Explorer', emoji: '🧭', activeColor: 'bg-emerald-500', textColor: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { id: 'all', label: 'All', emoji: '', activeColor: 'bg-gray-700', textColor: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
];

const GOAL_LABELS: Record<PlayerProfile['primaryGoal'], string> = {
  get_fit: 'Get Fit',
  lose_weight: 'Lose Weight',
  run_faster: 'Run Faster',
  explore: 'Explore',
  compete: 'Compete',
};

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
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [activeTab, setActiveTab] = useState<CategoryTab>('recommended');
  const [blueprintMissions, setBlueprintMissions] = useState<Mission[]>([]);
  const [blueprintApplied, setBlueprintApplied] = useState(false);

  useEffect(() => {
    getTodaysMissions().then(m => {
      if (m.length > 0) {
        setHasMissions(true);
        setSelected(new Set(m.map(x => x.title)));
      }
    });

    getProfile().then(p => {
      if (p) {
        setProfile(p);
        setBlueprintMissions(generateBlueprint(p.primaryGoal, p.missionDifficulty));
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

  const applyBlueprint = () => {
    haptic('medium');
    setSelected(new Set(blueprintMissions.map(m => m.title)));
    setBlueprintApplied(true);
    setTimeout(() => setBlueprintApplied(false), 2000);
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    haptic('medium');
    await setDailyMissions(Array.from(selected));
    navigate(-1);
  };

  const filteredTemplates = useMemo(() => {
    if (activeTab === 'all') return MISSION_TEMPLATES;
    if (activeTab === 'recommended') {
      const goalCat = profile?.primaryGoal ? GOAL_TO_CATEGORY[profile.primaryGoal] : null;
      return [...MISSION_TEMPLATES].sort((a, b) => {
        if (!goalCat) return 0;
        const aMatch = a.goalCategory === goalCat ? -1 : 0;
        const bMatch = b.goalCategory === goalCat ? -1 : 0;
        return aMatch - bMatch;
      });
    }
    return MISSION_TEMPLATES.filter(t => t.goalCategory === activeTab);
  }, [activeTab, profile]);

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const activeCatMeta = CATEGORY_TABS.find(t => t.id === activeTab) ?? CATEGORY_TABS[0];

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] pb-36">
      {/* Header */}
      <div
        className="sticky top-0 z-10 bg-[#FAFAFA]/90 dark:bg-[#0A0A0A]/90 backdrop-blur border-b border-gray-100 px-5 py-4 flex items-center gap-3"
        style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-gray-500" strokeWidth={2} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900">Daily Blueprint</h1>
          <p className="text-xs text-gray-400">Pick up to 3 challenges for today</p>
        </div>
        <span className="text-sm font-bold text-teal-600">{selected.size}/3</span>
      </div>

      <div className="px-5 pt-5">
        {/* Blueprint Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl overflow-hidden mb-6"
        >
          <div
            className="p-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0E7490 0%, #0891B2 100%)' }}
          >
            {/* Decorative rings */}
            <div className="pointer-events-none absolute -right-8 -top-8">
              {[80, 130, 180].map(size => (
                <div
                  key={size}
                  className="absolute rounded-full border border-white/10"
                  style={{
                    width: size,
                    height: size,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              ))}
            </div>

            {/* Header row */}
            <div className="relative z-10 flex items-center justify-between mb-1">
              <span className="text-white/70 text-[10px] uppercase tracking-[0.2em] font-semibold">
                Your Daily Blueprint
              </span>
              <span className="text-white/50 text-[10px]">{dateLabel}</span>
            </div>

            {/* Goal label */}
            <p className="relative z-10 text-white text-[15px] font-bold mb-4">
              Curated for your{' '}
              <span className="text-cyan-200">
                {profile ? GOAL_LABELS[profile.primaryGoal] : 'Running'}
              </span>{' '}
              goal
            </p>

            {/* Mission pills */}
            <div className="relative z-10 space-y-2 mb-4">
              {blueprintMissions.length > 0
                ? blueprintMissions.map((m, i) => (
                    <motion.div
                      key={m.title}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.08 }}
                      className="flex items-center gap-3 bg-white/15 backdrop-blur-sm rounded-2xl px-3 py-2.5"
                    >
                      <span className="text-lg">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{m.title}</p>
                        <p className="text-white/60 text-[10px] truncate">{m.description}</p>
                      </div>
                      <span className="text-cyan-200 text-[11px] font-bold shrink-0">
                        +{m.rewards.xp} XP
                      </span>
                    </motion.div>
                  ))
                : [0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="h-12 rounded-2xl bg-white/10 animate-pulse"
                    />
                  ))
              }
            </div>

            {/* Apply Blueprint button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={applyBlueprint}
              className="relative z-10 w-full py-3 rounded-2xl bg-white text-teal-700 text-sm font-bold
                         shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex items-center justify-center gap-2
                         active:scale-[0.98] transition-transform"
            >
              {blueprintApplied ? (
                <>
                  <CheckCircle className="w-4 h-4" strokeWidth={2.5} />
                  Blueprint Applied!
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" strokeWidth={2.5} />
                  Apply Blueprint
                </>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Category Tabs */}
        <div className="mb-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium mb-3">
            Browse by Category
          </p>
          <div
            className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {CATEGORY_TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => { setActiveTab(tab.id); haptic('light'); }}
                  className={`
                    flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold
                    whitespace-nowrap shrink-0 border transition-all duration-200
                    ${isActive
                      ? `${tab.activeColor} text-white border-transparent shadow-sm`
                      : 'bg-white text-gray-500 border-gray-100 shadow-sm'
                    }
                  `}
                >
                  {tab.emoji && <span className="text-sm">{tab.emoji}</span>}
                  {tab.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Mission Grid */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium mb-3">
            {activeTab === 'recommended'
              ? 'All Missions'
              : activeCatMeta.label}{' '}
            <span className="normal-case tracking-normal">
              ({filteredTemplates.length})
            </span>
          </p>

          <AnimatePresence mode="popLayout">
            {filteredTemplates.map((template, idx) => {
              const isSelected = selected.has(template.title);
              const isDisabled = !isSelected && selected.size >= 3;
              const catMeta = CATEGORY_TABS.find(t => t.id === template.goalCategory)
                ?? CATEGORY_TABS[CATEGORY_TABS.length - 1];

              return (
                <motion.button
                  key={template.title}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: idx * 0.03, duration: 0.2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => !isDisabled && toggle(template.title)}
                  className={`
                    w-full text-left bg-white rounded-2xl p-4 border shadow-sm mb-2.5
                    transition-all duration-200
                    ${isSelected
                      ? 'border-teal-400 shadow-[0_2px_12px_rgba(0,180,198,0.12)]'
                      : isDisabled
                      ? 'border-gray-100 opacity-40'
                      : 'border-gray-100'
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0
                      ${isSelected ? 'bg-teal-50' : catMeta.bg}
                    `}>
                      {template.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {template.title}
                        </span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${DIFFICULTY_COLORS[template.difficulty]}`}>
                          {template.difficulty}
                        </span>
                        {template.goalCategory && template.goalCategory !== 'all' && (
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${catMeta.bg} ${catMeta.textColor}`}>
                            {catMeta.emoji} {catMeta.label}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 mb-2">{template.description}</p>

                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-semibold text-teal-600">
                          +{template.rewards.xp} XP
                        </span>
                        <span className="text-[11px] font-semibold text-amber-500">
                          +{template.rewards.coins} coins
                        </span>
                        {template.rewards.diamonds && (
                          <span className="text-[11px] font-semibold text-purple-500">
                            +{template.rewards.diamonds} 💎
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle className="w-5 h-5 text-teal-500 shrink-0 mt-0.5" strokeWidth={2} />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>

          {filteredTemplates.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-14"
            >
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm text-gray-400">No missions in this category yet</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Save button */}
      {selected.size > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-0 left-0 right-0 p-5 bg-[#FAFAFA]/90 dark:bg-[#0A0A0A]/90 backdrop-blur border-t border-gray-100"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        >
          {/* Mini selection preview */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              {Array.from(selected).map(title => {
                const t = MISSION_TEMPLATES.find(m => m.title === title);
                return t ? (
                  <span key={title} className="text-xl" title={title}>{t.icon}</span>
                ) : null;
              })}
            </div>
            <span className="text-[11px] text-gray-400">{selected.size} of 3 chosen</span>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                       text-sm font-bold text-white shadow-[0_4px_16px_rgba(0,180,198,0.25)]
                       disabled:opacity-60 active:scale-[0.98] transition-transform"
          >
            {saving
              ? 'Saving…'
              : hasMissions
              ? `Update ${selected.size} Mission${selected.size !== 1 ? 's' : ''}`
              : `Set ${selected.size} Mission${selected.size !== 1 ? 's' : ''} for Today`
            }
          </button>
        </motion.div>
      )}
    </div>
  );
}
