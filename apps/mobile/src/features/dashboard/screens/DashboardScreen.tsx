import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { fetchUnreadCount } from '@features/notifications/services/notificationsService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { ArrowRight, Bell, Play, Shield, Users, CalendarDays, Sparkles, Gift } from 'lucide-react-native';
import { useLiveFriendRuns } from '@features/run/hooks/useLiveFriendRuns';
import { useGpsStatus } from '../hooks/useGpsStatus';
import { getLastSport } from '@features/run/constants/lastSport';
import TodayCard from '@features/training/components/TodayCard';
import FriendsActivityCard from '../components/FriendsActivityCard';
import { sportFor } from '@features/run/constants/activities';
import type { ActivityType } from '@features/run/types';

import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import { Avatar } from '@mobile/shared/components/Avatar';
import { FEATURES } from '../../../config/features';
import { useDashboard } from '../hooks/useDashboard';
import { MissionRow } from '../components/MissionRow';
import { useFeatureGate } from '@features/subscription/hooks/useFeatureGate';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const dash       = useDashboard();
  const gate       = useFeatureGate();
  const liveFriends = useLiveFriendRuns();
  const gps        = useGpsStatus();
  const [unreadCount, setUnreadCount] = useState(0);
  // Start uses the sport last picked on the record screen, as Strava does.
  const [lastSport, setLastSportState] = useState<ActivityType>('run');
  useFocusEffect(useCallback(() => { getLastSport().then(setLastSportState); }, []));
  const sport = sportFor(lastSport);
  const [tsDisplay, setTsDisplay]     = useState(0);
  const hasAnimatedTs                 = useRef(false);
  const paceStoreRef = useRef<View>(null);
  const bentoRef     = useRef<View>(null);

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

  const now = new Date();
  const h = now.getHours();
  const greeting = h < 5 ? 'Good night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Good night';
  const firstName = (dash.player.username || '').split(/[._\s]/)[0] || dash.player.username;
  const dateLine = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const streakDays = dash.player.streakDays || 0;
  const weeklyEarned = dash.player.paceWeeklyEarned ?? 0;
  const weeklyCap = dash.weeklyCapLimit || 100;
  const capPct = Math.min(100, Math.round((weeklyEarned / weeklyCap) * 100));
  const maxDayKm = Math.max(1, ...dash.dayKm);
  const todayIdx = (now.getDay() + 6) % 7; // Monday = 0
  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  const quick: { key: string; label: string; Icon: typeof Users; onPress: () => void; accent?: boolean }[] = [
    { key: 'clubs', label: 'Clubs', Icon: Users, onPress: () => { tap(); navigation.navigate('Club'); } },
    ...(FEATURES.EVENTS ? [{ key: 'events', label: 'Events', Icon: CalendarDays, onPress: () => { tap(); navigation.navigate('Events'); } }] : []),
    ...(FEATURES.AI_COACH ? [{ key: 'pacex', label: 'PaceX', Icon: Sparkles, accent: true, onPress: () => { tap(); navigation.navigate('Coach'); } }] : []),
    { key: 'store', label: 'Store', Icon: Gift, onPress: () => { tap(); navigation.navigate('PACEStore'); } },
  ];

  return (
    <View style={[s.fill, { backgroundColor: C.bg }]}>
      <ScrollView
        style={s.fill}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: Math.max(18, insets.top) + 4, paddingHorizontal: 18, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={dash.refreshing} onRefresh={dash.refresh} tintColor={C.t3} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.dateLine}>{dateLine}</Text>
            <Text style={s.hello} numberOfLines={1}>{greeting}, {firstName}</Text>
          </View>
          <Pressable onPress={() => { go('Notifications'); setUnreadCount(0); }} style={s.iconBtn} hitSlop={6} accessibilityLabel="Notifications">
            <Bell size={16} color={C.t1} strokeWidth={1.8} />
            {unreadCount > 0 && <View style={s.dot} />}
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Main', { screen: 'Profile' })} hitSlop={4} accessibilityLabel="Your profile">
            <Avatar uri={dash.avatarUrl} name={dash.player.username} size={36} />
          </Pressable>
        </View>

        {dash.syncError && (
          <Pressable style={s.syncChip} onPress={() => dash.refresh()}>
            {dash.refreshing && <ActivityIndicator size="small" color={C.alwaysLight} />}
            <Text style={s.syncText}>{dash.refreshing ? 'Syncing…' : 'Sync failed. Tap to retry'}</Text>
          </Pressable>
        )}

        {/* Territory score */}
        <Pressable style={[s.card, s.scoreCard]} onPress={() => { tap(); navigation.navigate('Leaderboard'); }}>
          <Text style={s.label}>Territory score</Text>
          <View style={s.scoreRow}>
            <Text style={s.scoreNum} numberOfLines={1} adjustsFontSizeToFit>{tsDisplay.toLocaleString()}</Text>
            {dash.cityRank != null && (
              <View style={s.rankBlock}>
                <Text style={s.rankNum}>#{dash.cityRank}</Text>
                <Text style={s.rankWhere}>near you</Text>
              </View>
            )}
            <ArrowRight size={20} color={C.t2} strokeWidth={1.8} style={s.scoreArrow} />
          </View>
          <View style={s.statRow}>
            <View style={s.stat}>
              <Text style={s.statNum}>{dash.ownedCount}{!gate.isPremium && <Text style={s.statOf}> / {gate.territoryLimit}</Text>}</Text>
              <Text style={s.statLabel}>Zones held</Text>
            </View>
            <View style={[s.stat, s.statDivider]}>
              <Text style={[s.statNum, dash.staleCount > 0 && { color: C.red }]}>{dash.staleCount}</Text>
              <Text style={s.statLabel}>Fading</Text>
            </View>
            <View style={[s.stat, s.statDivider]}>
              <Text style={s.statNum}>{streakDays}<Text style={[s.statOf, { color: C.t1 }]}> {streakDays === 1 ? 'day' : 'days'}</Text></Text>
              <Text style={s.statLabel}>Streak</Text>
            </View>
          </View>
        </Pressable>

        {/* Start run */}
        <Pressable
          style={({ pressed }) => [s.startBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            // As in the mock: with a GPS fix, Start run starts the run; otherwise the run tab finds GPS first.
            if (gps === 'ready') navigation.navigate('ActiveRun', { autoStart: true, activityType: lastSport });
            else navigation.navigate('Main', { screen: 'Run' });
          }}
          accessibilityRole="button"
        >
          <View style={s.rowCenter}>
            <Play size={14} color="#fff" fill="#fff" />
            <Text style={s.startText}>{dash.hasRunToday ? `${sport.verb.charAt(0).toUpperCase()}${sport.verb.slice(1)} again` : `Start ${sport.verb}`}</Text>
          </View>
          <View style={s.startChip}>
            {gps === 'ready' && <View style={s.gpsDot} />}
            <Text style={s.startChipText}>
              {gps === 'ready' ? 'GPS ready' : gps === 'off' ? 'Location off' : 'Finding GPS…'}
            </Text>
          </View>
        </Pressable>

        {/* Today's training session (or an invitation to build a plan) */}
        <TodayCard />

        {/* Friends running now */}
        {liveFriends.length > 0 && (
          <Pressable style={[s.card, s.liveCard]} onPress={() => { tap(); navigation.navigate('Main', { screen: 'Map' }); }}>
            <View style={s.liveAvatars}>
              {liveFriends.slice(0, 3).map((f, i) => (
                <View key={f.userId} style={[s.liveAvatarRing, i > 0 && { marginLeft: -12 }]}>
                  <Avatar name={f.username} color={f.avatarColor} size={34} />
                </View>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.liveTitle}>
                {liveFriends.length === 1 ? '1 friend running now' : `${liveFriends.length} friends running now`}
              </Text>
              <Text style={s.alertSub} numberOfLines={1}>
                {liveFriends.length === 1 ? `${liveFriends[0].username} is out now` : `${liveFriends[0].username} and ${liveFriends.length - 1} more`}
              </Text>
            </View>
            <View style={s.liveChip}><View style={s.liveDot} /><Text style={s.liveChipText}>Live</Text></View>
          </Pressable>
        )}

        {/* Latest from people you follow, with kudos */}
        <FriendsActivityCard />

        {/* Fading zones */}
        {dash.staleCount > 0 && (
          <View style={[s.card, s.alertCard]}>
            <View style={s.alertIcon}><Shield size={18} color="#fff" strokeWidth={2} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.alertTitle}>{dash.staleCount === 1 ? 'A zone is fading' : `${dash.staleCount} zones are fading`}</Text>
              <Text style={s.alertSub}>{dash.lowestFreshness}% fresh · run through {dash.staleCount === 1 ? 'it' : 'them'} to defend</Text>
            </View>
            <Pressable style={s.inkPill} onPress={() => { tap(); navigation.navigate('TerritoryMap', { initialFilter: 'stale' }); }}>
              <Text style={s.inkPillText}>Defend</Text>
            </Pressable>
          </View>
        )}

        {/* Quick actions */}
        <View style={s.quickRow}>
          {quick.map(q => (
            <Pressable key={q.key} style={({ pressed }) => [s.quick, pressed && { opacity: 0.8 }]} onPress={q.onPress}>
              <q.Icon size={20} color={q.accent ? C.red : C.t1} strokeWidth={1.8} />
              <Text style={s.quickText}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* PACE this week */}
        <View ref={paceStoreRef} collapsable={false}>
          <Pressable style={[s.card, s.wideCard]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.navigate('PACEStore'); }}>
            <View style={s.rowBetween}>
              <Text style={s.label}>PACE this week</Text>
              <Text style={s.ofText}><Text style={s.inlineNum}>{weeklyEarned}</Text>  / {weeklyCap} cap</Text>
            </View>
            <View style={s.track}><View style={[s.fillBar, { width: `${capPct}%`, backgroundColor: C.red }]} /></View>
            <View style={s.rowBetween}>
              <Text style={s.small}>{(dash.player.paceBalance ?? 0).toLocaleString()} PACE to spend</Text>
              <View style={s.rowCenterTight}>
                <Text style={s.smallStrong}>PACE Store</Text>
                <ArrowRight size={14} color={C.t1} strokeWidth={2} />
              </View>
            </View>
          </Pressable>
        </View>

        {/* This week */}
        <View ref={bentoRef} collapsable={false} style={[s.card, s.wideCard]}>
          <View style={s.rowBetween}>
            <Text style={s.label}>This week</Text>
            <Text style={s.ofText}><Text style={s.inlineNum}>{dash.weeklyKm.toFixed(1)}</Text>  / {dash.weeklyGoal} km</Text>
          </View>
          <View style={s.bars}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
              const km = dash.dayKm[i] ?? 0;
              const today = i === todayIdx;
              const future = i > todayIdx;
              const h = km > 0 ? Math.max(10, Math.round((km / maxDayKm) * BAR_H)) : 0;
              return (
                <View key={i} style={s.barCol}>
                  <View style={s.barSlot}>
                    {km > 0 ? (
                      <View style={[s.bar, { height: h }]} />
                    ) : today || future ? (
                      <View style={[s.barEmpty, today && { borderColor: C.red }]} />
                    ) : (
                      <View style={s.barNone} />
                    )}
                  </View>
                  <Text style={[s.dayLabel, today && { color: C.red, fontFamily: Fonts.semiBold }]}>{d}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Missions */}
        <View style={[s.card, s.missionsCard]}>
          <View style={s.missionsHead}>
            <Text style={s.label}>Today's missions · {dash.missions.length}</Text>
            <Text style={s.small}>Resets at midnight</Text>
          </View>
          {dash.missions.map((m, i) => (
            <MissionRow key={m.id} mission={m} isLast={i === dash.missions.length - 1} onClaim={dash.claimMission} />
          ))}
        </View>

      </ScrollView>

    </View>
  );
}

