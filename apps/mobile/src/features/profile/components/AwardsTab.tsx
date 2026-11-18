import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import type { StoredRun } from '@shared/services/store';
import { AWARD_DEFINITIONS, AWARD_PROGRESS_TARGETS } from '@shared/constants/awards';
import type { AwardCategory, AwardId } from '@shared/types/game';
import { GlyphBadge } from '@mobile/shared/icons';
import { useTheme, Fonts, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Pace excluded on purpose — sub_5/sub_4_30 are confirmed unearnable (nothing
// writes the best-pace data they'd check against). Not shown locked, not
// shown at all, until a real data path exists.
const CATEGORIES: { key: AwardCategory; label: string }[] = [
  { key: 'territory', label: 'Territory' },
  { key: 'distance',  label: 'Distance' },
  { key: 'streak',    label: 'Streak' },
];

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
  const navigation = useNavigation<Nav>();

  const earnedSet = useMemo(
    () => new Map(earnedAwards.map(a => [a.awardId, a.unlockedAt])),
    [earnedAwards],
  );

  const allAwardIds = (Object.keys(AWARD_DEFINITIONS) as AwardId[]).filter(
    id => AWARD_DEFINITIONS[id].category !== 'pace',
  );
  const earnedCount = allAwardIds.filter(id => earnedSet.has(id)).length;
  const total = allAwardIds.length;

  const monthKm = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return runs.filter(r => r.startTime >= monthStart.getTime()).filter(r => !r.excluded).reduce((sum, r) => sum + r.distanceMeters / 1000, 0);
  }, [runs]);

  // Every card gets a progress bar + "{current}/{target}" — awards with a
  // real tracked km value (AWARD_PROGRESS_TARGETS) show that; everything
  // else is binary, so it's 0/1 unearned or 1/1 earned rather than leaving
  // most of the grid without the bar the design calls for on every card.
  const getProgress = (id: AwardId, isEarned: boolean): { current: number; target: number } => {
    const target = AWARD_PROGRESS_TARGETS[id];
    if (target) {
      const current = id === 'monthly_100' ? monthKm : totalKm;
      return { current: Math.min(current, target), target };
    }
    return { current: isEarned ? 1 : 0, target: 1 };
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
                const progress = getProgress(id, isEarned);
                const pct = progress.target > 0 ? progress.current / progress.target : 0;
                const isKmAward = !!AWARD_PROGRESS_TARGETS[id];

                return (
                  <Pressable
                    key={id}
                    style={[s.card, isEarned && s.cardEarned]}
                    onPress={() => navigation.navigate('AwardDetail', { awardId: id, unlockedAt: unlockedAt ?? null })}
                  >
                    <GlyphBadge glyph={def.icon} size={40} muted={!isEarned} />
                    <Text style={[s.cardTitle, isEarned && s.cardTitleEarned]} numberOfLines={1}>
                      {def.title}
                    </Text>
                    <Text style={s.cardDesc} numberOfLines={2}>{def.description}</Text>

                    <View style={s.progressMini}>
                      <View style={[s.progressMiniFill, { flex: Math.max(0.02, pct), backgroundColor: isEarned ? C.gold : C.red }]} />
                      <View style={{ flex: 1 - Math.max(0.02, pct) }} />
                    </View>
                    <Text style={s.progressMiniLabel}>
                      {isKmAward
                        ? `${progress.current.toFixed(0)} / ${progress.target} km`
                        : `${progress.current} / ${progress.target}`}
                    </Text>

                    {isEarned && unlockedAt && (
                      <Text style={s.cardDate}>
                        {new Date(unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    )}
                  </Pressable>
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

    card: { width: '47%', backgroundColor: C.card, borderRadius: 22, borderWidth: 0.5, borderColor: C.border, padding: 16, alignItems: 'center', gap: 6 },
    cardEarned: { borderColor: C.gold, backgroundColor: C.amberBg },


    cardTitle: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, textAlign: 'center' },
    cardTitleEarned: { fontFamily: Fonts.semiBold, color: C.black },
    cardDesc: { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, textAlign: 'center', lineHeight: 15 },
    cardDate: { fontFamily: Fonts.regular, fontSize: 11, color: C.gold, marginTop: 2 },

    progressMini: { height: 3, width: '100%', backgroundColor: C.mid, borderRadius: 2, flexDirection: 'row', overflow: 'hidden', marginTop: 4 },
    progressMiniFill: { height: 3, borderRadius: 2 },
    progressMiniLabel: { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
  });
}
