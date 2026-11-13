import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { usePlayerStats } from '@mobile/shared/hooks/usePlayerStats';
import { GAME_CONFIG } from '@shared/services/config';
import { useProfile } from '../hooks/useProfile';
import { ProfileHeader } from '../components/ProfileHeader';
import { EditProfileSheet } from '../components/EditProfileSheet';
import { AwardsTab } from '../components/AwardsTab';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { ProfileMockSections } from '../components/ProfileMockSections';
import { useFeatureGate } from '@features/subscription/hooks/useFeatureGate';
import { getTerritoryPolygons } from '@shared/services/store';
import { fetchClubs } from '@features/clubs/services/clubService';
import {
  SportFilterBar, ThisWeekCard, StatsCard, RecentActivities, BestEfforts, TerritoryCard,
} from '../components/ProfileActivity';
import type { SportFilter } from '../utils/profileStats';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
    refreshCounts,
  } = useProfile();

  // Follow/unfollow from FollowersScreen or FollowingScreen doesn't update this
  // screen's state — refresh just the counts (not a full reload) whenever the
  // Profile tab regains focus.
  useFocusEffect(useCallback(() => { refreshCounts(); }, [refreshCounts]));

  // Zones held right now (not lifetime claims) and clubs joined, for the
  // stat row, the Plus zone-cap card and the Clubs row.
  const gate = useFeatureGate();
  // Strava-style: one sport filter drives This week, Statistics and Recent.
  const [sport, setSport] = useState<SportFilter>('all');
  const [zonesHeld, setZonesHeld] = useState<number | null>(null);
  const [clubCount, setClubCount] = useState<number | null>(null);
  const playerId = player?.id;
  useEffect(() => {
    if (!playerId) return;
    getTerritoryPolygons(playerId).then(z => setZonesHeld(z.length)).catch(() => {});
    fetchClubs(playerId).then(cs => setClubCount(cs.filter(c => c.joined).length)).catch(() => {});
  }, [playerId]);

  const displayedName = displayName || player?.username || 'Runner';
  const totalKm = runs.filter(r => !r.excluded).reduce((s, r) => s + r.distanceMeters / 1000, 0);

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
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const rankCaption = runnerRank === 'sovereign'
    ? `${capitalize(runnerRank)} · ${paceTotalEarned.toLocaleString()} PACE — top rank`
    : `${capitalize(runnerRank)} → ${capitalize(RANK_ORDER[rankIdx + 1])} · ${paceTotalEarned.toLocaleString()} / ${(thresholds[RANK_ORDER[rankIdx + 1]] ?? 0).toLocaleString()} PACE`;

  if (loading) return <SafeAreaView style={[ss.root, ss.center]}><ActivityIndicator color={C.red} /></SafeAreaView>;

  return (
    <SafeAreaView style={ss.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <ProfileHeader
          displayName={displayedName} username={player?.username} bio={bio} avatarColor={avatarColor} avatarUri={avatarUri}
          location={location} instagram={instagram} strava={strava}
          runnerRank={runnerRank} rankPct={rankPct} rankCaption={rankCaption}
          totalKm={totalKm} totalRuns={runs.length} thisWeekKm={thisWeekKm}
          totalTerritories={zonesHeld ?? player?.totalTerritoriesClaimed ?? 0} totalAreaM2={totalAreaM2}
          paceTotalEarned={paceTotalEarned}
          weeklyGoalKm={weeklyGoalKm} followers={followers} following={following}
          onEditPress={startEdit} onNotificationsPress={() => navigation.navigate('Notifications')}
          onSettingsPress={() => navigation.navigate('Settings')}
          onFollowersPress={() => navigation.navigate('Followers', { userId: player?.id ?? '' })}
          onFollowingPress={() => navigation.navigate('Following', { userId: player?.id ?? '' })}
          onTerritoryPress={() => setTab('territory')}
        />

        <View style={ss.sections}>
          <SportFilterBar value={sport} onChange={setSport} />
          <ThisWeekCard runs={runs} sport={sport} weeklyGoalKm={weeklyGoalKm} />
          <StatsCard runs={runs} sport={sport} />
          <RecentActivities
            runs={runs}
            sport={sport}
            onOpen={r => navigation.navigate('RunSummary', { runId: r.id, activityType: r.activityType })}
            onAll={() => navigation.navigate('History')}
          />
          {(sport === 'all' || sport === 'run') && <BestEfforts records={personalRecords} />}
          <TerritoryCard
            zonesHeld={zonesHeld ?? 0}
            areaM2={totalAreaM2}
            lifetimeClaims={player?.totalTerritoriesClaimed ?? 0}
            onOpen={() => navigation.navigate('Main', { screen: 'Map' })}
          />
          <Pressable style={ss.linkCard} onPress={() => navigation.navigate('YearInRunivo')} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={ss.linkTitle}>Your {new Date().getFullYear()} in Runivo</Text>
              <Text style={ss.linkSub}>Distance, zones, steals and your best month</Text>
            </View>
            <Text style={ss.linkChev}>›</Text>
          </Pressable>
          <Pressable style={ss.linkCard} onPress={() => navigation.navigate('MyRewards')} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={ss.linkTitle}>My rewards</Text>
              <Text style={ss.linkSub}>Codes you redeemed with PACE</Text>
            </View>
            <Text style={ss.linkChev}>›</Text>
          </Pressable>
        </View>

        <ProfileMockSections
          hideBest
          runs={runs}
          earnedAwards={earnedAwards}
          personalRecords={personalRecords}
          zonesHeld={zonesHeld ?? 0}
          zoneLimit={gate.territoryLimit}
          isPlus={gate.isPremium}
          clubCount={clubCount}
          onSeeAllAwards={() => setTab(t => (t === 'awards' ? 'overview' : 'awards'))}
          onUpgrade={() => navigation.navigate('Subscription', { reason: 'zone_limit' })}
          onClubs={() => navigation.navigate('Club')}
          onConnected={() => navigation.navigate('ConnectedDevices')}
          onPrivacy={() => navigation.navigate('Settings')}
        />

        {/* "See all" on the awards card opens the full grid here. */}
        {tab === 'awards' && (
          <View style={ss.content}>
            <AwardsTab
              earnedAwards={earnedAwards}
              totalKm={totalKm}
              streakDays={player?.streakDays ?? 0}
              totalTerritoriesClaimed={player?.totalTerritoriesClaimed ?? 0}
              paceTotalEarned={player?.paceTotalEarned ?? 0}
              runs={runs}
            />
          </View>
        )}
      </ScrollView>

      {isEditing && (
        <EditProfileSheet
          username={player?.username}
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
    content: { paddingHorizontal: Spacing.gutter, paddingTop: 16, paddingBottom: 40 },
    sections: { paddingHorizontal: 18, gap: 12, marginBottom: 12 },
    linkCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, padding: 16 },
    linkTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    linkSub: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 2 },
    linkChev: { fontFamily: Fonts.regular, fontSize: 22, color: C.t3 },
    tabsScroll: { backgroundColor: C.bg, marginTop: 4 },
    moreLabel: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1, paddingHorizontal: Spacing.gutter, marginTop: 22, marginBottom: 8 },
    tabsContent: { paddingHorizontal: Spacing.gutter, gap: 8 },
    // Segmented pills: active one is ink, the rest quiet outlines.
    tab: {
      height: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center',
      borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    tabActive: { backgroundColor: C.t1, borderColor: C.t1 },
    tabLabel: { fontFamily: Fonts.medium, fontSize: 13, color: C.t2 },
    tabLabelActive: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.bg },
  });
}
