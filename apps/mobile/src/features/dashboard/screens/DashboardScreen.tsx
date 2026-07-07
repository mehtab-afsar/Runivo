import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { fetchUnreadCount } from '@features/notifications/services/notificationsService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Bell, Lightning, Pulse, Fire } from 'phosphor-react-native';

import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { useDashboard } from '../hooks/useDashboard';
import { MiniTerritoryMap } from '../components/MiniTerritoryMap';
import { MissionRow } from '../components/MissionRow';
import { RecentRunRow } from '../components/RecentRunRow';
import { BentoCard } from '../components/BentoCard';
import { PACEStoreBanner } from '../components/PACEStoreBanner';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const dash       = useDashboard();
  const [unreadCount, setUnreadCount] = useState(0);
  const [tsDisplay, setTsDisplay]     = useState(0);
  const hasAnimatedTs                 = useRef(false);

  useEffect(() => {
    if (dash.territoryScore > 0 && !hasAnimatedTs.current) {
      hasAnimatedTs.current = true;
      const target = dash.territoryScore;
      const startTime = Date.now();
      const id = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(1, elapsed / 800);
        const eased = 1 - Math.pow(1 - t, 3);
        setTsDisplay(Math.round(eased * target));
        if (t >= 1) clearInterval(id);
      }, 16);
      return () => clearInterval(id);
    }
  }, [dash.territoryScore]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount().then(setUnreadCount).catch(err => {
        if (__DEV__) console.error('[Notifications] fetchUnreadCount:', err);
      });
    }, []),
  );

  type GoScreen = 'Notifications' | 'Missions' | 'History';
  const go = (screen: GoScreen) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate(screen); };

  if (dash.loading || !dash.player) {
    return <View style={[s.fill, { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }]}><Text style={s.loadText}>runivo</Text></View>;
  }

  const h = new Date().getHours();
  const greeting = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';
  const streakDays = dash.player.streakDays || 0;

  return (
    <View style={[s.fill, { backgroundColor: C.bg }]}>
      <ScrollView style={s.fill} contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          {/* Left: greeting + name */}
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>{greeting.toUpperCase()}</Text>
            <Text style={s.username}>{dash.player.username}</Text>
          </View>

          {/* Right: streak · TS · bell */}
          <View style={s.headerRight}>
            {/* Streak badge */}
            <View style={s.badge}>
              <Fire size={11} color={streakDays > 0 ? C.red : C.t3} weight="light" />
              <Text style={s.badgeTxt}>{streakDays}</Text>
            </View>

            {/* Territory score badge */}
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{tsDisplay.toLocaleString()}</Text>
              <Text style={s.badgeSup}>TS</Text>
            </View>

            {/* Notifications bell */}
            <Pressable onPress={() => { go('Notifications'); setUnreadCount(0); }} style={s.bellBtn}>
              <Bell size={14} color={C.black} weight="light" />
              {unreadCount > 0 && (
                <View style={s.bellBadge}>
                  <Text style={s.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Sync error chip */}
        {dash.syncError && (
          <Pressable style={s.syncChip} onPress={() => dash.refresh()}>
            {dash.refreshing
              ? <ActivityIndicator size="small" color={C.alwaysLight} style={{ marginRight: 6 }} />
              : <Text style={s.syncDot}>●</Text>}
            <Text style={s.syncText}>{dash.refreshing ? 'Syncing…' : 'Sync failed · Retry'}</Text>
          </Pressable>
        )}

        {/* Stale alert strip */}
        {dash.staleCount > 0 && (
          <Pressable style={s.staleStrip} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('TerritoryMap', { initialFilter: 'stale' }); }}>
            <View style={s.staleAccent} />
            <Text style={s.staleText}>
              {dash.staleCount} zone{dash.staleCount > 1 ? 's' : ''} going stale — reinforce now →
            </Text>
          </Pressable>
        )}

        {/* PACE Store banner */}
        <PACEStoreBanner
          paceBalance={dash.player.paceBalance ?? 0}
          weeklyEarned={dash.player.paceWeeklyEarned ?? 0}
          weeklyCap={100}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('PACEStore'); }}
        />

        {/* Bento card — slide 1: weekly km | slide 2: nutrition */}
        <BentoCard
          weeklyKm={dash.weeklyKm} goalKm={dash.weeklyGoal} runDays={dash.runDays}
          ownedCount={dash.ownedCount} avgFreshness={dash.avgFreshness}
          caloriesConsumed={dash.caloriesConsumed}
          calorieGoal={dash.calorieGoal}
          netCaloriesToday={dash.netCaloriesToday}
          onNavigate={go as (screen: string) => void}
          onStartRun={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('Main', { screen: 'Run' }); }}
          onNutritionPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('CalorieTracker'); }}
        />

        {/* Mini territory map */}
        <MiniTerritoryMap
          territories={dash.territories}
          ownerId={dash.player.id}
          onPress={() => navigation.navigate('TerritoryMap')}
        />

        {/* Missions */}
        <View style={s.section}>
          <SectionHeader
            title="Missions"
            icon={<Lightning size={11} color={C.t3} weight="light" />}
            action={{ label: 'Change →', onPress: () => go('Missions') }}
            style={s.sectionHead}
          />
          <View style={s.missionCard}>
            <Text style={s.cardLabel}>TODAY'S CHALLENGE</Text>
            {dash.missions.map((m, i) => <MissionRow key={m.id} mission={m} isLast={i === dash.missions.length - 1} />)}
          </View>
        </View>

        {/* Recent runs */}
        <View style={s.section}>
          <SectionHeader
            title="Recent runs"
            icon={<Pulse size={11} color={C.t3} weight="light" />}
            action={dash.recentRuns.length > 0 ? { label: 'See all →', onPress: () => go('History') } : undefined}
            style={s.sectionHead}
          />
          <View style={s.runsCard}>
            {dash.recentRuns.length > 0
              ? dash.recentRuns.map((r, i) => (
                  <RecentRunRow
                    key={r.id} run={r} isLast={i === dash.recentRuns.length - 1}
                    onPress={run => navigation.navigate('RunSummary', { runId: run.id })}
                  />
                ))
              : (
                <View style={s.firstRunCard}>
                  <Text style={s.firstRunTitle}>Your first run awaits</Text>
                  <Text style={s.firstRunBody}>Hit the streets, claim territory and start earning PACE. Your stats and history will live here.</Text>
                  <Pressable
                    style={s.firstRunBtn}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('Main', { screen: 'Run' }); }}
                  >
                    <Text style={s.firstRunBtnText}>Start your first run →</Text>
                  </Pressable>
                </View>
              )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// Type-scale rules: no bare fontWeight (system-font leak next to Barlow), no text
