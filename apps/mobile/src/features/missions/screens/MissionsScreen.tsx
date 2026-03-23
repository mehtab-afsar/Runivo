import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useMissions } from '../hooks/useMissions';
import { MissionCard } from '../components/MissionCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const C = { bg: '#EDEAE5', white: '#FFFFFF', border: '#DDD9D4', black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD', red: '#D93518', green: '#1A6B40' };

export default function MissionsScreen() {
  const navigation = useNavigation<Nav>();
  const { missions, loading, refreshing, refresh, claimReward } = useMissions();
  const completed = missions.filter(m => m.completed).length;
  const total = missions.length;

  return (
    <SafeAreaView style={ss.root}>
      <View style={ss.header}>
        <Pressable onPress={() => navigation.goBack()} style={ss.backBtn}><Text style={ss.backText}>←</Text></Pressable>
        <Text style={ss.headerTitle}>Daily Missions</Text>
        <View style={{ width: 32 }} />
      </View>

      {!loading && total > 0 && (
        <View style={ss.summaryCard}>
          <Text style={ss.summaryTitle}>Today's progress</Text>
          <View style={ss.summaryRow}>
            <Text style={ss.summaryCount}>{completed}/{total}</Text>
            <View style={ss.summaryBarBg}>
              <View style={[ss.summaryBarFill, { flex: completed / Math.max(total, 1) }]} />
              <View style={{ flex: 1 - completed / Math.max(total, 1) }} />
            </View>
          </View>
        </View>
      )}

      {loading ? (
        <View style={ss.loader}><ActivityIndicator color={C.red} /></View>
      ) : (
        <FlatList
          data={missions} keyExtractor={m => m.id}
          renderItem={({ item }) => <MissionCard mission={item} onClaim={claimReward} />}
          contentContainerStyle={ss.list} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
          ListEmptyComponent={
            <View style={ss.emptyWrap}>
              <Text style={ss.emptyTitle}>No missions today</Text>
              <Text style={ss.emptyText}>Complete a run to unlock daily missions.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  backBtn: { width: 32, alignItems: 'flex-start' }, backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  headerTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  summaryCard: { marginHorizontal: 16, backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 14, marginBottom: 8 },
  summaryTitle: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryCount: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.black, width: 36 },
  summaryBarBg: { flex: 1, height: 4, backgroundColor: '#E8E4DF', borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  summaryBarFill: { height: 4, backgroundColor: C.green },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 10 },
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  emptyText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center' },
});
