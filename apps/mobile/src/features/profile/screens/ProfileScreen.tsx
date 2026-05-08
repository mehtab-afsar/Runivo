import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { usePlayerStats } from '@mobile/shared/hooks/usePlayerStats';
import { useProfile } from '../hooks/useProfile';
import { ProfileHeader } from '../components/ProfileHeader';
import { ActivityFeedTab } from '../components/ActivityFeedTab';
import { StatsTab } from '../components/StatsTab';
import { AwardsTab } from '../components/AwardsTab';
import { TerritoryTab } from '../components/TerritoryTab';
import { EditProfileSheet } from '../components/EditProfileSheet';
import type { ProfileTab } from '../types';
import { useTheme, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'activity',   label: 'Activity' },
  { key: 'stats',      label: 'Stats' },
  { key: 'territory',  label: 'Territory' },
  { key: 'awards',     label: 'Awards' },
];

export default function ProfileScreen() {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { player, loading, xpProgress } = usePlayerStats();
  const {
    runs, weeklyGoalKm, personalRecords, thisWeekKm, followers, following,
    tab, setTab, avatarColor, avatarUri, displayName, bio, location, instagram, strava,
    isEditing, editName, setEditName, editColor, setEditColor, editBio, setEditBio,
    editLocation, setEditLocation, editInstagram, setEditInstagram, editStrava, setEditStrava,
    editAvatarUri, pickAvatar,
    startEdit, saveEdit, cancelEdit,
  } = useProfile();

  const displayedName = displayName || player?.username || 'Runner';
  const totalKm = runs.reduce((s, r) => s + r.distanceMeters / 1000, 0);

  if (loading) return <SafeAreaView style={[ss.root, ss.center]}><ActivityIndicator color={C.red} /></SafeAreaView>;

  return (
    <SafeAreaView style={ss.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ProfileHeader
          displayName={displayedName} bio={bio} avatarColor={avatarColor} avatarUri={avatarUri}
          location={location} instagram={instagram} strava={strava}
          level={player?.level ?? 1} xpPercent={xpProgress?.percent ?? 0}
          totalKm={totalKm} totalRuns={runs.length} thisWeekKm={thisWeekKm}
          totalTerritories={player?.totalTerritoriesClaimed ?? 0} weeklyGoalKm={weeklyGoalKm}
          followers={followers} following={following}
          onEditPress={startEdit} onNotificationsPress={() => navigation.navigate('Notifications')}
          onSettingsPress={() => navigation.navigate('Settings')}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ss.tabsScroll} contentContainerStyle={ss.tabsContent}>
          {TABS.map(t => (
            <Pressable key={t.key} style={[ss.tab, tab === t.key && ss.tabActive]} onPress={() => setTab(t.key)}>
              <Text style={[ss.tabLabel, tab === t.key && ss.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={ss.content}>
          {tab === 'activity' && <ActivityFeedTab runs={runs} />}
          {tab === 'stats' && (
            <StatsTab
              personalRecords={personalRecords} totalRuns={runs.length} totalKm={totalKm}
              totalTerritories={player?.totalTerritoriesClaimed ?? 0} streakDays={player?.streakDays ?? 0}
              runs={runs}
            />
          )}
          {tab === 'territory' && <TerritoryTab />}
          {tab === 'awards' && (
            <AwardsTab
              runs={runs} streakDays={player?.streakDays ?? 0}
              totalTerritories={player?.totalTerritoriesClaimed ?? 0} level={player?.level ?? 1}
            />
          )}
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
    content: { padding: 20 },
    tabsScroll: { borderBottomWidth: 0.5, borderBottomColor: C.border, backgroundColor: '#fff' },
    tabsContent: { paddingHorizontal: 12 },
    tab: { paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: C.black },
    tabLabel: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t3 },
    tabLabelActive: { fontFamily: 'Barlow_500Medium', color: C.black },
  });
}
