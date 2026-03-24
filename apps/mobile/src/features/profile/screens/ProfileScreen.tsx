import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Sparkles } from 'lucide-react-native';
import { usePlayerStats } from '@mobile/shared/hooks/usePlayerStats';
import { useProfile } from '../hooks/useProfile';
import { useWeeklyBrief } from '@features/coach/hooks/useWeeklyBrief';
import { ProfileHeader } from '../components/ProfileHeader';
import { GearTab } from '../components/GearTab';
import { RunsTab } from '../components/RunsTab';
import { StatsTab } from '../components/StatsTab';
import { AwardsTab } from '../components/AwardsTab';
import { NutritionTab } from '../components/NutritionTab';
import { EditProfileSheet } from '../components/EditProfileSheet';
import type { ProfileTab } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const C = { bg: '#F8F6F3', black: '#0A0A0A', t3: '#ADADAD', border: '#DDD9D4', red: '#D93518' };

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { player, loading, xpProgress } = usePlayerStats();
  const {
    runs, shoes, weeklyGoalKm, personalRecords, thisWeekKm,
    tab, setTab, avatarColor, displayName, bio,
    isEditing, editName, setEditName, editColor, setEditColor, editBio, setEditBio,
    startEdit, saveEdit, cancelEdit,
  } = useProfile();

  const { brief } = useWeeklyBrief();
  const displayedName = displayName || player?.username || 'Runner';
  const totalKm = runs.reduce((s, r) => s + r.distanceMeters / 1000, 0);

  if (loading) return <SafeAreaView style={[ss.root, ss.center]}><ActivityIndicator color={C.red} /></SafeAreaView>;

  return (
    <SafeAreaView style={ss.root}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ProfileHeader
          displayName={displayedName} bio={bio} avatarColor={avatarColor}
          level={player?.level ?? 1} xpPercent={xpProgress?.percent ?? 0}
          totalKm={totalKm} totalRuns={runs.length} thisWeekKm={thisWeekKm}
          totalTerritories={player?.totalTerritoriesClaimed ?? 0} weeklyGoalKm={weeklyGoalKm}
          onEditPress={startEdit} onNotificationsPress={() => navigation.navigate('Notifications')}
          onSettingsPress={() => navigation.navigate('Settings')}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ss.tabsScroll} contentContainerStyle={ss.tabsContent}>
          {(['overview', 'stats', 'awards', 'nutrition', 'gear'] as ProfileTab[]).map(t => (
            <Pressable key={t} style={[ss.tab, tab === t && ss.tabActive]} onPress={() => setTab(t)}>
              <Text style={[ss.tabLabel, tab === t && ss.tabLabelActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={ss.content}>
          {tab === 'overview' && (
            <>
              {brief && (
                <View style={ss.briefCard}>
                  <View style={ss.briefHeader}>
                    <Sparkles size={13} color="#8B5CF6" strokeWidth={1.5} />
                    <Text style={ss.briefTitle}>THIS WEEK</Text>
                  </View>
                  <Text style={ss.briefHeadline}>{brief.headline}</Text>
                  <Text style={ss.briefTip}>{brief.tip}</Text>
                </View>
              )}
              <RunsTab runs={runs} />
            </>
          )}
          {tab === 'stats' && (
            <StatsTab personalRecords={personalRecords} totalRuns={runs.length} totalKm={totalKm}
              totalTerritories={player?.totalTerritoriesClaimed ?? 0} streakDays={player?.streakDays ?? 0} />
          )}
          {tab === 'awards' && <AwardsTab />}
          {tab === 'nutrition' && <NutritionTab />}
          {tab === 'gear' && <GearTab shoes={shoes} onAddShoe={() => navigation.navigate('GearAdd')} />}
        </View>
      </ScrollView>

      {isEditing && (
        <EditProfileSheet
          editName={editName} setEditName={setEditName} editBio={editBio} setEditBio={setEditBio}
          editColor={editColor} setEditColor={setEditColor} onSave={saveEdit} onCancel={cancelEdit}
        />
      )}
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, center: { alignItems: 'center', justifyContent: 'center' }, content: { padding: 20 },
  briefCard:    { backgroundColor: '#fff', borderRadius: 12, borderWidth: 0.5, borderColor: '#DDD9D4', padding: 14, marginBottom: 14 },
  briefHeader:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  briefTitle:   { fontFamily: 'Barlow_500Medium', fontSize: 10, letterSpacing: 1, color: '#ADADAD' },
  briefHeadline:{ fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.black, marginBottom: 4 },
  briefTip:     { fontFamily: 'Barlow_300Light', fontSize: 12, color: '#6B6B6B', lineHeight: 18 },
  tabsScroll: { borderBottomWidth: 0.5, borderBottomColor: C.border, backgroundColor: '#fff' },
  tabsContent: { paddingHorizontal: 12 },
  tab: { paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: C.black }, tabLabel: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t3 }, tabLabelActive: { fontFamily: 'Barlow_500Medium', color: C.black },
});
