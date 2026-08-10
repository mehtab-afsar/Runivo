import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { usePlayerStats } from '@mobile/shared/hooks/usePlayerStats';
import { GAME_CONFIG } from '@shared/services/config';
import { useProfile } from '../hooks/useProfile';
import { ProfileHeader } from '../components/ProfileHeader';
import { OverviewTab } from '../components/OverviewTab';
import { ActivityFeedTab } from '../components/ActivityFeedTab';
import { IntelligenceTab } from '../components/IntelligenceTab';
import { TerritoryTab } from '../components/TerritoryTab';
import { StatsTab } from '../components/StatsTab';
import { NutritionTab } from '../components/NutritionTab';
import { EditProfileSheet } from '../components/EditProfileSheet';
import { AwardsTab } from '../components/AwardsTab';
import type { ProfileTab } from '../types';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { FEATURES } from '../../../config/features';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// 'gear' isn't a ProfileTab — it has no in-page content, it jumps straight to
// the full standalone Gear screen (retire/delete/default/foot-scan), which is
// already built and was simply unreachable from anywhere in the app. Keeping
// shoe management there instead of duplicating a second copy of it here.
const ALL_TABS: { key: ProfileTab | 'gear'; label: string }[] = [
  { key: 'overview',      label: 'Overview' },
  { key: 'activity',      label: 'Activity' },
  { key: 'stats',         label: 'Stats' },
  { key: 'territory',     label: 'Territory' },
  { key: 'intelligence',  label: 'Intelligence' },
  { key: 'awards',        label: 'Awards' },
  { key: 'nutrition',     label: 'Nutrition' },
  { key: 'gear',          label: 'Gear' },
];

// Each of these tabs is gated behind a feature flag that's currently off in
// production — hidden here rather than shown-then-ComingSoon'd, since a
// horizontal tab strip has no room for a "SOON" treatment the way the bottom
// tab bar does, and there's no legitimate always-on content to show for the
// nutrition tab (unlike, say, RunSummaryScreen's calorie estimate) once its
// tracker is disabled.
const TABS = ALL_TABS.filter(t =>
  (t.key !== 'intelligence' || FEATURES.AI_COACH) &&
  (t.key !== 'gear' || FEATURES.GEAR_TRACKING) &&
  (t.key !== 'nutrition' || FEATURES.NUTRITION_TRACKER),
);

