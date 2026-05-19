import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import type { StoredRun, StoredPlayer } from '@shared/services/store';
import { AWARD_DEFINITIONS } from '@shared/constants/awards';
import { fmtDist, fmtDuration } from '@mobile/shared/lib/formatters';
import { HeroCard } from './HeroCard';
import { StatusPills } from './StatusPills';
import { useTheme, type AppColors } from '@theme';

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
  const topAwards  = earnedAwards.slice(0, 6);

  return (
    <View>
      <HeroCard runs={runs} player={player} />
      <StatusPills
        streakDays={player?.streakDays ?? 0}
        weekPace={player?.paceWeeklyEarned ?? 0}
        runs={runs}
      />

      {/* Awards */}
      {earnedAwards.length > 0 && (
        <>
          <SectionHeader title="Awards" action="View all" onAction={onViewAllAwards} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.awardsScroll} contentContainerStyle={s.awardsContent}>
            {topAwards.map(a => {
              const def = AWARD_DEFINITIONS[a.awardId as keyof typeof AWARD_DEFINITIONS];
              if (!def) return null;
              return (
                <View key={a.awardId} style={s.awardChip}>
                  <View style={s.awardIconWrap}>
                    <Text style={s.awardIcon}>{def.icon}</Text>
                  </View>
                  <Text style={s.awardLabel} numberOfLines={1}>{def.title}</Text>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Recent activity */}
      {recentRuns.length > 0 && (
        <>
          <SectionHeader title="Recent Runs" action="View all" onAction={onViewAllActivity} />
          {recentRuns.map(run => (
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
          ))}
        </>
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
    sectionTitle:   { fontWeight: '500', fontSize: 13, color: C.black },
    sectionAction:  { fontSize: 12, color: C.red },

    pinnedCard:     { backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, marginBottom: 24, overflow: 'hidden' },
    pinnedMain:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    pinnedDist:     { fontFamily: 'Barlow_600SemiBold', fontSize: 20, color: C.black, letterSpacing: -0.5 },
    pinnedMeta:     { fontSize: 12, color: C.t2, marginTop: 3 },
    pinnedDate:     { fontSize: 11, color: C.t3, marginTop: 2 },
    pinnedArrow:    { fontSize: 20, color: C.t3 },
    unpinRow:       { borderTopWidth: 0.5, borderTopColor: C.border, paddingVertical: 11, alignItems: 'center' },
    unpinText:      { fontSize: 12, color: C.t2 },

    pinnedEmpty:     { backgroundColor: C.stone, borderRadius: 14, padding: 20, marginBottom: 24, alignItems: 'center', gap: 6 },
    pinnedEmptyTitle:{ fontWeight: '500', fontSize: 14, color: C.black },
    pinnedEmptyText: { fontSize: 12, color: C.t2, textAlign: 'center', lineHeight: 17 },

    awardsScroll:   { marginBottom: 24 },
    awardsContent:  { gap: 10, paddingBottom: 4 },
    awardChip:      { alignItems: 'center', gap: 6, width: 68 },
    awardIconWrap:  { width: 48, height: 48, borderRadius: 12, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    awardIcon:      { fontSize: 24 },
    awardLabel:     { fontSize: 10, color: C.t2, textAlign: 'center' },

    runCard:        { backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, marginBottom: 8 },
    runLeft:        { gap: 3 },
    runDist:        { fontFamily: 'Barlow_600SemiBold', fontSize: 17, color: C.black, letterSpacing: -0.3 },
    runMeta:        { fontSize: 12, color: C.t2 },
    runRight:       { alignItems: 'flex-end', gap: 6 },
    runDate:        { fontSize: 11, color: C.t3 },
    runArrow:       { fontSize: 18, color: C.t3 },
  });
}
