/**
 * "You": the runner's own profile, laid out like Strava's with Runivo's game
 * on top (Runivo final app mock). Header, then four tabs: Progress (this
 * week, streak, territory, best efforts, PACE), Activities, Gallery (route
 * shapes) and More (statistics, gear, trophies, clubs).
 */
import { StatusBarScrim } from '@mobile/shared/components/StatusBarScrim';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GoalsCard } from '@features/goals/GoalsCard';
import { ActivityCards } from '../components/ActivityCards';
import { MagnifyingGlass, GearSix, Pulse, ChartBar, Hexagon, MapTrifold, Timer, Sneaker, Crown, CaretRight, CalendarDots, Barbell, Rows, Plus, ChartLineUp, ImagesSquare, DotsThree } from 'phosphor-react-native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { usePlayerStats } from '@mobile/shared/hooks/usePlayerStats';
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
import { YouHeader, WeekCard, PinnedCard, MenuList, TrophyStrip, ClubsStrip, activityName, fmtKm, type MenuItem, SportChips, weekStreak } from '../components/YouSections';
import { BestEfforts } from '../components/ProfileActivity';
import { RouteGallery } from '../components/RouteGallery';
import { periodStats, filterBySport, type SportFilter } from '../utils/profileStats';
import { Segmented } from '@mobile/shared/components/Segmented';
import { SUBSCRIPTIONS_ENABLED } from '@shared/engine/entitlements';

