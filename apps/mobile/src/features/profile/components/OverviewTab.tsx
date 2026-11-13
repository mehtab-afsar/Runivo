import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import type { StoredRun, StoredPlayer } from '@shared/services/store';
import { AWARD_DEFINITIONS, AWARD_PROGRESS_TARGETS } from '@shared/constants/awards';
import type { AwardId } from '@shared/types/game';
import { Lock } from 'lucide-react-native';
import { fmtDist, fmtDuration } from '@mobile/shared/lib/formatters';
import { HeroCard } from './HeroCard';
import { StatusPills } from './StatusPills';
import { useTheme, Fonts, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  runs: StoredRun[];
  thisWeekKm: number;
  player: StoredPlayer | null;
  earnedAwards: { awardId: string; unlockedAt: string }[];
  pinnedRunId: string | null;
  onViewAllActivity: () => void;
  onViewAllAwards: () => void;
  onPinRun: (runId: string | null) => void;
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={s.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function relativeDate(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const todayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const dayStr   = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const yesterdayStr = `${yest.getFullYear()}-${yest.getMonth()}-${yest.getDate()}`;
  if (dayStr === todayStr) return 'Today';
  if (dayStr === yesterdayStr) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function OverviewTab({
  runs, player,
  earnedAwards, pinnedRunId,
  onViewAllActivity, onViewAllAwards, onPinRun,
}: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();

  const pinnedRun = useMemo(
    () => pinnedRunId ? runs.find(r => r.id === pinnedRunId) ?? null : null,
    [runs, pinnedRunId],
  );

  const recentRuns = runs.slice(0, 3);

  // Closest-to-completing preview, not a trophy case — the full Awards tab is
  // where earned badges live. Only awards with a real tracked progress value
  // (AwardsTab's own km-based targets) can say how close you are, so those
  // are the only candidates; pace-category awards are excluded on top of that
  // since nothing in the app can currently grant them (no best-pace tracking).
  const totalKm = useMemo(() => runs.filter(r => !r.excluded).reduce((s, r) => s + r.distanceMeters / 1000, 0), [runs]);
  const monthKm = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return runs.filter(r => r.startTime >= monthStart.getTime()).filter(r => !r.excluded).reduce((s, r) => s + r.distanceMeters / 1000, 0);
  }, [runs]);

  const featuredAwards = useMemo(() => {
    const earnedSet = new Set(earnedAwards.map(a => a.awardId));
    return (Object.keys(AWARD_PROGRESS_TARGETS) as AwardId[])
      .filter(id => !earnedSet.has(id) && AWARD_DEFINITIONS[id].category !== 'pace')
      .map(id => {
        const target  = AWARD_PROGRESS_TARGETS[id]!;
        const current = Math.min(id === 'monthly_100' ? monthKm : totalKm, target);
        return { id, def: AWARD_DEFINITIONS[id], current, target };
      })
      .sort((a, b) => (b.current / b.target) - (a.current / a.target))
      .slice(0, 3);
  }, [earnedAwards, totalKm, monthKm]);

  return (
    <View>
      <HeroCard runs={runs} player={player} />
      <StatusPills
        streakDays={player?.streakDays ?? 0}
        weekPace={player?.paceWeeklyEarned ?? 0}
        runs={runs}
      />

      {/* Awards — closest-to-completing preview, so this always has something
          to show even before the user's earned anything. */}
      {featuredAwards.length > 0 && (
        <>
          <SectionHeader title="Awards" action="See all →" onAction={onViewAllAwards} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.awardsScroll} contentContainerStyle={s.awardsContent}>
            {featuredAwards.map(a => (
              <View key={a.id} style={s.awardChip}>
                <View style={s.awardIconWrap}>
                  <Lock size={16} color={C.t3} strokeWidth={2} />
                </View>
                <Text style={s.awardLabel} numberOfLines={1}>{a.def.title}</Text>
                <Text style={s.awardProgress}>{a.current.toFixed(0)} / {a.target} km</Text>
              </View>
            ))}
          </ScrollView>
        </>
      )}

      {/* Recent activity */}
      <SectionHeader title="Recent Runs" action={recentRuns.length > 0 ? 'View all' : undefined} onAction={onViewAllActivity} />
      {recentRuns.length > 0 ? (
        recentRuns.map(run => (
          <Pressable
            key={run.id}
            style={s.runCard}
            onPress={() => navigation.navigate('RunSummary', { runId: run.id })}
          >
            <View style={s.runLeft}>
              <Text style={s.runDist}>{fmtDist(run.distanceMeters)} km</Text>
              <Text style={s.runMeta}>{run.avgPace} /km  ·  {fmtDuration(run.durationSec)}</Text>
            </View>
            <View style={s.runRight}>
              <Text style={s.runDate}>{relativeDate(run.startTime)}</Text>
              <Text style={s.runArrow}>›</Text>
            </View>
          </Pressable>
        ))
      ) : (
        <View style={s.runsEmptyCard}>
          <Text style={s.runsEmptyText}>No runs logged yet — head to Home when you're ready.</Text>
        </View>
      )}

      {/* Pinned run */}
      {pinnedRun ? (
        <>
          <SectionHeader title="Pinned Run" />
          <View style={s.pinnedCard}>
            <Pressable
              style={s.pinnedMain}
              onPress={() => navigation.navigate('RunSummary', { runId: pinnedRun.id })}
            >
              <View>
                <Text style={s.pinnedDist}>{fmtDist(pinnedRun.distanceMeters)} km</Text>
                <Text style={s.pinnedMeta}>{pinnedRun.avgPace} /km  ·  {fmtDuration(pinnedRun.durationSec)}</Text>
                <Text style={s.pinnedDate}>{relativeDate(pinnedRun.startTime)}</Text>
              </View>
              <Text style={s.pinnedArrow}>›</Text>
            </Pressable>
            <Pressable onPress={() => onPinRun(null)} style={s.unpinRow}>
              <Text style={s.unpinText}>Remove pin</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
    sectionTitle:   { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    sectionAction:  { fontFamily: Fonts.medium, fontSize: 13, color: C.red },

    pinnedCard:     { backgroundColor: C.card, borderRadius: 16, shadowColor: C.t1, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1, marginBottom: 24, overflow: 'hidden' },
    pinnedMain:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    pinnedDist:     { fontFamily: Fonts.numeric, fontSize: 32, lineHeight: 32, color: C.t1, fontVariant: ['tabular-nums'] },
    pinnedMeta:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 3 },
    pinnedDate:     { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 2 },
    pinnedArrow:    { fontSize: 20, color: C.t3 },
    unpinRow:       { borderTopWidth: 0.5, borderTopColor: C.border, paddingVertical: 11, alignItems: 'center' },
    unpinText:      { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },

    pinnedEmpty:     { backgroundColor: C.stone, borderRadius: 16, padding: 20, marginBottom: 24, alignItems: 'center', gap: 6 },
    pinnedEmptyTitle:{ fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    pinnedEmptyText: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, textAlign: 'center', lineHeight: 17 },

    awardsScroll:   { marginBottom: 24 },
    awardsContent:  { gap: 10, paddingBottom: 4 },
    // Dimmed/locked — this strip previews what's next, not what's earned;
    // the full trophy case lives on the Awards tab.
    awardChip:      { alignItems: 'center', gap: 6, width: 76, opacity: 0.7 },
    awardIconWrap:  { width: 52, height: 52, borderRadius: 26, backgroundColor: C.stone, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    awardProgress:  { fontFamily: Fonts.regular, fontSize: 12, color: C.t3, fontVariant: ['tabular-nums'] },
    awardLabel:     { fontFamily: Fonts.regular, fontSize: 11, color: C.t2, textAlign: 'center' },

    runCard:        { backgroundColor: C.card, borderRadius: 16, shadowColor: C.t1, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, marginBottom: 8 },
    runLeft:        { gap: 3 },
    runDist:        { fontFamily: Fonts.numeric, fontSize: 24, lineHeight: 26, color: C.t1, fontVariant: ['tabular-nums'] },
    runMeta:        { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    runRight:       { alignItems: 'flex-end', gap: 6 },
    runDate:        { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
    runArrow:       { fontSize: 18, color: C.t3 },

    runsEmptyCard:  { backgroundColor: C.stone, borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 8 },
    runsEmptyText:  { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, textAlign: 'center', lineHeight: 18 },
  });
}
