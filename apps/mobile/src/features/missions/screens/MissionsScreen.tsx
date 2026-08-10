import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  SafeAreaView, Platform, ActivityIndicator,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { TrendUp, Fire, Target, X, Shield, Lightning, ForkKnife, type Icon } from 'phosphor-react-native';
import {
  ACTIVE_MISSION_TEMPLATES,
  MISSION_SOURCE_LABEL,
  GOAL_TO_CATEGORY,
  type Mission,
} from '@shared/services/missions';
import { ensureTodaysMissions, swapMission, claimMissionReward } from '@shared/services/missionStore';
import { getProfile } from '@shared/services/profile';
import type { PlayerProfile } from '@shared/services/profile';

import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { MissionCard, type CardState } from '../components/MissionCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Mission type → icon (shared by both the "today" cards and the swap picker)
const mkTypeIcon = (C: AppColors): Record<string, { Icon: Icon; color: string }> => ({
  run_distance:      { Icon: TrendUp,    color: C.red },
  claim_territories: { Icon: Lightning,  color: C.gold },
  capture_enemy:     { Icon: Shield,     color: C.green },
  speed_run:         { Icon: TrendUp,    color: C.red },
  run_streak:        { Icon: Fire,       color: C.orange },
  defend_zone:       { Icon: Shield,     color: C.green },
  steal_rival:       { Icon: Lightning,  color: C.red },
  nutrition_streak:  { Icon: ForkKnife,  color: C.orange },
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

  // ── Swap picker (full-screen overlay over a single slot) ──────────────────
  if (swappingMission) {
    return (
      <SafeAreaView style={ss.root}>
        <View style={ss.header}>
          <Pressable onPress={() => setSwappingId(null)} style={ss.backBtn}>
            <X size={14} weight="bold" color={T.black} />
          </Pressable>
          <Text style={ss.headerTitle} numberOfLines={1}>Swap "{swappingMission.title}"</Text>
          <View style={{ width: 30 }} />
        </View>
        {swapBusy ? (
          <View style={ss.loader}><ActivityIndicator color={T.black} /></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {swapCandidates.map((c, i) => {
              const { Icon: CIcon, color } = TYPE_ICON[c.type] ?? { Icon: Target, color: C.red };
              return (
                <Pressable
                  key={c.title}
                  onPress={() => selectReplacement(c.title)}
                  style={[ss.candidateRow, i > 0 && ss.rowBorder]}
                >
                  <View style={ss.cardIconBox}><CIcon size={16} color={color} weight="light" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={ss.cardTitle}>{c.title}</Text>
                    <Text style={ss.sourceCaption}>{c.description}</Text>
                  </View>
                  <Text style={ss.rewardValue}>+{c.rewards.pace}</Text>
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

  return (
    <SafeAreaView style={ss.root}>
      <View style={ss.header}>
        <Pressable onPress={() => navigation.goBack()} style={ss.backBtn}>
          <Text style={ss.backText}>←</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={ss.headerTitle}>Today</Text>
          <Text style={ss.dateLabel}>{dateLabel} · {progressLabel}</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={ss.todayList}>
          {missions.map(m => {
            const { Icon: MIcon, color } = TYPE_ICON[m.type] ?? { Icon: Target, color: C.red };
            return (
              <MissionCard
                key={m.id}
                mission={m}
                MIcon={MIcon}
                accentColor={color}
                sourceLabel={MISSION_SOURCE_LABEL[m.type]}
                state={rowStates[m.id] ?? 'idle'}
                onClaim={handleClaim}
                onSwap={setSwappingId}
              />
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type TTokens = { pageBg: string; stone: string; mid: string; border: string; surface: string; black: string; white: string; card: string; alwaysDark: string; alwaysLight: string; t2: string; t3: string };
function mkStyles(T: TTokens) { return StyleSheet.create({
  root:            { flex: 1, backgroundColor: T.pageBg },
  loader:          { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12, backgroundColor: T.card, borderBottomWidth: 0.5, borderBottomColor: T.border },
  backBtn:         { width: 30, height: 30, borderRadius: 15, backgroundColor: T.surface, borderWidth: 0.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  backText:        { fontFamily: Fonts.regular, fontSize: 16, color: T.black, lineHeight: 18 },
  headerTitle:     { fontFamily: Fonts.display, fontSize: 18, color: T.black, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  dateLabel:       { fontFamily: Fonts.regular, fontSize: 11, color: T.t3 },

  todayList:       { padding: Spacing.gutter, gap: 14 },

  // Swap picker rows
  cardIconBox:     { width: 34, height: 34, borderRadius: 9, backgroundColor: T.stone, borderWidth: 0.5, borderColor: T.mid, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle:       { fontFamily: Fonts.medium, fontSize: 13.5, color: T.black, marginBottom: 3 },
  sourceCaption:   { fontFamily: Fonts.regular, fontSize: 10.5, color: T.t3 },
  candidateRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.card, paddingVertical: 14, paddingHorizontal: 20 },
  rowBorder:       { borderTopWidth: 0.5, borderTopColor: T.border },
  rewardValue:     { fontFamily: Fonts.medium, fontSize: 12, color: T.t2 },
}); }
