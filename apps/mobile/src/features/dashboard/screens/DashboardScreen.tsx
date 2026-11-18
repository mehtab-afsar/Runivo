import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { StatusBarScrim } from '@mobile/shared/components/StatusBarScrim';
import { weeklyPaceNow } from '@shared/engine/runEngine';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { fetchUnreadCount } from '@features/notifications/services/notificationsService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from '@theme/hapticsGated';
import { Bell, Search } from '@mobile/shared/icons/lucideCompat';
import Svg, { Circle } from 'react-native-svg';
import { RunivoMark } from '@mobile/shared/components/RunivoMark';
import { PaceXOrb } from '@mobile/shared/components/PaceXOrb';
import { useMyIdentity } from '@mobile/shared/hooks/useMyIdentity';
import { ZonePreview } from '@mobile/shared/components/ZonePreview';
import { getTerritoryPolygons } from '@shared/services/store';
import { ENGINE } from '@shared/engine/runEngine';
import { useLiveFriendRuns } from '@features/run/hooks/useLiveFriendRuns';
import TodayCard from '@features/training/components/TodayCard';
import { GoalSheet } from '@features/profile/components/GoalSheet';
import { RivalAlert } from '../components/RivalAlert';
import { useWeatherLine } from '../hooks/useWeatherLine';
import FriendsActivityCard from '../components/FriendsActivityCard';
import { HappeningNow } from '../components/HappeningNow';
import { CheerSheet, type CheerTarget } from '@features/cheers/CheerSheet';

