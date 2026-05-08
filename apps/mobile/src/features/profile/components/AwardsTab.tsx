import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Medal, Footprints, Flame, Map, TrendingUp } from 'lucide-react-native';
import type { StoredRun } from '@shared/services/store';
import { useTheme, type AppColors } from '@theme';

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth: number }>;

interface AwardDef {
  id: string;
  section: 'Running' | 'Streaks' | 'Territory' | 'Levels';
  label: string;
  desc: string;
  Icon: IconComp;
  condition: (runs: StoredRun[], streakDays: number, territories: number, level: number) => boolean;
  progress: (runs: StoredRun[], streakDays: number, territories: number, level: number) => { current: number; target: number };
}

const AWARDS: AwardDef[] = [
  // Running
  {
    id: 'first-run', section: 'Running', label: 'First Steps', desc: 'Complete your first run', Icon: Footprints,
    condition: (runs) => runs.length >= 1,
    progress: (runs) => ({ current: Math.min(runs.length, 1), target: 1 }),
  },
  {
    id: 'five-k', section: 'Running', label: '5K Club', desc: 'Run 5 km in a single session', Icon: TrendingUp,
    condition: (runs) => runs.some(r => r.distanceMeters >= 5000),
    progress: (runs) => {
      const best = Math.max(0, ...runs.map(r => r.distanceMeters / 1000));
      return { current: Math.min(5, best), target: 5 };
    },
  },
  {
    id: 'ten-k', section: 'Running', label: '10K Warrior', desc: 'Run 10 km in a single session', Icon: TrendingUp,
    condition: (runs) => runs.some(r => r.distanceMeters >= 10000),
    progress: (runs) => {
      const best = Math.max(0, ...runs.map(r => r.distanceMeters / 1000));
      return { current: Math.min(10, best), target: 10 };
    },
  },
  {
    id: 'half-hero', section: 'Running', label: 'Half Hero', desc: 'Complete a half marathon', Icon: Medal,
    condition: (runs) => runs.some(r => r.distanceMeters >= 21097),
    progress: (runs) => {
      const best = Math.max(0, ...runs.map(r => r.distanceMeters / 1000));
      return { current: Math.min(21.1, best), target: 21.1 };
    },
  },
  // Streaks
  {
    id: 'on-fire', section: 'Streaks', label: 'On Fire', desc: '3-day running streak', Icon: Flame,
    condition: (_, streak) => streak >= 3,
    progress: (_, streak) => ({ current: Math.min(streak, 3), target: 3 }),
  },
  {
    id: 'week-warrior', section: 'Streaks', label: 'Week Warrior', desc: 'Run every day for a week', Icon: Flame,
    condition: (_, streak) => streak >= 7,
    progress: (_, streak) => ({ current: Math.min(streak, 7), target: 7 }),
  },
  {
    id: 'monthly-grind', section: 'Streaks', label: 'Monthly Grind', desc: 'Run every day for 30 days', Icon: Flame,
    condition: (_, streak) => streak >= 30,
    progress: (_, streak) => ({ current: Math.min(streak, 30), target: 30 }),
  },
  // Territory
  {
    id: 'zone-claimer', section: 'Territory', label: 'Zone Claimer', desc: 'Claim your first territory', Icon: Map,
    condition: (_, _s, territories) => territories >= 1,
    progress: (_, _s, territories) => ({ current: Math.min(territories, 1), target: 1 }),
  },
  {
    id: 'map-maker', section: 'Territory', label: 'Map Maker', desc: 'Own 10 zones at once', Icon: Map,
    condition: (_, _s, territories) => territories >= 10,
    progress: (_, _s, territories) => ({ current: Math.min(territories, 10), target: 10 }),
  },
  {
    id: 'conqueror', section: 'Territory', label: 'Conqueror', desc: 'Own 50 zones at once', Icon: Map,
    condition: (_, _s, territories) => territories >= 50,
    progress: (_, _s, territories) => ({ current: Math.min(territories, 50), target: 50 }),
  },
  // Levels
  {
    id: 'rising-star', section: 'Levels', label: 'Rising Star', desc: 'Reach level 5', Icon: TrendingUp,
    condition: (_, _s, _t, level) => level >= 5,
    progress: (_, _s, _t, level) => ({ current: Math.min(level, 5), target: 5 }),
  },
  {
    id: 'veteran', section: 'Levels', label: 'Veteran', desc: 'Reach level 20', Icon: TrendingUp,
    condition: (_, _s, _t, level) => level >= 20,
    progress: (_, _s, _t, level) => ({ current: Math.min(level, 20), target: 20 }),
  },
];