type YouTab = 'progress' | 'activities' | 'gallery' | 'more';
const TABS: { key: YouTab; label: string; Icon: typeof ChartLineUp }[] = [
  { key: 'progress',   label: 'Progress',   Icon: ChartLineUp },
  { key: 'activities', label: 'Activities', Icon: Pulse },
  { key: 'gallery',    label: 'Gallery',    Icon: ImagesSquare },
  { key: 'more',       label: 'More',       Icon: DotsThree },
];

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RankName = 'pacer' | 'strider' | 'chaser' | 'hunter' | 'sovereign';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ProfileScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { player, totalAreaM2, territoryScore, loading } = usePlayerStats();
  const {
    runs, weeklyGoalKm, personalRecords, followers, following,
    avatarColor, avatarUri, displayName, location, bio,
    isEditing, editInitial, startEdit, cancelEdit, saveProfile,
    earnedAwards, refreshCounts, pinnedRunId, pinRun, setWeeklyGoal,
  } = useProfile();
  useFocusEffect(useCallback(() => { refreshCounts(); }, [refreshCounts]));

  const gate = useFeatureGate();
  const [sport, setSport] = useState<SportFilter>('all');
  const [goalOpen, setGoalOpen] = useState(false);
  const [showAwards, setShowAwards] = useState(false);
  const [tab, setTab] = useState<YouTab>('progress');
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
  const rank = (player?.runnerRank ?? 'pacer') as RankName;
  const earned = player?.paceTotalEarned ?? 0;

  const streak = useMemo(() => weekStreak(runs), [runs]);
  const latest = useMemo(() => runs.filter(r => r.distanceMeters >= 50).sort((a, b) => b.startTime - a.startTime)[0], [runs]);
  // The run pinned from Activities, shown under This week (Runivo profile mock).
  const pinnedRun = useMemo(() => (pinnedRunId ? runs.find(r => r.id === pinnedRunId) ?? null : null), [runs, pinnedRunId]);
  const counted = useMemo(() => runs.filter(r => !r.excluded && r.distanceMeters >= 50), [runs]);
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
    { key: 'goal', label: 'Weekly goal', Icon: ChartLineUp, sub: `${fmtKm(weeklyGoalKm)} km a week · tap to change`, onPress: () => setGoalOpen(true) },
    { key: 'strength', label: 'Strength and mobility', Icon: Barbell, sub: '8–17 minute guided sessions', onPress: () => navigation.navigate('Strength') },
    { key: 'terr', label: 'Territory', Icon: Hexagon, red: true, sub: `${zonesHeld ?? 0} ${zonesHeld === 1 ? 'zone' : 'zones'} · ${areaKm2 >= 0.01 ? areaKm2.toFixed(2) : '0'} km²${legendOf > 0 ? ` · legend of ${legendOf}` : ''}`, onPress: () => navigation.navigate('TerritoryMap', {}) },
    { key: 'routes', label: 'Routes', Icon: MapTrifold, sub: routeCount > 0 ? `${routeCount} saved` : 'Save one from any activity', onPress: () => navigation.navigate('Main', { screen: 'Run' }) },
    { key: 'best', label: 'Best efforts', Icon: Timer, sub: best5k || best10k ? [best5k && `5K ${best5k}`, best10k && `10K ${best10k}`].filter(Boolean).join(' · ') : 'Run a 5K to set one', onPress: () => navigation.navigate('ProfileStats', { sport: 'run' }) },
    ...(FEATURES.GEAR_TRACKING ? [{ key: 'gear', label: 'Gear', Icon: Sneaker, sub: 'Shoes and their distance', onPress: () => navigation.navigate('Gear') } as MenuItem] : []),
  ];

  if (loading) return <View style={[s.root, s.center]}><ActivityIndicator color={C.red} /></View>;

  return (
    <View style={s.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130, gap: 16 }}>
        {/* White header block (mock): title and actions, identity, tabs. */}
        <View style={[s.headBlock, { paddingTop: insets.top + 8 }]}>
          <View style={s.topBar}>
            <Text style={s.title}>You</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={s.iconBtn} accessibilityLabel="Add a manual activity" accessibilityRole="button" onPress={() => navigation.navigate('LogTreadmill')}>
                <Plus size={20} color={C.t1} weight="bold" />
              </Pressable>
              <Pressable style={s.iconBtn} accessibilityLabel="Search" accessibilityRole="button" onPress={() => navigation.navigate('Feed', { search: true })}>
                <MagnifyingGlass size={20} color={C.t1} />
              </Pressable>
              <Pressable style={s.iconBtn} accessibilityLabel="Settings" accessibilityRole="button" onPress={() => navigation.navigate('Settings')}>
                <GearSix size={20} color={C.t1} />
              </Pressable>
            </View>
          </View>

          <YouHeader
            name={name} location={location} avatarUri={avatarUri} avatarColor={avatarColor} faceSeed={player?.username}
            rankLabel={cap(rank)} runCount={counted.length}
            isPlus={SUBSCRIPTIONS_ENABLED && gate.isPremium} bio={bio}
            following={following} followers={followers}
            onFollowing={() => navigation.navigate('Following', { userId: playerId ?? '' })}
            onFollowers={() => navigation.navigate('Followers', { userId: playerId ?? '' })}
            onEdit={startEdit}
            onShare={() => {
              if (!playerId) return;
              navigation.navigate('ShareProfile', {
                userId: playerId, name, username: player?.username, rank: cap(rank),
                runs: counted.length, km: counted.reduce((n, r) => n + (r.verifiedDistanceKm ?? r.distanceMeters / 1000), 0),
                zones: zonesHeld ?? 0, avatarUri,
              });
            }}
          />

          <Segmented variant="tabs" style={{ backgroundColor: C.card }} options={TABS.map(t => ({ value: t.key, label: t.label }))} value={tab} onChange={setTab}
            renderLabel={(o, on) => {
              const t = TABS.find(x => x.key === o.value)!;
              return <>
                <t.Icon size={22} color={on ? C.t1 : C.t3} weight={on ? 'fill' : 'regular'} />
                <Text style={[s.tabTxt, on && s.tabTxtOn]}>{t.label}</Text>
              </>;
            }} />
        </View>

        {tab === 'progress' && (
          <>
            <SportChips value={sport} onChange={setSport} />
            <WeekCard runs={runs} sport={sport} />
            {pinnedRun && (
              <PinnedCard
                run={pinnedRun}
                onOpen={() => navigation.navigate('RunSummary', { runId: pinnedRun.id, activityType: pinnedRun.activityType })}
                onUnpin={() => pinRun(null)}
              />
            )}
            <View style={s.tiles}>
              <Pressable style={[s.tile, { backgroundColor: C.card }]} onPress={() => navigation.navigate('TrainingLog')} accessibilityRole="button">
                <Text style={s.tileLabel}>Streak</Text>
                <Text style={s.tileNum}>{streak.weeks}<Text style={s.tileUnit}> {streak.weeks === 1 ? 'week' : 'weeks'}</Text></Text>
                <View style={s.streakBars}>
                  {streak.last8.map((k, i) => (
                    <View key={i} style={[s.streakBar, { backgroundColor: k === 'done' ? C.brandGreen : k === 'now' ? C.lime : C.border }]} />
                  ))}
                </View>
                <Text style={s.tileSub}>{streak.last8[streak.last8.length - 1] === 'now' ? 'This week counts. Nice.' : 'Run once by Sunday to keep it'}</Text>
              </Pressable>
              <Pressable style={[s.tile, { backgroundColor: C.alwaysDark }]} onPress={() => navigation.navigate('TerritoryMap', {})} accessibilityRole="button">
                <Text style={[s.tileLabel, { color: C.alwaysLight }]}>Territory</Text>
                <Text style={[s.tileNum, { color: C.alwaysLight }]}>{zonesHeld ?? 0}<Text style={[s.tileUnit, { color: '#C9CCC4' }]}> {zonesHeld === 1 ? 'zone' : 'zones'}</Text></Text>
                <Text style={[s.tileSub, { color: C.lime, fontSize: 13 }]}>{Math.round(totalAreaM2).toLocaleString()} m² held</Text>
                <Text style={[s.tileSub, { color: '#C9CCC4' }]}>Score {territoryScore.toLocaleString()}</Text>
              </Pressable>
            </View>
            <BestEfforts records={personalRecords} />
            <Pressable style={s.pace} onPress={() => navigation.navigate('PACEStore')} accessibilityRole="button" accessibilityLabel={`${(player?.paceBalance ?? 0).toLocaleString()} PACE. Open the PACE Store`}>
              <Hexagon size={30} color={C.rivalAmber} weight="fill" />
              <View style={{ flex: 1 }}>
                <Text style={s.paceTitle}>{(player?.paceBalance ?? 0).toLocaleString()} PACE</Text>
                <Text style={s.paceSub}>{earned.toLocaleString()} earned all time · PACE Store</Text>
              </View>
              <CaretRight size={14} color={C.amber} weight="bold" />
            </Pressable>
            {!gate.isPremium && Number.isFinite(gate.territoryLimit) && (
              <Pressable style={s.plus} onPress={() => navigation.navigate('Subscription', { reason: 'zone_limit' })} accessibilityRole="button">
                <Crown size={20} color={C.lime} />
                <View style={{ flex: 1 }}>
                  <Text style={s.plusTitle}>{Math.min(zonesHeld ?? 0, gate.territoryLimit)} of {gate.territoryLimit} zones used</Text>
                  <Text style={s.plusSub}>Runivo Plus removes the cap</Text>
                </View>
                <CaretRight size={14} color={C.alwaysLight} weight="bold" />
              </Pressable>
            )}
          </>
        )}

        {tab === 'activities' && (
          <ActivityCards
            runs={runs} sport="all" pinnedId={pinnedRunId} onPin={pinRun}
            onOpen={(r) => navigation.navigate('RunSummary', { runId: r.id, activityType: r.activityType })}
            onAll={() => navigation.navigate('History')}
          />
        )}

        {tab === 'gallery' && (
          <RouteGallery runs={runs} onOpen={(r) => navigation.navigate('RunSummary', { runId: r.id, activityType: r.activityType })} />
        )}

        {tab === 'more' && (
          <>
            <View style={{ marginHorizontal: 20, marginBottom: 12 }}><GoalsCard /></View>
            <MenuList items={menu} />
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
              onAll={() => navigation.navigate('Main', { screen: 'Groups' })}
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
          </>
        )}
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
      <StatusBarScrim />
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    center: { alignItems: 'center', justifyContent: 'center' },
    headBlock: { backgroundColor: C.card, gap: 14 },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
    title: { fontFamily: Fonts.semiBold, fontSize: 26, color: C.t1, letterSpacing: -0.5 },
    iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    plus: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 18, padding: 16, borderRadius: 22, backgroundColor: C.alwaysDark },
    plusTitle: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysLight },
    plusSub: { fontFamily: Fonts.regular, fontSize: 12, color: '#C9CCC4', marginTop: 2 },
    tabTxt: { fontFamily: Fonts.regular, fontSize: 12, color: '#9A9E96' },
    tabTxtOn: { fontFamily: Fonts.semiBold, color: C.t1 },
    tiles: { flexDirection: 'row', gap: 12, marginHorizontal: 20 },
    tile: { flex: 1, borderRadius: 24, padding: 16, gap: 10 },
    streakBars: { flexDirection: 'row', gap: 4 },
    streakBar: { flex: 1, height: 22, borderRadius: 6 },
    tileLabel: { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    tileNum: { fontFamily: Fonts.numeric, fontSize: 32, letterSpacing: -0.8, color: C.t1 },
    tileUnit: { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    tileSub: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    pace: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 20, padding: 16, borderRadius: 24, backgroundColor: C.amberBg },
    paceTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    paceSub: { fontFamily: Fonts.regular, fontSize: 13, color: '#7A5525', marginTop: 2 },
    footer: { marginHorizontal: 18, backgroundColor: C.card, borderRadius: 18, paddingHorizontal: 14 },
    footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
    footBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    footTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    footVal: { fontFamily: Fonts.medium, fontSize: 13, color: C.t2 },
  });
}
