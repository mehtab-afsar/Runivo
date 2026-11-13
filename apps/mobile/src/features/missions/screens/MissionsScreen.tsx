import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  SafeAreaView, Platform, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import {
  Route, Flag, Shield, Zap, Flame, UtensilsCrossed, X, Diamond, type LucideIcon,
} from 'lucide-react-native';
import {
  ACTIVE_MISSION_TEMPLATES,
  MISSION_SOURCE_LABEL,
  GOAL_TO_CATEGORY,
  type Mission,
  type MissionType,
} from '@shared/services/missions';
import { ensureTodaysMissions, swapMission, claimMissionReward } from '@shared/services/missionStore';
import { getProfile } from '@shared/services/profile';
import type { PlayerProfile } from '@shared/services/profile';

import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { MissionCard, type CardState } from '../components/MissionCard';
import { MissionRow } from '@features/dashboard/components/MissionRow';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Mission type → icon — mirrors the Dashboard widget's map (MissionRow.tsx)
// so the same mission type always shows the same glyph everywhere it appears.
const mkTypeIcon = (C: AppColors): Record<MissionType, { Icon: LucideIcon; color: string }> => ({
  run_distance:      { Icon: Route,           color: C.red },
  claim_territories: { Icon: Flag,             color: C.gold },
  capture_enemy:     { Icon: Shield,           color: C.green },
  speed_run:         { Icon: Zap,              color: C.red },
  run_streak:        { Icon: Flame,            color: C.orange },
  defend_zone:       { Icon: Shield,           color: C.green },
  steal_rival:       { Icon: Zap,              color: C.red },
  nutrition_streak:  { Icon: UtensilsCrossed,  color: C.orange },
});

