import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { StoredRun } from '@shared/services/store';
import { AWARD_DEFINITIONS } from '@shared/constants/awards';
import type { AwardCategory, AwardId } from '@shared/types/game';
import { useTheme, Fonts, type AppColors } from '@theme';

const CATEGORIES: { key: AwardCategory; label: string }[] = [
  { key: 'territory', label: 'Territory' },
  { key: 'distance',  label: 'Distance' },
  { key: 'streak',    label: 'Streak' },
  { key: 'pace',      label: 'Pace' },
];

const PROGRESS_TARGETS: Partial<Record<AwardId, number>> = {
  km_100:      100,
  km_500:      500,
  km_1000:     1000,
  monthly_100: 100,
};

interface Props {
  earnedAwards: { awardId: string; unlockedAt: string }[];
  totalKm: number;
  streakDays: number;
  totalTerritoriesClaimed: number;
  paceTotalEarned: number;
  runs: StoredRun[];
}

export function AwardsTab({
  earnedAwards, totalKm, runs,
}: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  const earnedSet = useMemo(
    () => new Map(earnedAwards.map(a => [a.awardId, a.unlockedAt])),
    [earnedAwards],
  );

  const allAwardIds = Object.keys(AWARD_DEFINITIONS) as AwardId[];
  const earnedCount = allAwardIds.filter(id => earnedSet.has(id)).length;
  const total = allAwardIds.length;

  const monthKm = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return runs.filter(r => r.startTime >= monthStart.getTime()).reduce((sum, r) => sum + r.distanceMeters / 1000, 0);
  }, [runs]);

  const getProgress = (id: AwardId): { current: number; target: number } | null => {
    const target = PROGRESS_TARGETS[id];
    if (!target) return null;
    const current = id === 'monthly_100' ? monthKm : totalKm;
    return { current: Math.min(current, target), target };
  };

  return (
    <View>
      <View style={s.progressHeader}>
        <View style={s.progressBarBg}>
          <View style={[s.progressBarFill, { flex: earnedCount / Math.max(total, 1) }]} />
          <View style={{ flex: 1 - earnedCount / Math.max(total, 1) }} />
        </View>
        <Text style={s.progressText}>{earnedCount} / {total} unlocked</Text>
      </View>

      {CATEGORIES.map(cat => {
        const awards = allAwardIds.filter(id => AWARD_DEFINITIONS[id].category === cat.key);
        return (
          <View key={cat.key} style={s.section}>
            <Text style={s.sectionLabel}>{cat.label}</Text>
            <View style={s.grid}>
              {awards.map(id => {
                const def = AWARD_DEFINITIONS[id];
                const isEarned = earnedSet.has(id);
                const unlockedAt = earnedSet.get(id);
                const progress = !isEarned ? getProgress(id) : null;

                return (
                  <View key={id} style={[s.card, isEarned && s.cardEarned]}>
                    <Text style={[s.cardIcon, !isEarned && s.cardIconLocked]}>
                      {isEarned ? def.icon : '🔒'}
                    </Text>
                    <Text style={[s.cardTitle, isEarned && s.cardTitleEarned]} numberOfLines={1}>
                      {def.title}
                    </Text>
                    <Text style={s.cardDesc} numberOfLines={2}>{def.description}</Text>
                    {isEarned && unlockedAt ? (
                      <Text style={s.cardDate}>
                        {new Date(unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    ) : null}
                    {!isEarned && progress ? (
                      <>
                        <View style={s.progressMini}>
                          <View style={[s.progressMiniFill, { flex: progress.current / progress.target }]} />
                          <View style={{ flex: 1 - progress.current / progress.target }} />
                        </View>
                        <Text style={s.progressMiniLabel}>
                          {progress.current.toFixed(0)} / {progress.target} km
                        </Text>
                      </>
                    ) : null}
                  </View>
                );
              })}
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
    progressBarBg: { height: 4, backgroundColor: C.mid, borderRadius: 2, overflow: 'hidden', flexDirection: 'row', marginBottom: 6 },
    progressBarFill: { height: 4, backgroundColor: C.red },
    progressText: { fontFamily: Fonts.regular, fontSize: 11, color: C.t2 },

    section: { marginBottom: 20 },
    sectionLabel: { fontFamily: Fonts.medium, fontSize: 13, color: C.black, marginBottom: 10 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

    card: { width: '47%', backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 16, alignItems: 'center', gap: 6 },
    cardEarned: { borderColor: C.gold, backgroundColor: C.amberBg },

    cardIcon: { fontSize: 32 },
    cardIconLocked: { opacity: 0.35 },

    cardTitle: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, textAlign: 'center' },
    cardTitleEarned: { fontFamily: Fonts.semiBold, color: C.black },
    cardDesc: { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, textAlign: 'center', lineHeight: 15 },
    cardDate: { fontFamily: Fonts.regular, fontSize: 10, color: C.gold, marginTop: 2 },

    progressMini: { height: 3, width: '100%', backgroundColor: C.mid, borderRadius: 2, flexDirection: 'row', overflow: 'hidden', marginTop: 4 },
    progressMiniFill: { height: 3, backgroundColor: C.red },
    progressMiniLabel: { fontFamily: Fonts.regular, fontSize: 10, color: C.t3 },
  });
}
