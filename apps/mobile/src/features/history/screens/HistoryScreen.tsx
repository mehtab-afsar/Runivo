import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, RefreshControl, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import type { StoredRun } from '@shared/services/store';
import { useRunHistory } from '../hooks/useRunHistory';
import { RunItem } from '../components/RunItem';
import { HistoryStats } from '../components/HistoryStats';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { ScreenHeader } from '@mobile/shared/components/ScreenHeader';
import { EmptyState } from '@mobile/shared/components/EmptyState';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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

// Module-level so the identity is stable across renders. Previously this was an
// inline `() => <View/>`, i.e. a new component TYPE every render, which forces
// React to unmount and remount every separator in the list.
const ItemSeparator = () => <View style={{ height: 8 }} />;
const keyExtractor = (r: StoredRun) => r.id;

export default function HistoryScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { runs, refreshing, refresh } = useRunHistory();
  const [filter, setFilter] = useState<FilterValue>('all');

  const filtered = useMemo(() =>
    filter === 'all' ? runs : runs.filter(r => r.activityType === filter),
  [runs, filter]);

  const filteredTotalKm = useMemo(() => filtered.reduce((acc, r) => acc + r.distanceMeters / 1000, 0), [filtered]);
  const filteredAvgKm   = useMemo(() => filteredTotalKm / Math.max(filtered.length, 1), [filteredTotalKm, filtered.length]);

  // Stable identities so the memoised RunItem rows can actually bail out.
  const openRun = useCallback(
    (run: StoredRun) => navigation.navigate('RunSummary', { runId: run.id }),
    [navigation],
  );
  const renderItem = useCallback(
    ({ item }: { item: StoredRun }) => <RunItem run={item} onPress={openRun} />,
    [openRun],
  );

  return (
    <SafeAreaView style={s.root}>
      <ScreenHeader title="Run History" onBack={() => navigation.goBack()} />

      {runs.length > 0 && (
        <HistoryStats runCount={filtered.length} totalKm={filteredTotalKm} avgKm={filteredAvgKm} />
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
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparator}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        // History can hold hundreds of runs; without these the whole list mounts up front.
        initialNumToRender={10}
        windowSize={7}
        removeClippedSubviews
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
        ListEmptyComponent={
          <EmptyState
            title={filter === 'all' ? 'No runs yet' : `No ${filter} activities`}
            body={filter === 'all'
              ? 'Head out for your first run and your history will appear here.'
              : 'Try a different filter or log a new activity.'}
            cta={filter === 'all'
              ? { label: 'Start a run', onPress: () => navigation.navigate('Main', { screen: 'Run' }) }
              : undefined}
          />
        }
      />
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:         { flex: 1, backgroundColor: C.bg },
    filterScroll: { borderBottomWidth: 0.5, borderBottomColor: C.border, backgroundColor: C.card, flexGrow: 0 },
    filterContent:{ paddingHorizontal: Spacing.gutter, paddingVertical: 10, gap: 8, flexDirection: 'row' },
    chip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.stone, borderWidth: 0.5, borderColor: C.border },
    chipActive:   { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
    chipText:     { fontFamily: Fonts.regular, fontSize: 11, color: C.t2 },
    chipTextActive:{ color: C.alwaysLight, fontFamily: Fonts.medium },
    list:         { paddingHorizontal: Spacing.gutter, paddingBottom: 100, gap: 8, paddingTop: 8 },
  });
}
