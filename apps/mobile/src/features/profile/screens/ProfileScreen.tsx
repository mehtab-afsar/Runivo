/**
 * "You": the runner's own profile, laid out like Strava's with Runivo's game
 * on top (see the Runivo profile redesign canvas). Detail lives on pages the
 * menu rows open, not on this one.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ShareNetwork, GearSix, Pulse, ChartBar, Hexagon, MapTrifold, Timer, Sneaker, Crown, CaretRight, CalendarDots, Barbell, Rows } from 'phosphor-react-native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { usePlayerStats } from '@mobile/shared/hooks/usePlayerStats';
import { GAME_CONFIG } from '@shared/services/config';
import { getTerritoryPolygons, getSavedRoutes } from '@shared/services/store';
import { fetchClubs } from '@features/clubs/services/clubService';
import { useFeatureGate } from '@features/subscription/hooks/useFeatureGate';
import { supabase } from '@shared/services/supabase';
import { useTheme, Fonts, type AppColors } from '@theme';
import { FEATURES } from '../../../config/features';
import { useProfile } from '../hooks/useProfile';
import { EditProfileSheet } from '../components/EditProfileSheet';
import { AwardsTab } from '../components/AwardsTab';
import { GoalSheet } from '../components/GoalSheet';
import {
  YouHeader, WeekCard, PinnedCard, MenuList, TrophyStrip, ClubsStrip, activityName, fmtKm, type MenuItem,
} from '../components/YouSections';
import { periodStats, filterBySport, type SportFilter } from '../utils/profileStats';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const RANK_ORDER = ['pacer', 'strider', 'chaser', 'hunter', 'sovereign'] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ProfileScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { player, totalAreaM2, loading } = usePlayerStats();
  const {
    runs, weeklyGoalKm, personalRecords, followers, following,
    avatarColor, avatarUri, displayName, location,
    isEditing, editInitial, startEdit, cancelEdit, saveProfile,
    earnedAwards, refreshCounts, pinnedRunId, pinRun, setWeeklyGoal,
  } = useProfile();
  useFocusEffect(useCallback(() => { refreshCounts(); }, [refreshCounts]));

  const gate = useFeatureGate();
  const [sport, setSport] = useState<SportFilter>('all');
  const [goalOpen, setGoalOpen] = useState(false);
  const [showAwards, setShowAwards] = useState(false);
  const [zonesHeld, setZonesHeld] = useState<number | null>(null);
  const [routeCount, setRouteCount] = useState(0);
  const [legendOf, setLegendOf] = useState(0);
  const [clubs, setClubs] = useState<{ id: string; name: string; emoji: string; memberCount: number; totalKm: number; description: string | null }[]>([]);
  const playerId = player?.id;
  useEffect(() => {
    if (!playerId) return;
    getTerritoryPolygons(playerId).then(z => setZonesHeld(z.length)).catch(() => {});
    getSavedRoutes().then(r => setRouteCount(r.length)).catch(() => {});
    supabase.rpc('legend_zone_count', { p_user: playerId }).then(({ data }) => setLegendOf((data as number | null) ?? 0), () => {});
    fetchClubs(playerId).then(cs => setClubs(cs.filter(c => c.joined).map(c => ({
      id: c.id, name: c.name, emoji: c.badge_emoji, memberCount: c.member_count, totalKm: c.total_km, description: c.description,
    })))).catch(() => {});
  }, [playerId]);

  const name = displayName || player?.username || 'Runner';
  const rank = (player?.runnerRank ?? 'pacer') as typeof RANK_ORDER[number];
  const earned = player?.paceTotalEarned ?? 0;
  const nextRank = RANK_ORDER[RANK_ORDER.indexOf(rank) + 1];
  const toNext = nextRank ? Math.max(0, (GAME_CONFIG.RUNNER_RANK_THRESHOLDS[nextRank] ?? 0) - earned) : 0;

  const pinned = pinnedRunId ? runs.find(r => r.id === pinnedRunId) : undefined;
  const latest = useMemo(() => runs.filter(r => r.distanceMeters >= 50).sort((a, b) => b.startTime - a.startTime)[0], [runs]);
  const year = useMemo(() => periodStats(filterBySport(runs, sport), 'year'), [runs, sport]);
  const best5k = personalRecords.find(r => r.label === 'Fastest 5K')?.value;
  const best10k = personalRecords.find(r => r.label === 'Fastest 10K')?.value;
  const areaKm2 = totalAreaM2 / 1e6;

  const ago = (ms: number) => {
    const days = Math.floor((Date.now() - ms) / 86_400_000);
    return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
  };

  const menu: MenuItem[] = [
    { key: 'feed', label: 'Your feed', Icon: Rows, sub: 'Your runs, battle cards and milestones as posts', onPress: () => navigation.navigate('MyFeed') },
    { key: 'acts', label: 'Activities', Icon: Pulse, sub: latest ? `${ago(latest.startTime)} · ${activityName(latest)}` : 'Nothing yet', onPress: () => navigation.navigate('History') },
    { key: 'stats', label: 'Statistics', Icon: ChartBar, sub: `${new Date().getFullYear()} · ${fmtKm(year.km)} km · ${year.count} ${year.count === 1 ? 'activity' : 'activities'}`, onPress: () => navigation.navigate('ProfileStats', { sport }) },
    { key: 'log', label: 'Training log', Icon: CalendarDots, sub: 'Every day of the last 16 weeks', onPress: () => navigation.navigate('TrainingLog') },
    { key: 'strength', label: 'Strength and mobility', Icon: Barbell, sub: '8–17 minute guided sessions', onPress: () => navigation.navigate('Strength') },
    { key: 'terr', label: 'Territory', Icon: Hexagon, red: true, sub: `${zonesHeld ?? 0} ${zonesHeld === 1 ? 'zone' : 'zones'} · ${areaKm2 >= 0.01 ? areaKm2.toFixed(2) : '0'} km² ${legendOf > 0 ? ` · legend of ${legendOf}` : ''} · ${player?.totalTerritoriesClaimed ?? 0} claimed ever`, onPress: () => navigation.navigate('TerritoryMap', {}) },
    { key: 'routes', label: 'Routes', Icon: MapTrifold, sub: routeCount > 0 ? `${routeCount} saved` : 'Save one from any activity', onPress: () => navigation.navigate('Main', { screen: 'Run' }) },
    { key: 'best', label: 'Best efforts', Icon: Timer, sub: best5k || best10k ? [best5k && `5K ${best5k}`, best10k && `10K ${best10k}`].filter(Boolean).join(' · ') : 'Run a 5K to set one', onPress: () => navigation.navigate('ProfileStats', { sport: 'run' }) },
    ...(FEATURES.GEAR_TRACKING ? [{ key: 'gear', label: 'Gear', Icon: Sneaker, sub: 'Shoes and their distance', onPress: () => navigation.navigate('Gear') } as MenuItem] : []),
  ];

  if (loading) return <View style={[s.root, s.center]}><ActivityIndicator color={C.red} /></View>;

  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120, gap: 12 }}>
        <View style={s.topBar}>
          <Text style={s.title}>You</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={s.iconBtn} accessibilityLabel="Share profile" onPress={() => Share.share({ message: `Follow me on Runivo: runivo://runner/${playerId}` }).catch(() => {})}>
              <ShareNetwork size={18} color={C.t1} />
            </Pressable>
            <Pressable style={s.iconBtn} accessibilityLabel="Settings" onPress={() => navigation.navigate('Settings')}>
              <GearSix size={18} color={C.t1} />
            </Pressable>
          </View>
        </View>

        <YouHeader
          name={name} location={location} avatarUri={avatarUri} avatarColor={avatarColor}
          rankLabel={cap(rank)} rankNext={nextRank ? `${toNext.toLocaleString()} PACE to ${cap(nextRank)}` : 'Top rank'}
          following={following} followers={followers} zonesHeld={zonesHeld ?? 0} score={player?.territoryScore ?? 0}
          onFollowing={() => navigation.navigate('Following', { userId: playerId ?? '' })}
          onFollowers={() => navigation.navigate('Followers', { userId: playerId ?? '' })}
          onZones={() => navigation.navigate('TerritoryMap', {})}
          onScore={() => navigation.navigate('Leaderboard')}
          onEdit={startEdit}
          onShare={() => Share.share({ message: `Follow me on Runivo: runivo://runner/${playerId}` }).catch(() => {})}
        />

        <View style={{ height: 8 }} />
        <WeekCard runs={runs} sport={sport} onSport={setSport} goalKm={weeklyGoalKm} onEditGoal={() => setGoalOpen(true)} />

        {pinned && (
          <PinnedCard
            run={pinned}
            onOpen={() => navigation.navigate('RunSummary', { runId: pinned.id, activityType: pinned.activityType })}
            onUnpin={() => pinRun(null)}
          />
        )}

        <MenuList items={menu} />

        {!gate.isPremium && Number.isFinite(gate.territoryLimit) && (
          <Pressable style={s.plus} onPress={() => navigation.navigate('Subscription', { reason: 'zone_limit' })} accessibilityRole="button">
            <Crown size={20} color={C.red} />
            <View style={{ flex: 1 }}>
              <Text style={s.plusTitle}>{Math.min(zonesHeld ?? 0, gate.territoryLimit)} of {gate.territoryLimit} zones used</Text>
              <Text style={s.plusSub}>Runivo Plus removes the cap</Text>
            </View>
            <CaretRight size={14} color={C.alwaysLight} weight="bold" />
          </Pressable>
        )}

        <View style={{ height: 8 }} />
        <TrophyStrip earned={earnedAwards} onAll={() => setShowAwards(v => !v)} />
        {showAwards && (
          <View style={{ paddingHorizontal: 18 }}>
            <AwardsTab
              earnedAwards={earnedAwards}
              totalKm={runs.filter(r => !r.excluded).reduce((n, r) => n + r.distanceMeters / 1000, 0)}
              streakDays={player?.streakDays ?? 0}
              totalTerritoriesClaimed={player?.totalTerritoriesClaimed ?? 0}
              paceTotalEarned={earned}
              runs={runs}
            />
          </View>
        )}

        <View style={{ height: 8 }} />
        <ClubsStrip
          clubs={clubs}
          onAll={() => navigation.navigate('Club')}
          onOpen={(id) => {
            const c = clubs.find(x => x.id === id);
            if (c) navigation.navigate('ClubDetail', { clubId: c.id, clubName: c.name, badgeEmoji: c.emoji, memberCount: c.memberCount, totalKm: c.totalKm, description: c.description ?? undefined });
          }}
        />

        <View style={{ height: 8 }} />
        <View style={s.footer}>
          <Pressable style={[s.footRow, s.footBorder]} onPress={() => navigation.navigate('MyRewards')} accessibilityRole="button">
            <Text style={s.footTxt}>My rewards</Text>
            <Text style={s.footVal}>{(player?.paceBalance ?? 0).toLocaleString()} PACE</Text>
          </Pressable>
          <Pressable style={[s.footRow, s.footBorder]} onPress={() => navigation.navigate('YearInRunivo')} accessibilityRole="button">
            <Text style={s.footTxt}>Year in Runivo</Text>
            <Text style={s.footVal}>{new Date().getFullYear()}</Text>
          </Pressable>
          <Pressable style={s.footRow} onPress={() => navigation.navigate('ConnectedDevices')} accessibilityRole="button">
            <Text style={s.footTxt}>Connected apps and devices</Text>
            <CaretRight size={14} color={C.t3} weight="bold" />
          </Pressable>
        </View>
      </ScrollView>

      <GoalSheet visible={goalOpen} current={weeklyGoalKm} onClose={() => setGoalOpen(false)} onSaved={setWeeklyGoal} />

      {isEditing && (
        <EditProfileSheet
          username={player?.username}
          initial={editInitial}
          photoUri={avatarUri}
          onSave={saveProfile}
          onClose={cancelEdit}
        />
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    center: { alignItems: 'center', justifyContent: 'center' },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
    title: { fontFamily: Fonts.bold, fontSize: 26, color: C.t1, letterSpacing: -0.5 },
    iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    plus: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 18, padding: 16, borderRadius: 18, backgroundColor: C.t1 },
    plusTitle: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.bg },
    plusSub: { fontFamily: Fonts.regular, fontSize: 12, color: C.t3, marginTop: 2 },
    footer: { marginHorizontal: 18, backgroundColor: C.card, borderRadius: 18, paddingHorizontal: 14 },
    footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
    footBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    footTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    footVal: { fontFamily: Fonts.medium, fontSize: 13, color: C.t2 },
  });
}
