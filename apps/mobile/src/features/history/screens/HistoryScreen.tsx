import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useRunHistory } from '../hooks/useRunHistory';
import { RunItem } from '../components/RunItem';
import { HistoryStats } from '../components/HistoryStats';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const C = { bg: '#F8F6F3', black: '#0A0A0A', t2: '#6B6B6B', red: '#D93518' };

export default function HistoryScreen() {
  const navigation = useNavigation<Nav>();
  const { runs, refreshing, totalKm, avgKm, refresh } = useRunHistory();

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
        <HistoryStats runCount={runs.length} totalKm={totalKm} avgKm={avgKm} />
      )}

      <FlatList
        data={runs}
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
            <Text style={s.emptyTitle}>No runs yet</Text>
            <Text style={s.emptyText}>Your run history will appear here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  backBtn: { width: 32 },
  backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 8 },
  empty: { alignItems: 'center' as const, paddingVertical: 48 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  emptyText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2 },
});
