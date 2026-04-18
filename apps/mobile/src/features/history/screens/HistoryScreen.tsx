import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, RefreshControl, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useRunHistory } from '../hooks/useRunHistory';
import { RunItem } from '../components/RunItem';
import { HistoryStats } from '../components/HistoryStats';
import { Colors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const C = Colors;

const FILTERS = [
  { value: 'all',        label: 'All' },
  { value: 'run',        label: 'Run' },
  { value: 'walk',       label: 'Walk' },
  { value: 'hike',       label: 'Hike' },
  { value: 'trail_run',  label: 'Trail' },
  { value: 'cycle',      label: 'Cycle' },
  { value: 'interval',   label: 'Interval' },
  { value: 'tempo',      label: 'Tempo' },
  { value: 'race',       label: 'Race' },
] as const;

type FilterValue = typeof FILTERS[number]['value'];

export default function HistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { runs, refreshing, totalKm, avgKm, refresh } = useRunHistory();
  const [filter, setFilter] = useState<FilterValue>('all');

  const filtered = useMemo(() =>
    filter === 'all' ? runs : runs.filter(r => r.activityType === filter),
  [runs, filter]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </Pressable>
        <Text style={s.title}>Run History</Text>
        <View style={{ width: 32 }} />
      </View>

      {runs.length > 0 && (
        <HistoryStats runCount={filtered.length} totalKm={filtered.reduce((s, r) => s + r.distanceMeters / 1000, 0)} avgKm={avgKm} />
      )}

      {/* Activity type filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterContent}>
        {FILTERS.map(f => (
          <Pressable key={f.value} style={[s.chip, filter === f.value && s.chipActive]} onPress={() => setFilter(f.value)}>
            <Text style={[s.chipText, filter === f.value && s.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <RunItem run={item} onPress={() => navigation.navigate('RunSummary', { runId: item.id })} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>{filter === 'all' ? 'No runs yet' : `No ${filter} activities`}</Text>
            <Text style={s.emptyText}>{filter === 'all' ? 'Your run history will appear here.' : 'Try a different filter.'}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  backBtn:      { width: 32 },
  backText:     { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title:        { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  filterScroll: { borderBottomWidth: 0.5, borderBottomColor: C.border, backgroundColor: C.white, flexGrow: 0 },
  filterContent:{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  chip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.stone, borderWidth: 0.5, borderColor: C.border },
  chipActive:   { backgroundColor: C.black, borderColor: C.black },
  chipText:     { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t2 },
  chipTextActive:{ color: C.white, fontFamily: 'Barlow_500Medium' },
  list:         { paddingHorizontal: 16, paddingBottom: 100, gap: 8, paddingTop: 8 },
  empty:        { alignItems: 'center' as const, paddingVertical: 48 },
  emptyTitle:   { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  emptyText:    { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2 },
});