// ── Component ──────────────────────────────────────────────────────────────────
export default function MissionsScreen() {
  const C = useTheme();
  const T = {
    pageBg:  C.stone,
    stone:   C.surface,
    mid:     C.mid,
    border:  C.border,
    surface: C.bg,
    black:   C.black,
    white:   C.white,
    card:    C.card,
    gold:    C.gold,
    goldBg:  C.goldBg,
    red:     C.red,
    alwaysDark:  C.alwaysDark,
    alwaysLight: C.alwaysLight,
    t2:      C.t2,
    t3:      C.t3,
  } as const;
  const ss = useMemo(() => mkStyles(T), [C]);
  const TYPE_ICON = useMemo(() => mkTypeIcon(C), [C]);
  const navigation = useNavigation<Nav>();

  const [missions, setMissions]   = useState<Mission[]>([]);
  const [profile, setProfile]     = useState<PlayerProfile | null>(null);
  const [loading, setLoading]     = useState(true);
  const [rowStates, setRowStates] = useState<Record<string, CardState>>({});
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [swapBusy, setSwapBusy]     = useState(false);

  useEffect(() => {
    Promise.all([ensureTodaysMissions(), getProfile()])
      .then(([m, p]) => { setMissions(m); setProfile(p ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleClaim = useCallback(async (missionId: string) => {
    setRowStates(prev => ({ ...prev, [missionId]: 'claiming' }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await claimMissionReward(missionId);
    if (result) {
      setMissions(prev => prev.map(m => m.id === missionId ? result : m));
      setRowStates(prev => ({ ...prev, [missionId]: 'idle' }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setRowStates(prev => ({ ...prev, [missionId]: 'retry' }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    return result;
  }, []);

  const swappingMission = missions.find(m => m.id === swappingId) ?? null;

  const swapCandidates = useMemo(() => {
    if (!swappingMission) return [];
    const currentTitles = new Set(missions.map(m => m.title));
    const goalCat = profile?.primaryGoal ? GOAL_TO_CATEGORY[profile.primaryGoal] : null;
    return ACTIVE_MISSION_TEMPLATES
      .filter(t => !currentTitles.has(t.title))
      .sort((a, b) => (b.goalCategory === goalCat ? 1 : 0) - (a.goalCategory === goalCat ? 1 : 0));
  }, [swappingMission, missions, profile]);

  const selectReplacement = useCallback(async (newTitle: string) => {
    if (!swappingId) return;
    setSwapBusy(true);
    const updated = await swapMission(swappingId, newTitle);
    setMissions(updated);
    setSwapBusy(false);
    setSwappingId(null);
  }, [swappingId]);

  // Date label "Mon · Mar 17"
  const today = new Date();
  const weekday  = today.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dateLabel = `${weekday} · ${monthDay}`;

  if (loading) {
    return (
      <SafeAreaView style={ss.root}>
        <View style={ss.loader}>
          <ActivityIndicator color={T.black} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Change picker (full-screen overlay over a single slot) ────────────────
  if (swappingMission) {
    return (
      <SafeAreaView style={ss.root}>
        <View style={ss.header}>
          <Pressable onPress={() => setSwappingId(null)} style={ss.backBtn}>
            <X size={15} strokeWidth={2.5} color={T.black} />
          </Pressable>
          <Text style={ss.headerTitle} numberOfLines={1}>Change "{swappingMission.title}"</Text>
          <View style={{ width: 30 }} />
        </View>
        {swapBusy ? (
          <View style={ss.loader}><ActivityIndicator color={T.black} /></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.candidateList}>
            {swapCandidates.map(c => {
              const { Icon: CIcon, color } = TYPE_ICON[c.type] ?? { Icon: Route, color: C.red };
              return (
                <Pressable
                  key={c.title}
                  onPress={() => selectReplacement(c.title)}
                  style={ss.candidateRow}
                >
                  <View style={ss.cardIconBox}><CIcon size={16} color={color} strokeWidth={2} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={ss.cardTitle}>{c.title}</Text>
                    <Text style={ss.sourceCaption}>{c.description}</Text>
                  </View>
                  <View style={ss.rewardChip}>
                    <Diamond size={10} color={C.gold} strokeWidth={2} fill={C.gold} />
                    <Text style={ss.rewardValue}>{c.rewards.pace}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ── Today (default view) ────────────────────────────────────────────────
  const doneCount = missions.filter(m => m.claimed).length;
  const progressLabel = doneCount === missions.length && missions.length > 0
    ? 'All claimed for today'
    : `${doneCount} of ${missions.length} claimed`;

  // One mission gets the full card — everything else was getting the exact
  // same dark-ring treatment regardless of state, so nothing told your eye
  // which one actually needed attention. Priority: something ready to claim,
  // else whichever is closest to finishing — the other two drop to compact
  // rows, same visual language as the Dashboard widget.
  const claimableMission = missions.find(m => m.completed && !m.claimed);
  const inProgress = missions.filter(m => !m.completed);
  const featured = claimableMission
    ?? (inProgress.length > 0
      ? inProgress.reduce((best, m) =>
          (m.current / Math.max(m.target, 1)) > (best.current / Math.max(best.target, 1)) ? m : best)
      : null);
  const rest = missions.filter(m => m.id !== featured?.id);

  return (
    <SafeAreaView style={ss.root}>
      <View style={ss.header}>
        <Pressable onPress={() => navigation.goBack()} style={ss.backBtn}>
          <Text style={ss.backText}>←</Text>
        </Pressable>
        <View style={ss.todayTitleWrap}>
          <Text style={ss.todayTitle}>Today</Text>
          <Text style={ss.dateLabel}>{dateLabel} · {progressLabel}</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={ss.todayList}>
          {featured && (() => {
            const { Icon: MIcon, color } = TYPE_ICON[featured.type] ?? { Icon: Route, color: C.red };
            return (
              <MissionCard
                mission={featured}
                MIcon={MIcon}
                accentColor={color}
                sourceLabel={MISSION_SOURCE_LABEL[featured.type]}
                state={rowStates[featured.id] ?? 'idle'}
                onClaim={handleClaim}
                onSwap={setSwappingId}
              />
            );
          })()}

          {rest.length > 0 && (
            <View style={ss.restCard}>
              {rest.map((m, i) => (
                <MissionRow
                  key={m.id}
                  mission={m}
                  isLast={i === rest.length - 1}
                  onClaim={handleClaim}
                  onPress={() => setSwappingId(m.id)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type TTokens = { pageBg: string; stone: string; mid: string; border: string; surface: string; black: string; white: string; card: string; gold: string; goldBg: string; red: string; alwaysDark: string; alwaysLight: string; t2: string; t3: string };
function mkStyles(T: TTokens) { return StyleSheet.create({
  root:            { flex: 1, backgroundColor: T.pageBg },
  loader:          { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header — no bar, no border, sits directly on the page (only the swap
  // picker's single-line title still uses headerTitle/flex:1 directly).
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 14 : 6, paddingBottom: 10, backgroundColor: T.pageBg },
  backBtn:         { width: 30, height: 30, borderRadius: 15, backgroundColor: T.surface, borderWidth: 0.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  backText:        { fontFamily: Fonts.regular, fontSize: 16, color: T.black, lineHeight: 18 },
  headerTitle:     { fontFamily: Fonts.semiBold, fontSize: 18, color: T.black, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  // "Today" screen's title sits in its own flex:1 wrapper (with the date
  // subtitle) — the bug was flex:1 living on the Text instead of this View,
  // so the wrapper never actually claimed the space between the two buttons
  // and "Today" got clipped against its own margin.
  todayTitleWrap:  { flex: 1, alignItems: 'center' },
  todayTitle:      { fontFamily: Fonts.semiBold, fontSize: 18, color: T.black },
  dateLabel:       { fontFamily: Fonts.regular, fontSize: 11, color: T.t3, marginTop: 1 },

  todayList:       { padding: Spacing.gutter, gap: 14 },
  restCard:        { backgroundColor: T.card, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: T.border },

  // Change picker rows — one card per candidate, same icon-badge language as
  // MissionRow (Dashboard widget) and MissionCard above.
  candidateList:   { padding: Spacing.gutter, gap: 10, paddingBottom: 40 },
  candidateRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, borderRadius: 14, borderWidth: 0.5, borderColor: T.border, paddingVertical: 12, paddingHorizontal: 14 },
  cardIconBox:     { width: 34, height: 34, borderRadius: 10, backgroundColor: T.stone, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle:       { fontFamily: Fonts.medium, fontSize: 13.5, color: T.black, marginBottom: 3 },
  sourceCaption:   { fontFamily: Fonts.regular, fontSize: 11.5, color: T.t3 },
  rewardChip:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: T.goldBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  rewardValue:     { fontFamily: Fonts.semiBold, fontSize: 11.5, color: T.gold, fontVariant: ['tabular-nums'] },
}); }