const SECTIONS: AwardDef['section'][] = ['Running', 'Streaks', 'Territory', 'Levels'];

interface Props {
  runs?: StoredRun[];
  streakDays?: number;
  totalTerritories?: number;
  level?: number;
}

export function AwardsTab({ runs = [], streakDays = 0, totalTerritories = 0, level = 1 }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);

  const evaluated = useMemo(() =>
    AWARDS.map(a => ({
      ...a,
      earned: a.condition(runs, streakDays, totalTerritories, level),
      prog: a.progress(runs, streakDays, totalTerritories, level),
    })),
    [runs, streakDays, totalTerritories, level],
  );

  const earnedCount = evaluated.filter(a => a.earned).length;
  const total = AWARDS.length;

  return (
    <View>
      <View style={ss.progressHeader}>
        <View style={ss.progressBarBg}>
          <View style={[ss.progressBarFill, { flex: earnedCount / total }]} />
          <View style={{ flex: 1 - earnedCount / total }} />
        </View>
        <Text style={ss.progressText}>
          {earnedCount} / {total} unlocked
        </Text>
      </View>

      {SECTIONS.map(section => {
        const sectionAwards = evaluated.filter(a => a.section === section);
        return (
          <View key={section} style={ss.sectionWrap}>
            <Text style={ss.sectionLabel}>{section}</Text>
            <View style={ss.grid}>
              {sectionAwards.map(award => (
                <View key={award.id} style={[ss.card, award.earned && ss.cardEarned]}>
                  <award.Icon
                    size={20}
                    color={award.earned ? '#D97706' : C.t3}
                    strokeWidth={1.5}
                  />
                  <Text style={[ss.cardTitle, award.earned && ss.cardTitleEarned]}>{award.label}</Text>
                  <Text style={ss.cardDesc}>{award.desc}</Text>
                  {!award.earned && (
                    <View style={ss.progressMini}>
                      <View style={[ss.progressMiniFill, { flex: award.prog.current / award.prog.target }]} />
                      <View style={{ flex: 1 - award.prog.current / award.prog.target }} />
                    </View>
                  )}
                  {!award.earned && (
                    <Text style={ss.progressMiniLabel}>
                      {typeof award.prog.current === 'number' && award.prog.current % 1 !== 0
                        ? award.prog.current.toFixed(1)
                        : award.prog.current} / {award.prog.target}
                    </Text>
                  )}
                  {award.earned && <Text style={ss.earnedCheck}>✓</Text>}
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    progressHeader: { marginBottom: 20 },
    progressBarBg: {
      height: 4, backgroundColor: C.mid, borderRadius: 2, overflow: 'hidden',
      flexDirection: 'row', marginBottom: 6,
    },
    progressBarFill: { height: 4, backgroundColor: C.red },
    progressText: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
    sectionWrap: { marginBottom: 20 },
    sectionLabel: {
      fontFamily: 'Barlow_500Medium', fontSize: 9, color: C.t3,
      letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    card: {
      width: '47%', backgroundColor: C.white, borderRadius: 14,
      borderWidth: 0.5, borderColor: C.border, padding: 14,
      alignItems: 'center', gap: 4,
    },
    cardEarned: { borderColor: '#D97706', backgroundColor: '#FFFBF2' },
    cardTitle: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: C.t2, textAlign: 'center' },
    cardTitleEarned: { fontFamily: 'Barlow_600SemiBold', color: C.black },
    cardDesc: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, textAlign: 'center', lineHeight: 14 },
    progressMini: {
      height: 3, width: '100%', backgroundColor: C.mid, borderRadius: 2,
      flexDirection: 'row', overflow: 'hidden', marginTop: 4,
    },
    progressMiniFill: { height: 3, backgroundColor: C.red },
    progressMiniLabel: { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3 },
    earnedCheck: { fontSize: 14, color: '#D97706', marginTop: 2 },
  });
}
