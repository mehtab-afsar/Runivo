import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { fetchUnreadCount } from '@features/notifications/services/notificationsService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Bell, Map, Zap, Activity } from 'lucide-react-native';

import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, type AppColors } from '@theme';
import { useDashboard } from '../hooks/useDashboard';
import { XPRing } from '../components/XPRing';
import { TerritoryStats } from '../components/TerritoryStats';
import { MissionRow } from '../components/MissionRow';
import { RecentRunRow } from '../components/RecentRunRow';
import { DashboardPills } from '../components/DashboardPills';
import { BentoCard } from '../components/BentoCard';
import { DailyBonusCard } from '../components/DailyBonusCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const dash       = useDashboard();
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount().then(setUnreadCount).catch(() => {});
    }, []),
  );

  type GoScreen = 'Notifications' | 'CalorieTracker' | 'TerritoryMap' | 'Missions' | 'History';
  const go = (screen: GoScreen) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate(screen); };

  if (dash.loading || !dash.player) {
    return <View style={[s.fill, { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }]}><Text style={s.loadText}>runivo</Text></View>;
  }

  const initials = dash.player.username?.slice(0, 2).toUpperCase() ?? 'RU';
  const h = new Date().getHours();
  const greeting = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';

  return (
    <View style={[s.fill, { backgroundColor: C.bg }]}>
      {!dash.bonusCollected && (dash.loginBonusCoins ?? 0) > 0 && (
        <DailyBonusCard
          coins={dash.loginBonusCoins!}
          onCollect={dash.collectBonus}
        />
      )}

      <ScrollView style={s.fill} contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greeting}>{greeting.toUpperCase()}</Text>
            <Text style={s.username}>{dash.player.username}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={() => { go('Notifications'); setUnreadCount(0); }} style={s.bellBtn}>
              <Bell size={16} color={C.black} strokeWidth={1.5} />
              {unreadCount > 0 && (
                <View style={s.bellBadge}>
                  <Text style={s.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
            <XPRing initials={initials} xpPct={dash.xpProgress.percent} />
          </View>
        </View>

        {dash.syncError && (
          <Pressable style={s.syncChip} onPress={() => dash.refresh()}>
            {dash.refreshing
              ? <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
              : <Text style={s.syncDot}>●</Text>}
            <Text style={s.syncText}>{dash.refreshing ? 'Syncing…' : 'Sync failed · Retry'}</Text>
          </Pressable>
        )}

        <DashboardPills xp={dash.player.xp} level={dash.player.level} energy={dash.player.energy} streakDays={dash.player.streakDays || 0} />

        <BentoCard
          weeklyKm={dash.weeklyKm} goalKm={dash.weeklyGoal} runDays={dash.runDays}
          caloriesConsumed={dash.caloriesConsumed} calorieGoal={dash.calorieGoal}
          onNavigate={go as (screen: string) => void}
          onStartRun={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('Main', { screen: 'Run' }); }}
          onOpenCalories={() => go('CalorieTracker')}
        />

        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.sectionTitleRow}>
              <Map size={11} color={C.t3} strokeWidth={1.5} />
              <Text style={s.sectionTitle}>  EMPIRE</Text>
            </View>
            <Pressable onPress={() => go('TerritoryMap')}><Text style={s.sectionAction}>View map →</Text></Pressable>
          </View>
          <TerritoryStats ownedCount={dash.ownedCount} weakZones={dash.weakZones.length} avgDefense={dash.avgDefense} dailyIncome={dash.dailyIncome} />
          {dash.weakZones.length > 0 && (
            <Pressable style={s.weakAlert} onPress={() => go('TerritoryMap')}>
              <View style={s.weakAccent} />
              <View style={{ flex: 1 }}>
                <Text style={s.weakTitle}>{dash.weakZones.length} zone{dash.weakZones.length > 1 ? 's' : ''} need defending</Text>
                <Text style={s.weakCta}>Tap to reinforce →</Text>
              </View>
            </Pressable>
          )}
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.sectionTitleRow}>
              <Zap size={11} color={C.t3} strokeWidth={1.5} />
              <Text style={s.sectionTitle}>  MISSIONS</Text>
            </View>
            <Pressable onPress={() => go('Missions')}><Text style={s.sectionAction}>Change →</Text></Pressable>
          </View>
          <View style={s.missionCard}>
            <Text style={s.cardLabel}>TODAY'S CHALLENGE</Text>
            {dash.missions.map((m, i) => <MissionRow key={m.id} mission={m} isLast={i === dash.missions.length - 1} />)}
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sectionHead}>
            <View style={s.sectionTitleRow}>
              <Activity size={11} color={C.t3} strokeWidth={1.5} />
              <Text style={s.sectionTitle}>  RECENT RUNS</Text>
            </View>
            <Pressable onPress={() => go('History')}><Text style={s.sectionAction}>See all →</Text></Pressable>
          </View>
          <View style={s.runsCard}>
            {dash.recentRuns.length > 0
              ? dash.recentRuns.map((r, i) => <RecentRunRow key={r.id} run={r} isLast={i === dash.recentRuns.length - 1} onPress={run => navigation.navigate('RunSummary', { runId: run.id })} />)
              : <View style={s.empty}><Text style={s.emptyText}>No runs yet</Text><Pressable onPress={() => navigation.navigate('Main', { screen: 'Run' })}><Text style={s.emptyCta}>Start running →</Text></Pressable></View>}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    fill:            { flex: 1 },
    bellBtn:         { width: 34, height: 34, borderRadius: 17, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    bellBadge:       { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.bg },
    bellBadgeText:   { fontFamily: 'Barlow_700Bold', fontSize: 9, color: '#FFFFFF', lineHeight: 12 },
    loadText:        { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, fontStyle: 'italic' },
    header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 20, marginBottom: 18 },
    greeting:        { fontFamily: 'Barlow_400Regular', fontSize: 10, letterSpacing: 1, color: C.t3, marginBottom: 4 },
    username:        { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 26, color: C.black, lineHeight: 30, fontStyle: 'italic' },
    section:         { paddingHorizontal: 22, marginBottom: 28 },
    sectionHead:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
    sectionTitle:    { fontFamily: 'Barlow_500Medium', fontSize: 11, letterSpacing: 1, color: C.t3 },
    sectionAction:   { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t3 },
    missionCard:     { backgroundColor: C.black, borderRadius: 20, padding: 18 },
    cardLabel:       { fontFamily: 'Barlow_500Medium', fontSize: 10, letterSpacing: 1.2, color: 'rgba(255,255,255,0.35)', marginBottom: 14 },
    runsCard:        { backgroundColor: C.white, borderRadius: 20, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden' },
    empty:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
    emptyText:       { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.t3 },
    emptyCta:        { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.red },
    syncChip:        { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', backgroundColor: C.red, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10, gap: 4 },
    syncDot:         { fontSize: 8, color: '#FFFFFF', lineHeight: 12 },
    syncText:        { fontFamily: 'Barlow_500Medium', fontSize: 11, color: '#FFFFFF', letterSpacing: 0.2 },
    weakAlert:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, backgroundColor: C.amberBg, borderWidth: 0.5, borderColor: 'rgba(158,104,0,0.3)', borderRadius: 14, padding: 14, overflow: 'hidden' },
    weakAccent:      { width: 3, height: 28, backgroundColor: C.red, borderRadius: 2 },
    weakTitle:       { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: C.amber },
    weakCta:         { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.amber, marginTop: 2 },
  });
}