export default function ProfileScreen() {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { player, totalAreaM2, loading } = usePlayerStats();
  const {
    runs, weeklyGoalKm, personalRecords, thisWeekKm, followers, following,
    tab, setTab, avatarColor, avatarUri, displayName, bio, location, instagram, strava,
    isEditing, editName, setEditName, editColor, setEditColor, editBio, setEditBio,
    editLocation, setEditLocation, editInstagram, setEditInstagram, editStrava, setEditStrava,
    editAvatarUri, pickAvatar,
    startEdit, saveEdit, cancelEdit,
    earnedAwards,
    statsData, statsPeriod, setStatsPeriod,
    pinnedRunId, pinRun,
    refreshCounts,
  } = useProfile();

  // Follow/unfollow from FollowersScreen or FollowingScreen doesn't update this
  // screen's state — refresh just the counts (not a full reload) whenever the
  // Profile tab regains focus.
  useFocusEffect(useCallback(() => { refreshCounts(); }, [refreshCounts]));

  const displayedName = displayName || player?.username || 'Runner';
  const totalKm = runs.reduce((s, r) => s + r.distanceMeters / 1000, 0);

  const runnerRank = player?.runnerRank ?? 'pacer';
  const paceTotalEarned = player?.paceTotalEarned ?? 0;
  const thresholds = GAME_CONFIG.RUNNER_RANK_THRESHOLDS;
  const RANK_ORDER = ['pacer', 'strider', 'chaser', 'hunter', 'sovereign'] as const;
  const rankIdx = RANK_ORDER.indexOf(runnerRank as typeof RANK_ORDER[number]);
  const rankPct = (() => {
    if (runnerRank === 'sovereign') return 1;
    const curr = thresholds[runnerRank] ?? 0;
    const next  = thresholds[RANK_ORDER[rankIdx + 1]] ?? curr;
    const span  = next - curr;
    return span > 0 ? Math.min(1, (paceTotalEarned - curr) / span) : 0;
  })();

  if (loading) return <SafeAreaView style={[ss.root, ss.center]}><ActivityIndicator color={C.red} /></SafeAreaView>;

  return (
    <SafeAreaView style={ss.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ProfileHeader
          displayName={displayedName} username={player?.username} bio={bio} avatarColor={avatarColor} avatarUri={avatarUri}
          location={location} instagram={instagram} strava={strava}
          runnerRank={runnerRank} rankPct={rankPct}
          totalKm={totalKm} totalRuns={runs.length} thisWeekKm={thisWeekKm}
          totalTerritories={player?.totalTerritoriesClaimed ?? 0} totalAreaM2={totalAreaM2}
          weeklyGoalKm={weeklyGoalKm} followers={followers} following={following}
          onEditPress={startEdit} onNotificationsPress={() => navigation.navigate('Notifications')}
          onSettingsPress={() => navigation.navigate('Settings')}
          onFollowersPress={() => navigation.navigate('Followers', { userId: player?.id ?? '' })}
          onFollowingPress={() => navigation.navigate('Following', { userId: player?.id ?? '' })}
          onTerritoryPress={() => setTab('territory')}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ss.tabsScroll} contentContainerStyle={ss.tabsContent}>
          {TABS.map(t => (
            <Pressable
              key={t.key}
              style={[ss.tab, tab === t.key && ss.tabActive]}
              onPress={() => t.key === 'gear' ? navigation.navigate('Gear') : setTab(t.key)}
            >
              <Text style={[ss.tabLabel, tab === t.key && ss.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={ss.content}>
          {tab === 'overview' && (
            <OverviewTab
              runs={runs}
              thisWeekKm={thisWeekKm}
              player={player}
              earnedAwards={earnedAwards}
              pinnedRunId={pinnedRunId}
              onViewAllActivity={() => setTab('activity')}
              onViewAllAwards={() => setTab('awards')}
              onPinRun={pinRun}
            />
          )}
          {tab === 'activity' && <ActivityFeedTab runs={runs} isOwn />}
          {tab === 'stats' && (
            <StatsTab
              personalRecords={personalRecords}
              totalRuns={runs.length}
              totalKm={totalKm}
              totalTerritories={player?.totalTerritoriesClaimed ?? 0}
              streakDays={player?.streakDays ?? 0}
              runs={runs}
              statsData={statsData}
              statsPeriod={statsPeriod}
              onPeriodChange={setStatsPeriod}
            />
          )}
          {tab === 'territory' && <TerritoryTab />}
          {tab === 'intelligence' && FEATURES.AI_COACH && (
            <IntelligenceTab runs={runs} personalRecords={personalRecords} />
          )}
          {tab === 'awards' && (
            <AwardsTab
              earnedAwards={earnedAwards}
              totalKm={totalKm}
              streakDays={player?.streakDays ?? 0}
              totalTerritoriesClaimed={player?.totalTerritoriesClaimed ?? 0}
              paceTotalEarned={player?.paceTotalEarned ?? 0}
              runs={runs}
            />
          )}
          {tab === 'nutrition' && <NutritionTab />}
        </View>
      </ScrollView>

      {isEditing && (
        <EditProfileSheet
          editName={editName} setEditName={setEditName}
          editBio={editBio} setEditBio={setEditBio}
          editColor={editColor} setEditColor={setEditColor}
          editLocation={editLocation} setEditLocation={setEditLocation}
          editInstagram={editInstagram} setEditInstagram={setEditInstagram}
          editStrava={editStrava} setEditStrava={setEditStrava}
          editAvatarUri={editAvatarUri} onPickAvatar={pickAvatar}
          onSave={saveEdit} onCancel={cancelEdit}
        />
      )}
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    center: { alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: Spacing.gutter, paddingTop: 20, paddingBottom: 40 },
    tabsScroll: { borderBottomWidth: 0.5, borderBottomColor: C.border, backgroundColor: C.bg },
    tabsContent: { paddingHorizontal: Spacing.gutter },
    tab: { paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: C.black },
    tabLabel: { fontFamily: Fonts.regular, fontSize: 13, color: C.t3 },
    tabLabelActive: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.black },
  });
}