const BAR_H = 64;

function mkStyles(C: AppColors) {
  const card = {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    shadowColor: '#14120F', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  } as const;
  return StyleSheet.create({
    fill:           { flex: 1 },
    bonusToastWrap: { position: 'absolute', left: 0, right: 0, zIndex: 50 },
    loadText:       { fontFamily: Fonts.wordmark, fontSize: 26, letterSpacing: -0.5, color: C.t1 },

    header:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dateLine:    { ...Type.labelSm, color: C.t2 },
    hello:       { fontFamily: Fonts.bold, fontSize: 24, lineHeight: 26, letterSpacing: -0.6, color: C.t1, marginTop: 6 },
    iconBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    dot:         { position: 'absolute', top: 7, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: C.red, borderWidth: 1.5, borderColor: C.card },

    card,
    rowBetween:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowCenter:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
    label:       { ...Type.labelSm, color: C.t2 },
    ofText:      { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    scoreCard:   { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 16 },
    wideCard:    { paddingVertical: 16, paddingHorizontal: 18 },
    missionsCard:{ paddingVertical: 6, paddingHorizontal: 16 },
    missionsHead:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 4 },
    small:       { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 16, color: C.t2 },
    smallStrong: { fontFamily: Fonts.semiBold, fontSize: 12.5, lineHeight: 16, color: C.t1 },
    sectionTitle:{ fontFamily: Fonts.bold, fontSize: 17, letterSpacing: -0.3, color: C.t1 },
    inlineNum:   { fontFamily: Fonts.numeric, fontSize: 20, color: C.t1 },
    rowCenterTight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rankBlock:   { paddingBottom: 8, marginLeft: 10 },
    rankNum:     { ...Type.labelSm, color: C.t1 },
    rankWhere:   { ...Type.labelSm, color: C.t2 },
    scoreArrow:  { marginLeft: 'auto', marginBottom: 10 },

    scoreRow:    { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 },
    scoreNum:    { fontFamily: Fonts.numeric, fontSize: 88, lineHeight: 80, letterSpacing: -0.9, color: C.t1, fontVariant: ['tabular-nums'], flexShrink: 1 },
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

    alertCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#FFF6F2', borderWidth: 1, borderColor: '#FFD2C4', shadowOpacity: 0 },
    alertIcon:   { width: 40, height: 40, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
    alertTitle:  { fontFamily: Fonts.semiBold, fontSize: 14, lineHeight: 18, color: C.t1 },
    alertSub:    { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 16, color: C.t2, marginTop: 2 },
    inkPill:     { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.alwaysDark, justifyContent: 'center' },
    inkPillText: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: '#fff' },

    quickRow:    { flexDirection: 'row', gap: 8 },
    quick:       { ...card, flex: 1, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', gap: 6 },
    quickText:   { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t1 },

    track:       { height: 8, borderRadius: 9, backgroundColor: '#ECEAE5', overflow: 'hidden', marginVertical: 10 },
    fillBar:     { height: 8, borderRadius: 9 },
    bars:        { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 12 },
    barCol:      { flex: 1, alignItems: 'center', gap: 6 },
    barSlot:     { height: BAR_H, width: '100%', justifyContent: 'flex-end' },
    bar:         { width: '100%', borderRadius: 7, backgroundColor: C.t1 },
    barEmpty:    { height: BAR_H, width: '100%', borderRadius: 7, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D8D6D0' },
    barNone:     { height: 4, width: '100%', borderRadius: 7, backgroundColor: '#ECEAE5' },
    dayLabel:    { ...Type.labelSm, color: C.t2 },

    syncChip:    { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, backgroundColor: C.red, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
    syncText:    { ...Type.labelSm, color: C.alwaysLight },
  });
}
