import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { fetchUnreadCount } from '@features/notifications/services/notificationsService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Pulse } from 'phosphor-react-native';
import { ArrowRight } from 'lucide-react-native';

import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';
import { SectionHeader } from '../../../shared/components/SectionHeader';
import { useDashboard } from '../hooks/useDashboard';
import { MiniTerritoryMap } from '../components/MiniTerritoryMap';
import { MissionRow } from '../components/MissionRow';
import { RecentRunRow } from '../components/RecentRunRow';
import { BentoCard } from '../components/BentoCard';
import { PACEStoreBanner } from '../components/PACEStoreBanner';
import { DailyBonusCard } from '../components/DailyBonusCard';
import { TerritoryCapBanner } from '../components/TerritoryCapBanner';
import { DashboardHeader } from '../components/DashboardHeader';
import { CommunityPulseCard } from '../components/CommunityPulseCard';
import { DashboardTour } from '../components/DashboardTour';
import { useFeatureGate } from '@features/subscription/hooks/useFeatureGate';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const dash       = useDashboard();
  const gate       = useFeatureGate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [tsDisplay, setTsDisplay]     = useState(0);
  const hasAnimatedTs                 = useRef(false);
  const paceStoreRef = useRef<View>(null);
  const bentoRef     = useRef<View>(null);
  const mapRef       = useRef<View>(null);

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
      {dash.loginBonusCoins > 0 && (
        <View style={[s.bonusToastWrap, { top: insets.top + 8 }]}>
          <DailyBonusCard coins={dash.loginBonusCoins} onCollect={dash.dismissLoginBonus} />
        </View>
      )}

      <ScrollView style={s.fill} contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <DashboardHeader
          greeting={greeting.toUpperCase()}
          username={dash.player.username}
          streakDays={streakDays}
          territoryScore={tsDisplay}
          isPremium={gate.isPremium}
          unreadCount={unreadCount}
          onAvatarPress={() => navigation.navigate('Main', { screen: 'Profile' })}
          onPlusPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Subscription'); }}
          onBellPress={() => { go('Notifications'); setUnreadCount(0); }}
        />

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
        <View ref={paceStoreRef} collapsable={false}>
          <PACEStoreBanner
            paceBalance={dash.player.paceBalance ?? 0}
            weeklyEarned={dash.player.paceWeeklyEarned ?? 0}
            weeklyCap={dash.weeklyCapLimit}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('PACEStore'); }}
          />
        </View>

        {/* Bento card — slide 1: weekly km | slide 2: nutrition */}
        <View ref={bentoRef} collapsable={false}>
          <BentoCard
            weeklyKm={dash.weeklyKm} goalKm={dash.weeklyGoal} runDays={dash.runDays}
            totalRuns={dash.player.totalRuns}
            ownedCount={dash.ownedCount} avgFreshness={dash.avgFreshness}
            caloriesConsumed={dash.caloriesConsumed}
            calorieGoal={dash.calorieGoal}
            netCaloriesToday={dash.netCaloriesToday}
            onNavigate={go as (screen: string) => void}
            onStartRun={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('Main', { screen: 'Run' }); }}
            onNutritionPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('CalorieTracker'); }}
          />
        </View>

        {/* Mini territory map */}
        <View ref={mapRef} collapsable={false}>
          <MiniTerritoryMap
            territories={dash.territories}
            ownerId={dash.player.id}
            onPress={() => navigation.navigate('TerritoryMap')}
          />
        </View>

        {/* Territory-cap paywall */}
        {!gate.loading && !gate.canClaimTerritory(dash.ownedCount) && (
          <TerritoryCapBanner
            ownedCount={dash.ownedCount}
            territoryLimit={gate.territoryLimit}
            onUpgrade={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('Subscription'); }}
          />
        )}

        {/* Missions */}
        <View style={s.section}>
          <View style={s.missionCard}>
            <View style={s.missionCardHeader}>
              <Text style={s.missionCardLabel}>Today's missions</Text>
              <Pressable onPress={() => go('Missions')} hitSlop={8} style={s.missionChangeLink}>
                <Text style={s.missionChangeTxt}>Change</Text>
                <ArrowRight size={12} color={C.red} strokeWidth={2} />
              </Pressable>
            </View>
            {dash.missions.map((m, i) => (
              <MissionRow key={m.id} mission={m} isLast={i === dash.missions.length - 1} onClaim={dash.claimMission} />
            ))}
          </View>
        </View>

        {/* Recent runs — only shown once there's something to show; a brand-new
            account gets the dashboard tour instead of a static empty-state card */}
        {dash.recentRuns.length > 0 && (
          <View style={s.section}>
            <SectionHeader
              title="Recent runs"
              icon={<Pulse size={11} color={C.t3} weight="light" />}
              action={{ label: 'See all →', onPress: () => go('History') }}
              style={s.sectionHead}
            />
            <View style={s.runsCard}>
              {dash.recentRuns.map((r, i) => (
                <RecentRunRow
                  key={r.id} run={r} isLast={i === dash.recentRuns.length - 1}
                  onPress={run => navigation.navigate('RunSummary', { runId: run.id })}
                />
              ))}
            </View>
          </View>
        )}

        <CommunityPulseCard
          onOpenRoom={lobbyId => navigation.navigate('LobbyChat', { lobbyId })}
          onOpenDiscover={() => navigation.navigate('Main', { screen: 'Feed' })}
        />
      </ScrollView>

      <DashboardTour
        targets={{ paceStore: paceStoreRef, bento: bentoRef, map: mapRef }}
        active={dash.recentRuns.length === 0}
      />
    </View>
  );
}

// Type-scale rules: no bare fontWeight (system-font leak next to Barlow), no text
// below the 10px overline floor except the 9px bell count badge.
function mkStyles(C: AppColors) {
  return StyleSheet.create({
    fill:            { flex: 1 },
    bonusToastWrap:  { position: 'absolute', left: 0, right: 0, zIndex: 50 },
    loadText:        { ...Type.displaySm, color: C.t1 },

    // Content
    section:         { paddingHorizontal: Spacing.gutter, marginBottom: 28 },
    sectionHead:     { marginBottom: 12 },
    missionCard:       { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 0.5, borderColor: C.border },
    missionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    missionCardLabel:  { ...Type.overline, color: C.t3 },
    missionChangeLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    missionChangeTxt:  { ...Type.label, fontFamily: Fonts.semiBold, color: C.red },
    runsCard:        { backgroundColor: C.card, borderRadius: 20, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden' },
    syncChip:        { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', backgroundColor: C.red, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10, gap: 4 },
    syncDot:         { fontSize: 8, color: C.alwaysLight, lineHeight: 12 },
    syncText:        { ...Type.labelSm, color: C.alwaysLight, letterSpacing: 0.2 },
    staleStrip:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: Spacing.gutter, marginBottom: 12, backgroundColor: C.amberBg, borderWidth: 0.5, borderColor: 'rgba(158,104,0,0.3)', borderRadius: 12, padding: 12 },
    staleAccent:     { width: 3, height: 24, backgroundColor: C.red, borderRadius: 2 },
    staleText:       { ...Type.label, fontSize: 12, color: C.amber, flex: 1 },
  });
}