import type { RootStackParamList } from '@navigation/AppNavigator';
import { ErrorState } from '@mobile/shared/components/ErrorState';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import { FEATURES } from '../../../config/features';
import { useDashboard } from '../hooks/useDashboard';
import { useFeatureGate } from '@features/subscription/hooks/useFeatureGate';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const dash       = useDashboard();
  const me         = useMyIdentity();
  const gate       = useFeatureGate();
  const liveFriends = useLiveFriendRuns();
  const [unreadCount, setUnreadCount] = useState(0);
  const [tsDisplay, setTsDisplay]     = useState(0);
  const tsShownRef                    = useRef(0);   // value currently on screen, so later changes animate from it
  const [goalOpen, setGoalOpen] = useState(false);
  const [cheerFor, setCheerFor] = useState<CheerTarget | null>(null);
  const [feedDiscover, setFeedDiscover] = useState(false);
  const [mapW, setMapW] = useState(0);
  const [zoneRings, setZoneRings] = useState<{ own: [number, number][][]; fading: [number, number][][] }>({ own: [], fading: [] });
  const playerIdForZones = dash.player?.id;
  useFocusEffect(useCallback(() => {
    if (!playerIdForZones) return;
    getTerritoryPolygons(playerIdForZones).then(zs => setZoneRings({
      own: zs.filter(z => z.freshness >= ENGINE.FRESHNESS_STALE_AT).map(z => z.polygon),
      fading: zs.filter(z => z.freshness < ENGINE.FRESHNESS_STALE_AT).map(z => z.polygon),
    })).catch(() => {});
  }, [playerIdForZones, dash.ownedCount]));
  const weather = useWeatherLine();
  // S3: the reward they're saving for, set on its detail page.

  // Count the headline score to its target, and again whenever it changes (after a run,
  // a refresh or a sync), starting from what is on screen rather than only on first load.
  useEffect(() => {
    const target = dash.territoryScore;
    const from = tsShownRef.current;
    if (target === from) return;
    const startTime = Date.now();
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - startTime) / 800);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + (target - from) * eased);
      tsShownRef.current = v;
      setTsDisplay(v);
      if (t >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
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
    // A failed first load gets a retry; otherwise a plain page while Home loads (a
    // second "runivo" screen here read as another launch page right after SplashView).
    if (!dash.loading && dash.loadError) {
      return (
        <View style={[s.fill, { backgroundColor: C.bg, justifyContent: 'center' }]}>
          <ErrorState title="Couldn't load Home" onRetry={dash.reloadPlayer} />
        </View>
      );
    }
    return <View style={[s.fill, { backgroundColor: C.bg }]} />;
  }

  const now = new Date();
  const h = now.getHours();
  const greeting = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';
  // The runner's own first name once they've set one, else their username.
  const firstName = (me.name || dash.player.username || '').split(/[._\s]/)[0] || dash.player.username;
  const dateLine = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const streakDays = dash.player.streakDays || 0;
  const weeklyEarned = weeklyPaceNow(dash.player.paceWeeklyEarned, dash.player.paceWeeklyResetAt);
  const weeklyCap = dash.weeklyCapLimit || 100;
  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const doneCount = dash.missions.filter(m => m.completed).length;
  const toClaim = dash.missions.filter(m => m.completed && !m.claimed).reduce((n, m) => n + (m.rewards?.pace ?? 0), 0);


  return (
    <View style={[s.fill, { backgroundColor: C.bg }]}>
      <ScrollView
        style={s.fill}
        contentContainerStyle={{ paddingBottom: 130, paddingTop: Math.max(18, insets.top) + 4, paddingHorizontal: 20, gap: 22 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={dash.refreshing} onRefresh={dash.refresh} tintColor={C.t3} />}
      >
        {/* Header: search · runivo · PaceX and alerts (mock) */}
        <View style={s.header}>
          <Pressable onPress={() => { tap(); navigation.navigate('Feed', { search: true }); }} style={s.iconBtn} hitSlop={6} accessibilityLabel="Search runners and clubs" accessibilityRole="button">
            <Search size={20} color={C.t1} strokeWidth={1.8} />
          </Pressable>
          <View style={s.logo} accessibilityRole="header" accessibilityLabel="Runivo">
            <RunivoMark size={22} inline />
            <Text style={s.word}>runivo</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {FEATURES.AI_COACH && (
              <Pressable onPress={() => { tap(); navigation.navigate('Coach'); }} style={s.iconBtn} hitSlop={6} accessibilityLabel="Ask PaceX" accessibilityRole="button">
                <PaceXOrb size={24} />
              </Pressable>
            )}
            <Pressable onPress={() => { go('Notifications'); setUnreadCount(0); }} style={s.iconBtn} hitSlop={6} accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} new` : 'Notifications'} accessibilityRole="button">
              <Bell size={20} color={C.t1} strokeWidth={1.8} />
              {unreadCount > 0 && <View style={s.dot} />}
            </Pressable>
          </View>
        </View>

        <View style={{ gap: 4, marginTop: 6 }}>
          <Text style={s.hello} numberOfLines={1}>{greeting}, {firstName}</Text>
          <Text style={s.dateLine} numberOfLines={1}>{weather ? `${dateLine} · ${weather}` : dateLine}</Text>
        </View>



        {dash.syncError && (
          <Pressable style={s.syncChip} onPress={() => dash.refresh()}>
            {dash.refreshing && <ActivityIndicator size="small" color={C.alwaysLight} />}
            <Text style={s.syncText}>{dash.refreshing ? 'Syncing…' : 'Sync failed. Tap to retry'}</Text>
          </Pressable>
        )}

        {/* Territory: your zones drawn from the map, score and rank (mock) */}
        <Pressable style={s.terrCard} onPress={() => { tap(); navigation.navigate('Main', { screen: 'Map' }); }} accessibilityRole="button" accessibilityLabel={`Territory score ${tsDisplay.toLocaleString()}, ${dash.ownedCount} zones. Open the map`}>
          <View onLayout={e => setMapW(e.nativeEvent.layout.width)}>
            {mapW > 0 && <ZonePreview own={zoneRings.own} fading={zoneRings.fading} width={mapW} height={150} />}
            {dash.staleCount > 0 && (
              <View style={s.mapChip}>
                <View style={[s.mapChipDot, { backgroundColor: C.rivalAmber }]} />
                <Text style={s.mapChipTxt}>{dash.staleCount === 1 ? '1 zone fading' : `${dash.staleCount} zones fading`}</Text>
              </View>
            )}
          </View>
          <View style={s.terrBody}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.label}>Territory score</Text>
              <Text style={s.scoreNum} numberOfLines={1}>{tsDisplay.toLocaleString()}</Text>
              <Text style={s.terrSub} numberOfLines={1}>
                {dash.ownedCount}{!gate.isPremium ? ` / ${gate.territoryLimit}` : ''} {dash.ownedCount === 1 ? 'zone' : 'zones'}
                {dash.cityRank != null ? ` · #${dash.cityRank} near you` : ''}{streakDays > 0 ? ` · ${streakDays}-day streak` : ''}
              </Text>
            </View>
            <Pressable
              style={s.defend} hitSlop={6} accessibilityRole="button"
              onPress={() => { tap(); navigation.navigate('TerritoryMap', dash.staleCount > 0 ? { initialFilter: 'stale' } : {}); }}
            >
              <Text style={s.defendTxt}>{dash.staleCount > 0 ? 'Defend' : 'Map'}</Text>
            </Pressable>
          </View>
        </Pressable>

        {/* Live friends (with Cheer), challenges you're in, events you're going to */}
        <HappeningNow friends={liveFriends} onCheer={f => setCheerFor({ userId: f.userId, username: f.username, avatarColor: f.avatarColor })} />

        {/* Today's session from PaceX (or an invitation to build a plan) */}
        <TodayCard />


        {/* Missions and the PACE Store */}
        <View style={s.tiles}>
          <Pressable style={[s.card, s.tile]} onPress={() => go('Missions')} accessibilityRole="button" accessibilityLabel={`Missions, ${doneCount} of ${dash.missions.length} done`}>
            <Text style={s.tileTitle}>Missions</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Svg width={34} height={34} viewBox="0 0 38 38">
                <Circle cx={19} cy={19} r={15} fill="none" stroke={C.stone} strokeWidth={5} />
                <Circle
                  cx={19} cy={19} r={15} fill="none" stroke={C.brandGreen} strokeWidth={5} strokeLinecap="round"
                  strokeDasharray={`${(dash.missions.length ? doneCount / dash.missions.length : 0) * 94.2} 94.2`} transform="rotate(-90 19 19)"
                />
              </Svg>
              <Text style={s.tileNum}>{doneCount}<Text style={s.tileOf}> / {dash.missions.length}</Text></Text>
            </View>
            {toClaim > 0
              ? <View style={s.claimPill}><Text style={s.claimTxt}>Claim +{toClaim} PACE</Text></View>
              : <Text style={s.small}>Resets at midnight</Text>}
          </Pressable>
          <Pressable
            style={[s.card, s.tile, { backgroundColor: C.amberBg }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('PACEStore'); }}
            accessibilityRole="button" accessibilityLabel={`PACE Store, ${(dash.player.paceBalance ?? 0).toLocaleString()} PACE to spend`}
          >
            <Text style={s.tileTitle}>PACE this week</Text>
            <Text style={s.tileNum}>{weeklyEarned}<Text style={[s.tileOf, { color: '#7A5525' }]}> / {weeklyCap}</Text></Text>
            {/* Mock: "212 to spend ›". The PACE Store name stays (asked for), on its own
                line so the balance is never cut off on narrow phones. */}
            <Text style={s.storeLine} numberOfLines={2}>
              {(dash.player.paceBalance ?? 0).toLocaleString()} to spend{'\n'}in the PACE Store ›
            </Text>
          </Pressable>
        </View>

        {/* People you follow */}
        <View style={s.feedHead}>
          <Text style={s.sectionTitle} accessibilityRole="header">Your feed</Text>
          <View style={s.feedSeg}>
            {(['Following', 'Discover'] as const).map(k => {
              const on = (k === 'Discover') === feedDiscover;
              return (
                <Pressable key={k} style={[s.feedSegBtn, on && s.feedSegOn]} onPress={() => setFeedDiscover(k === 'Discover')} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                  <Text style={[s.feedSegTxt, on && { color: C.alwaysLight }]}>{k}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <FriendsActivityCard discover={feedDiscover} />
        <RivalAlert />

      </ScrollView>
      <CheerSheet target={cheerFor} onClose={() => setCheerFor(null)} />
      <GoalSheet visible={goalOpen} current={dash.weeklyGoal} onClose={() => setGoalOpen(false)} onSaved={() => { dash.refresh(); }} />

      <StatusBarScrim />
    </View>
  );
}

const BAR_H = 64;

function mkStyles(C: AppColors) {
  const card = {
    backgroundColor: C.card, borderRadius: 24, padding: 16,
    shadowColor: '#17181A', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  } as const;
  return StyleSheet.create({
    fill:           { flex: 1 },
    bonusToastWrap: { position: 'absolute', left: 0, right: 0, zIndex: 50 },

    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    logo:        { flexDirection: 'row', alignItems: 'center', gap: 7 },
    word:        { fontFamily: Fonts.wordmark, fontSize: 21, letterSpacing: -0.6, color: C.t1 },
    terrCard:    { backgroundColor: C.card, borderRadius: 30, overflow: 'hidden' },
    terrBody:    { flexDirection: 'row', alignItems: 'flex-end', gap: 12, padding: 16, paddingTop: 14 },
    terrSub:     { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    mapChip:     { position: 'absolute', top: 12, left: 12, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.95)', flexDirection: 'row', alignItems: 'center', gap: 6 },
    mapChipDot:  { width: 8, height: 8, borderRadius: 4 },
    mapChipTxt:  { fontFamily: Fonts.medium, fontSize: 13, color: '#17181A' },
    defend:      { height: 42, paddingHorizontal: 18, borderRadius: 21, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center' },
    defendTxt:   { fontFamily: Fonts.medium, fontSize: 14, color: C.alwaysLight },
    dateLine:    { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    hello:       { fontFamily: Fonts.semiBold, fontSize: 28, lineHeight: 32, letterSpacing: -0.6, color: C.t1 },
    iconBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    dot:         { position: 'absolute', top: 10, right: 11, width: 7, height: 7, borderRadius: 4, backgroundColor: C.rivalAmber, borderWidth: 1.5, borderColor: C.card },

    card,
    rowBetween:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowCenter:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
    label:       { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    ofText:      { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    scoreCard:   { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16 },
    wideCard:    { paddingVertical: 16, paddingHorizontal: 18 },
    missionsCard:{ paddingVertical: 6, paddingHorizontal: 16 },
    missionsHead:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 4 },
    small:       { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 16, color: C.t2 },
    smallStrong: { fontFamily: Fonts.semiBold, fontSize: 12.5, lineHeight: 16, color: C.t1 },
    inlineNum:   { fontFamily: Fonts.numeric, fontSize: 20, color: C.t1 },
    rowCenterTight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rankBlock:   { paddingBottom: 8, marginLeft: 10 },
    rankNum:     { ...Type.labelSm, color: C.t1 },
    rankWhere:   { ...Type.labelSm, color: C.t2 },
    scoreArrow:  { marginLeft: 'auto', marginBottom: 10 },

    scoreRow:    { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 },
    // No negative tracking or shrink-to-fit: both clipped the last digit on iOS.
    scoreNum:    { fontFamily: Fonts.numeric, fontSize: 34, lineHeight: 42, letterSpacing: -0.3, color: C.t1, fontVariant: ['tabular-nums'], paddingRight: 2, includeFontPadding: false },
    statRow:     { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
    stat:        { flex: 1 },
    statDivider: { borderLeftWidth: 1, borderLeftColor: C.border, paddingLeft: 14 },
    statNum:     { fontFamily: Fonts.numeric, fontSize: 26, lineHeight: 26, color: C.t1, fontVariant: ['tabular-nums'] },
    statOf:      { fontFamily: Fonts.numeric, fontSize: 15, color: C.t3 },
    statLabel:   { ...Type.labelSm, color: C.t2, marginTop: 4 },

    startBtn:    { height: 58, borderRadius: 29, backgroundColor: C.red, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 8 },
    startText:   { fontFamily: Fonts.semiBold, fontSize: 16, color: '#fff' },
    startChip:   { height: 42, borderRadius: 21, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.2)', flexDirection: 'row', alignItems: 'center', gap: 6 },
    startChipText:{ fontFamily: Fonts.semiBold, fontSize: 12, color: '#fff' },
    gpsDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },

    liveCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
    liveAvatars: { flexDirection: 'row' },
    liveAvatarRing: { borderWidth: 2, borderColor: C.green, borderRadius: 21, padding: 2, backgroundColor: C.bg },
    liveTitle:   { fontFamily: Fonts.semiBold, fontSize: 14, lineHeight: 18, color: C.t1 },
    liveChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.greenBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    liveDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
    liveChipText:{ fontFamily: Fonts.semiBold, fontSize: 11.5, color: C.green },

    alertIcon:   { width: 40, height: 40, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
    alertTitle:  { fontFamily: Fonts.semiBold, fontSize: 14, lineHeight: 18, color: C.t1 },
    alertSub:    { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 16, color: C.t2, marginTop: 2 },
    inkPill:     { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.alwaysDark, justifyContent: 'center' },
    inkPillText: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: '#fff' },

    quickRow:    { flexDirection: 'row', gap: 8 },
    quick:       { ...card, flex: 1, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', gap: 6 },
    quickText:   { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t1 },

    track:       { height: 8, borderRadius: 9, backgroundColor: C.surface, overflow: 'hidden', marginVertical: 10 },
    fillBar:     { height: 8, borderRadius: 9 },
    bars:        { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 12 },
    barCol:      { flex: 1, alignItems: 'center', gap: 6 },
    barSlot:     { height: BAR_H, width: '100%', justifyContent: 'flex-end' },
    bar:         { width: '100%', borderRadius: 7, backgroundColor: C.t1 },
    barEmpty:    { height: BAR_H, width: '100%', borderRadius: 7, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D8D6D0' },
    barNone:     { height: 4, width: '100%', borderRadius: 7, backgroundColor: C.surface },
    dayLabel:    { ...Type.labelSm, color: C.t2 },

    syncChip:    { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, backgroundColor: C.red, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
    syncText:    { ...Type.labelSm, color: C.alwaysLight },
    weather: { fontFamily: Fonts.regular, fontSize: 14, color: C.t2, marginTop: -6 },
    orb:         { width: 22, height: 22, borderRadius: 11, backgroundColor: '#7C72D8', alignItems: 'center', justifyContent: 'center' },
    orbCore:     { width: 12, height: 12, borderRadius: 6, backgroundColor: '#C9C2F6', marginLeft: -4, marginTop: -4 },
    tiles:       { flexDirection: 'row', gap: 12 },
    tile:        { flex: 1, gap: 8, borderRadius: 24 },
    tileTitle:   { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    tileNum:     { fontFamily: Fonts.numeric, fontSize: 24, letterSpacing: -0.5, color: C.t1 },
    tileOf:      { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    claimPill:   { height: 32, borderRadius: 16, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center' },
    claimTxt:    { fontFamily: Fonts.semiBold, fontSize: 13, color: C.alwaysDark },
    storeLine:   { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: '#7A5525' },
    feedHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
    feedSeg:     { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 20, backgroundColor: C.card },
    feedSegBtn:  { height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center' },
    feedSegOn:   { backgroundColor: C.alwaysDark },
    feedSegTxt:  { fontFamily: Fonts.regular, fontSize: 13, color: C.t1 },
    sectionTitle:{ fontFamily: Fonts.semiBold, fontSize: 20, letterSpacing: -0.3, color: C.t1 },
  });
}
