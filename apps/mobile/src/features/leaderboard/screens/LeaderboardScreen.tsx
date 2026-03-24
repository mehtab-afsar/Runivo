import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { EntryRow } from '../components/EntryRow';
import { LeaderboardFilters } from '../components/LeaderboardFilters';
import type { LeaderboardEntry } from '../types';
import { avatarColor } from '@shared/lib/avatarUtils';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const C = { bg: '#EDEAE5', black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD', red: '#D93518', white: '#FFFFFF', border: '#DDD9D4', gold: '#D4A200', silver: '#9E9E9E', bronze: '#A0522D' };

// Podium: [2nd, 1st, 3rd] order, heights: [50, 70, 36]
function Podium({ entries, unit }: { entries: LeaderboardEntry[]; unit: string }) {
  if (entries.length < 3) return null;
  const order = [entries[1], entries[0], entries[2]];
  const ranks = [2, 1, 3];
  const heights = [50, 70, 36];
  const avatarSizes = [36, 44, 30];
  const medals = ['🥈', '🥇', '🥉'];
  const medalColors = [C.silver, C.gold, C.bronze];
  const fmtVal = (v: number) => unit === 'km' ? `${v.toFixed(1)} km` : unit === 'XP' ? `${v.toLocaleString()} XP` : `${Math.floor(v)} ⚡`;

  return (
    <View style={ps.wrap}>
      {order.map((entry, i) => (
        <View key={entry.rank} style={[ps.slot, i === 1 && ps.slotCenter]}>
          <Text style={{ fontSize: avatarSizes[i] * 0.5, marginBottom: 4 }}>{medals[i]}</Text>
          <View style={[ps.avatar, { width: avatarSizes[i], height: avatarSizes[i], borderRadius: avatarSizes[i] / 2, backgroundColor: avatarColor(entry.name), borderColor: medalColors[i] }]}>
            <Text style={[ps.avatarText, { fontSize: avatarSizes[i] * 0.45 }]}>{entry.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={[ps.name, i === 1 && ps.nameFirst]} numberOfLines={1}>{entry.name}</Text>
          <Text style={ps.val}>{fmtVal(entry.value)}</Text>
          <View style={[ps.block, { height: heights[i], backgroundColor: i === 1 ? C.black : '#DDD9D4' }]}>
            <Text style={[ps.rankNum, { color: i === 1 ? C.white : C.t2 }]}>#{ranks[i]}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const ps = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 4 },
  slot:       { flex: 1, alignItems: 'center', gap: 3 },
  slotCenter: { flex: 1.2 },
  avatar:     { borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  avatarText: { fontFamily: 'Barlow_600SemiBold', color: C.white },
  name:       { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.black, textAlign: 'center' },
  nameFirst:  { fontFamily: 'Barlow_600SemiBold', fontSize: 11 },
  val:        { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3, textAlign: 'center' },
  block:      { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4, alignItems: 'center', justifyContent: 'center' },
  rankNum:    { fontFamily: 'Barlow_600SemiBold', fontSize: 11 },
});

export default function LeaderboardScreen() {
  const navigation = useNavigation<Nav>();
  const { entries, loading, tab, timeFrame, scope, unit, setTab, setTimeFrame, setScope } = useLeaderboard();

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
        scope={scope}
        onTabChange={setTab}
        onTimeFrameChange={setTimeFrame}
        onScopeChange={setScope}
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.red} />
        </View>
      ) : (
        <FlatList
          data={entries.slice(3)}
          keyExtractor={e => String(e.rank)}
          renderItem={({ item }) => <EntryRow entry={item} unit={unit} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<Podium entries={entries} unit={unit} />}
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
