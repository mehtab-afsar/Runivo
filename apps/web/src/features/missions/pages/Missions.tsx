import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Check, Plus, Navigation, Shield,
  Map as MapIcon, TrendingUp, Flame, Zap,
} from 'lucide-react';
import {
  MISSION_TEMPLATES,
  generateBlueprint,
  GOAL_TO_CATEGORY,
  type GoalCategory,
  type MissionType,
} from '../services/missions';
import { setDailyMissions, getTodaysMissions } from '../services/missionStore';
import { haptic } from '@shared/lib/haptics';
import { getProfile } from '@shared/services/profile';
import type { PlayerProfile } from '@shared/services/profile';

// ── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  pageBg:  '#EDEAE5',
  stone:   '#F0EDE8',
  mid:     '#E8E4DF',
  border:  '#DDD9D4',
  surface: '#F8F6F3',
  black:   '#0A0A0A',
  t2:      '#6B6B6B',
  t3:      '#ADADAD',
} as const;

// Mission type → Lucide icon
const TYPE_ICON: Record<string, typeof TrendingUp> = {
  run_distance:       TrendingUp,
  claim_territories:  Navigation,
  fortify_territories: Shield,
  explore_new_hexes:  MapIcon,
  run_in_enemy_zone:  Zap,
  capture_enemy:      Shield,
  speed_run:          TrendingUp,
  run_streak:         Flame,
};

// Difficulty styles on white card
const DIFF_CARD = {
  easy:   { bg: '#EDF7F2', fg: '#1A6B40' },
  medium: { bg: '#FDF6E8', fg: '#9E6800' },
  hard:   { bg: '#FEF0EE', fg: '#D93518' },
} as const;

// Difficulty styles on black (blueprint card)
const DIFF_BP = {
  easy:   { bg: 'rgba(26,107,64,0.3)',  fg: '#6DE8A8' },
  medium: { bg: 'rgba(158,104,0,0.3)',  fg: '#FAC75A' },
  hard:   { bg: 'rgba(217,53,24,0.35)', fg: '#FF8B72' },
} as const;

// Category tab definitions
type TabId = 'recommended' | GoalCategory;
const TABS: { id: TabId; label: string }[] = [
  { id: 'recommended', label: 'For You' },
  { id: 'weight_loss', label: 'Weight Loss' },
  { id: 'endurance',   label: 'Endurance' },
  { id: 'speed',       label: 'Speed' },
  { id: 'territory',   label: 'Territory' },
  { id: 'explorer',    label: 'Explorer' },
  { id: 'all',         label: 'All' },
];

// Category display labels (for badge)
const CAT_LABELS: Record<string, string> = {
  weight_loss: 'Weight Loss',
  endurance:   'Endurance',
  speed:       'Speed',
  territory:   'Territory',
  explorer:    'Explorer',
  all:         'All',
};