// below the 10px overline floor except the 9px bell count badge.
function mkStyles(C: AppColors) {
  return StyleSheet.create({
    fill:            { flex: 1 },
    loadText:        { ...Type.displaySm, color: C.t1 },

    // Header
    header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.gutter, paddingTop: 20, marginBottom: 16 },
    greeting:        { ...Type.overline, color: C.t3, marginBottom: 4 },
    username:        { fontFamily: Fonts.display, fontSize: 26, color: C.t1, lineHeight: 30 },
    headerRight:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
    badge:           { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 10, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, borderRadius: 16 },
    badgeTxt:        { ...Type.metricSm, fontSize: 13, color: C.t1 },
    badgeSup:        { fontFamily: Fonts.medium, fontSize: 10, color: C.t3, letterSpacing: 0.4, marginTop: 2 },
    bellBtn:         { width: 32, height: 32, borderRadius: 16, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    bellBadge:       { position: 'absolute', top: -3, right: -3, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.bg },
    bellBadgeText:   { fontFamily: Fonts.bold, fontSize: 9, color: C.alwaysLight, lineHeight: 11 },

    // Content
    section:         { paddingHorizontal: Spacing.gutter, marginBottom: 28 },
    sectionHead:     { marginBottom: 12 },
    // Fixed near-black bold card in both themes — not C.black, which is the "ink" token
    // and inverts to near-white in dark mode (would strand the fixed-white text below).
    missionCard:     { backgroundColor: C.alwaysDark, borderRadius: 20, padding: 18 },
    cardLabel:       { ...Type.overline, color: 'rgba(255,255,255,0.35)', marginBottom: 14 },
    runsCard:        { backgroundColor: C.white, borderRadius: 20, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden' },
    firstRunCard:    { padding: 24, alignItems: 'center', gap: 10 },
    firstRunTitle:   { ...Type.displaySm, fontSize: 20, color: C.t1, textAlign: 'center' },
    firstRunBody:    { ...Type.bodySm, color: C.t2, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
    firstRunBtn:     { marginTop: 4, backgroundColor: C.red, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28 },
    firstRunBtnText: { ...Type.button, fontSize: 14, color: C.alwaysLight },
    syncChip:        { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', backgroundColor: C.red, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10, gap: 4 },
    syncDot:         { fontSize: 8, color: C.alwaysLight, lineHeight: 12 },
    syncText:        { ...Type.labelSm, color: C.alwaysLight, letterSpacing: 0.2 },
    staleStrip:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: Spacing.gutter, marginBottom: 12, backgroundColor: C.amberBg, borderWidth: 0.5, borderColor: 'rgba(158,104,0,0.3)', borderRadius: 12, padding: 12 },
    staleAccent:     { width: 3, height: 24, backgroundColor: C.red, borderRadius: 2 },
    staleText:       { ...Type.label, fontSize: 12, color: C.amber, flex: 1 },
  });
}
