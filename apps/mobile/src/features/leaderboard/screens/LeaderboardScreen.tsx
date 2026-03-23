import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { EntryRow } from '../components/EntryRow';
import { LeaderboardFilters } from '../components/LeaderboardFilters';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const C = { bg: '#EDEAE5', black: '#0A0A0A', t2: '#6B6B6B', red: '#D93518' };

export default function LeaderboardScreen() {
  const navigation = useNavigation<Nav>();
  const { entries, loading, tab, timeFrame, unit, setTab, setTimeFrame } = useLeaderboard();

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </Pressable>
        <Text style={s.title}>Leaderboard</Text>
        <View style={{ width: 32 }} />
      </View>

      <LeaderboardFilters
        tab={tab}
        timeFrame={timeFrame}
        onTabChange={setTab}
        onTimeFrameChange={setTimeFrame}
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.red} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={e => String(e.rank)}
          renderItem={({ item }) => <EntryRow entry={item} unit={unit} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No data yet</Text>
              <Text style={s.emptyText}>Complete runs to appear on the leaderboard.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  backBtn: { width: 32 },
  backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: { alignItems: 'center' as const, paddingVertical: 48 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  emptyText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center' },
});