// Goal labels (for blueprint kicker)
const GOAL_LABELS: Record<PlayerProfile['primaryGoal'], string> = {
  get_fit:    'Get Fit',
  lose_weight: 'Lose Weight',
  run_faster: 'Run Faster',
  explore:    'Explore',
  compete:    'Compete',
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function Missions() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('recommended');
  const [blueprintMissions, setBlueprintMissions] = useState<ReturnType<typeof generateBlueprint>>([]);
  const [applyPressed, setApplyPressed] = useState(false);

  useEffect(() => {
    getTodaysMissions().then(m => {
      if (m.length > 0) setSelected(new Set(m.map(x => x.title)));
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
    const titles = blueprintMissions.map(m => m.title);
    setSelected(new Set(titles));
    setApplyPressed(true);
    setTimeout(() => setApplyPressed(false), 100);
    setTimeout(async () => {
      await setDailyMissions(titles);
      navigate(-1);
    }, 400);
  };

  const handleSave = async () => {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    haptic('medium');
    await setDailyMissions(Array.from(selected));
    navigate(-1);
  };

  // Filtered + sorted (selected first) templates
  const filteredTemplates = useMemo(() => {
    let list: typeof MISSION_TEMPLATES;
    if (activeTab === 'all') {
      list = MISSION_TEMPLATES;
    } else if (activeTab === 'recommended') {
      const goalCat = profile?.primaryGoal ? GOAL_TO_CATEGORY[profile.primaryGoal] : null;
      list = [...MISSION_TEMPLATES].sort((a, b) => {
        if (!goalCat) return 0;
        return (b.goalCategory === goalCat ? 1 : 0) - (a.goalCategory === goalCat ? 1 : 0);
      });
    } else {
      list = MISSION_TEMPLATES.filter(t => t.goalCategory === activeTab);
    }
    const sel   = list.filter(t => selected.has(t.title));
    const unsel = list.filter(t => !selected.has(t.title));
    return [...sel, ...unsel];
  }, [activeTab, profile, selected]);

  // Date label "Mon · Mar 17"
  const today = new Date();
  const weekday  = today.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dateLabel = `${weekday} · ${monthDay}`;

  // Selected missions for save bar slots
  const selectedMissions = Array.from(selected)
    .map(title => MISSION_TEMPLATES.find(t => t.title === title))
    .filter(Boolean) as (typeof MISSION_TEMPLATES)[0][];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, paddingBottom: 96 }}>

      {/* ── Page Header ── */}
      <div style={{
        background: 'white',
        padding: '0 20px',
        borderBottom: `0.5px solid ${T.border}`,
        paddingTop: 'max(14px, env(safe-area-inset-top))',
      }}>
        {/* Top row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 14,
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: T.surface, border: `0.5px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', outline: 'none',
            }}
          >
            <ChevronLeft size={13} color={T.black} strokeWidth={2} />
          </button>

          <span style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 22,
            fontWeight: 400,
            color: T.black,
          }}>
            Missions
          </span>

          <span style={{
            fontFamily: "'Barlow', sans-serif",
            fontSize: 11, fontWeight: 300, color: T.t3,
          }}>
            {dateLabel}
          </span>
        </div>

        {/* Category tabs */}
        <div
          style={{ display: 'flex', gap: 6, paddingBottom: 14, overflowX: 'auto' }}
          className="scrollbar-none"
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); haptic('light'); }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 2,
                  fontSize: 11, fontWeight: 500,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: isActive ? T.black : T.surface,
                  border: `0.5px solid ${isActive ? T.black : T.border}`,
                  color: isActive ? 'white' : T.t3,
                  cursor: 'pointer', outline: 'none',
                  flexShrink: 0,
                  transition: 'background 120ms, color 120ms, border-color 120ms',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Daily Blueprint Card ── */}
      <div style={{ background: 'white', padding: '18px 20px', marginBottom: 1 }}>
        {/* Eyebrow */}
        <div style={{
          fontSize: 9, fontWeight: 400,
          textTransform: 'uppercase', letterSpacing: '0.12em',
          color: T.t3, marginBottom: 8,
        }}>
          Daily blueprint
        </div>

        {/* Black inner card */}
        <div style={{ background: T.black, borderRadius: 12, padding: 16, marginBottom: 12 }}>
          {/* Kicker */}
          <div style={{
            fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.45)', marginBottom: 6,
          }}>
            Curated for your {profile ? GOAL_LABELS[profile.primaryGoal] : 'Running'} goal
          </div>

          {/* Title */}
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 17, fontWeight: 400,
            color: 'white', lineHeight: 1.2,
            marginBottom: 12,
          }}>
            Today's optimal mission set
          </div>

          {/* 3 mission preview rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {blueprintMissions.length > 0
              ? blueprintMissions.slice(0, 3).map((m, i) => {
                  const Icon = TYPE_ICON[m.type as MissionType] ?? TrendingUp;
                  const dStyle = DIFF_BP[m.difficulty];
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                        background: 'rgba(255,255,255,0.10)',
                        border: '0.5px solid rgba(255,255,255,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={14} color="rgba(255,255,255,0.8)" strokeWidth={1.8} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 400, color: 'white', lineHeight: 1.2 }}>{m.title}</div>
                        <div style={{ fontSize: 10, fontWeight: 300, color: 'rgba(255,255,255,0.5)' }}>+{m.rewards.xp} XP</div>
                      </div>
                      <div style={{
                        padding: '2px 6px', borderRadius: 2,
                        fontSize: 9, fontWeight: 500, textTransform: 'uppercase',
                        background: dStyle.bg, color: dStyle.fg,
                        flexShrink: 0,
                      }}>
                        {m.difficulty}
                      </div>
                    </div>
                  );
                })
              : [0, 1, 2].map(i => (
                  <div key={i} style={{
                    height: 40, borderRadius: 6,
                    background: 'rgba(255,255,255,0.08)',
                  }} />
                ))}
          </div>

          {/* Apply button */}
          <motion.button
            animate={{ scale: applyPressed ? 0.97 : 1 }}
            transition={{ duration: 0.1 }}
            onClick={applyBlueprint}
            style={{
              width: '100%', padding: 11,
              borderRadius: 6,
              background: 'white', border: 'none',
              fontSize: 12, fontWeight: 500,
              color: T.black,
              textTransform: 'uppercase', letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              cursor: 'pointer', outline: 'none',
            }}
          >
            <Check size={13} color={T.black} strokeWidth={2} />
            Apply Blueprint
          </motion.button>
        </div>
      </div>

      {/* ── Section Divider ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 20px 8px',
        background: T.stone,
      }}>
        <span style={{
          fontSize: 9, fontWeight: 400,
          textTransform: 'uppercase', letterSpacing: '0.12em',
          color: T.t3,
        }}>
          All missions
        </span>
        <span style={{
          fontFamily: "'Barlow', sans-serif",
          fontSize: 10, fontWeight: 300, color: T.t3,
        }}>
          {selected.size} / 3 selected
        </span>
      </div>

      {/* ── Mission List ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: T.mid }}>
        {filteredTemplates.map(template => {
          const isSelected  = selected.has(template.title);
          const isDisabled  = !isSelected && selected.size >= 3;
          const Icon        = TYPE_ICON[template.type as MissionType] ?? TrendingUp;
          const diffStyle   = DIFF_CARD[template.difficulty];
          const catLabel    = template.goalCategory ? CAT_LABELS[template.goalCategory] : null;
          return (
            <div
              key={template.title}
              onClick={() => !isDisabled && toggle(template.title)}
              style={{
                background: isSelected ? T.surface : 'white',
                padding: '14px 18px',
                cursor: isDisabled ? 'default' : 'pointer',
                opacity: isDisabled ? 0.4 : 1,
                transition: 'opacity 200ms, background 150ms',
              }}
            >
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                {/* Icon box */}
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: isSelected ? T.black : T.stone,
                  border: `0.5px solid ${isSelected ? T.black : T.mid}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 150ms, border-color 150ms',
                }}>
                  <Icon
                    size={16}
                    color={isSelected ? 'white' : T.t2}
                    strokeWidth={isSelected ? 2 : 1.8}
                  />
                </div>

                {/* Meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 13, fontWeight: 500, color: T.black,
                    marginBottom: 4, lineHeight: 1.2,
                  }}>
                    {template.title}
                  </div>
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '2px 7px', borderRadius: 2,
                      fontSize: 9, fontWeight: 500, textTransform: 'uppercase',
                      background: diffStyle.bg, color: diffStyle.fg,
                    }}>
                      {template.difficulty}
                    </span>
                    {catLabel && catLabel !== 'All' && (
                      <span style={{
                        padding: '2px 7px', borderRadius: 2,
                        fontSize: 9, fontWeight: 400,
                        background: T.stone, color: T.t3,
                      }}>
                        {catLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Check circle (selected) */}
                {isSelected && (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: T.black, flexShrink: 0, marginTop: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={11} color="white" strokeWidth={2.5} />
                  </div>
                )}
              </div>

              {/* Description */}
              <div style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 11, fontWeight: 300, color: T.t2,
                lineHeight: 1.5, marginBottom: 10,
              }}>
                {template.description}
              </div>

              {/* Rewards row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* XP */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 400, color: T.black }}>+{template.rewards.xp}</span>
                  <span style={{ fontSize: 10, fontWeight: 300, color: T.t3 }}>XP</span>
                </div>
                <div style={{ width: 1, height: 12, background: T.mid, flexShrink: 0 }} />
                {/* Coins */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 400, color: T.black }}>+{template.rewards.coins}</span>
                  <span style={{ fontSize: 10, fontWeight: 300, color: T.t3 }}>coins</span>
                </div>
              </div>
            </div>
          );
        })}

        {filteredTemplates.length === 0 && (
          <div style={{ background: 'white', padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 300, color: T.t3 }}>No missions in this category</p>
          </div>
        )}
      </div>

      {/* Stone spacer */}
      <div style={{ height: 12, background: T.stone }} />

      {/* ── Sticky Save Bar ── */}
      {selected.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          background: 'white',
          borderTop: `0.5px solid ${T.border}`,
          padding: '12px 20px',
          paddingBottom: 'max(22px, calc(env(safe-area-inset-bottom) + 12px))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* 3 slot icons */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {[0, 1, 2].map(i => {
                const mission = selectedMissions[i];
                const Icon = mission
                  ? (TYPE_ICON[mission.type as MissionType] ?? TrendingUp)
                  : Plus;
                const filled = !!mission;
                return (
                  <div
                    key={i}
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      border: '2px solid white',
                      background: filled ? T.black : T.stone,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginLeft: i === 0 ? 0 : -6,
                      position: 'relative',
                      zIndex: 3 - i,
                    }}
                  >
                    <Icon
                      size={14}
                      color={filled ? 'white' : T.t3}
                      strokeWidth={filled ? 2 : 1.8}
                    />
                  </div>
                );
              })}
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1, padding: 13,
                borderRadius: 3,
                background: T.black, border: 'none',
                color: 'white',
                fontSize: 12, fontWeight: 500,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                cursor: saving ? 'default' : 'pointer',
                outline: 'none',
                opacity: saving ? 0.6 : 1,
                transition: 'opacity 150ms',
              }}
            >
              {saving
                ? 'Saving…'
                : selected.size === 3
                ? 'Set 3 missions for today'
                : `Set ${selected.size} mission${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
