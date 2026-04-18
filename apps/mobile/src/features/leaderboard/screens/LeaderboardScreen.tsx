import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { EntryRow } from '../components/EntryRow';
import { LeaderboardFilters } from '../components/LeaderboardFilters';
import type { LeaderboardEntry } from '../types';
import { avatarColor } from '@shared/lib/avatarUtils';
import { Award, Medal, ArrowLeft } from 'lucide-react-native';
import { useTheme, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Podium: [2nd, 1st, 3rd] order, heights: [50, 70, 36]
function Podium({ entries, unit, currentUserId }: { entries: LeaderboardEntry[]; unit: string; currentUserId?: string }) {
  const C = useTheme();
  const ps = useMemo(() => mkPsStyles(C), [C]);
  if (entries.length < 3) return null;
  const order = [entries[1], entries[0], entries[2]];
  const ranks = [2, 1, 3];
  const heights = [50, 70, 36];
  const avatarSizes = [36, 44, 30];
  const medalColors = [C.silver, C.gold, C.bronze];
  const fmtVal = (v: number) => unit === 'km' ? `${v.toFixed(1)} km` : unit === 'XP' ? `${v.toLocaleString()} XP` : `${Math.floor(v)} zones`;

  return (
    <View style={ps.wrap}>
      {order.map((entry, i) => (
        <View key={entry.rank} style={[ps.slot, i === 1 && ps.slotCenter]}>
          {i === 1
            ? <Award size={16} color={C.gold} strokeWidth={1.5} style={{ marginBottom: 4 }} />
            : <Medal size={14} color={medalColors[i]} strokeWidth={1.5} style={{ marginBottom: 4 }} />
          }
          <View style={[ps.avatar, { width: avatarSizes[i], height: avatarSizes[i], borderRadius: avatarSizes[i] / 2, backgroundColor: avatarColor(entry.name), borderColor: medalColors[i] }]}>
            <Text style={[ps.avatarText, { fontSize: avatarSizes[i] * 0.45 }]}>{entry.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={[ps.name, i === 1 && ps.nameFirst]} numberOfLines={1}>{entry.name}</Text>
          {entry.isPlayer && (
            <View style={ps.youBadge}><Text style={ps.youText}>YOU</Text></View>
          )}
          <Text style={ps.val}>{fmtVal(entry.value)}</Text>
          <View style={[ps.block, { height: heights[i], backgroundColor: i === 1 ? C.black : '#DDD9D4' }]}>
            <Text style={[ps.rankNum, { color: i === 1 ? C.white : C.t2 }]}>#{ranks[i]}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function mkPsStyles(C: AppColors) {
  return StyleSheet.create({
    wrap:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 4 },
    slot:       { flex: 1, alignItems: 'center', gap: 3 },
    slotCenter: { flex: 1.2 },
    avatar:     { borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
    avatarText: { fontFamily: 'Barlow_600SemiBold', color: C.white },
    name:       { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.black, textAlign: 'center' },
    nameFirst:  { fontFamily: 'Barlow_600SemiBold', fontSize: 11 },
    val:        { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3, textAlign: 'center' },
    youBadge:   { backgroundColor: 'rgba(217,53,24,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2 },
    youText:    { fontFamily: 'Barlow_600SemiBold', fontSize: 8, color: C.red, letterSpacing: 0.5 },
    block:      { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4, alignItems: 'center', justifyContent: 'center' },
    rankNum:    { fontFamily: 'Barlow_600SemiBold', fontSize: 11 },
  });
}

export default function LeaderboardScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { entries, loading, tab, timeFrame, scope, unit, currentUserId, setTab, setTimeFrame, setScope } = useLeaderboard();

  // Current player's entry (for sticky footer if rank > 3)
  const playerEntry = entries.find(e => e.isPlayer);
  const playerOutsideTop3 = playerEntry && playerEntry.rank > 3;
  const fmtVal = (v: number) => unit === 'km' ? `${v.toFixed(1)} km` : unit === 'XP' ? `${v.toLocaleString()} XP` : `${Math.floor(v)} zones`;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <ArrowLeft size={18} color={C.t2} strokeWidth={2} />
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
          renderItem={({ item }) => (
            <EntryRow
              entry={item}
              unit={unit}
              onPress={!item.isPlayer ? () => navigation.navigate('UserProfile', { userId: item.userId, username: item.name }) : undefined}
            />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<Podium entries={entries} unit={unit} currentUserId={currentUserId} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No data yet</Text>
              <Text style={s.emptyText}>Complete runs to appear on the leaderboard.</Text>
            </View>
          }
        />
      )}

      {/* Sticky current-player card — shown when player is ranked outside top 3 */}
      {!loading && playerOutsideTop3 && playerEntry && (
        <View style={s.playerFooter}>
          <Text style={s.playerRank}>{playerEntry.rank}</Text>
          <View style={s.playerAvatar}>
            <Text style={s.playerAvatarText}>{playerEntry.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.playerName}>{playerEntry.name}</Text>
            <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 2, backgroundColor: C.redLo, borderWidth: 0.5, borderColor: 'rgba(217,53,24,0.2)' }}>
              <Text style={{ fontFamily: 'Barlow_500Medium', fontSize: 8, color: C.red, textTransform: 'uppercase' }}>You</Text>
            </View>
          </View>
          <Text style={s.playerValue}>{fmtVal(playerEntry.value)}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
    backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
    list:          { paddingBottom: 100 },
    empty:         { alignItems: 'center' as const, paddingVertical: 48, paddingHorizontal: 16 },
    emptyTitle:    { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
    emptyText:     { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center' },
    playerFooter:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, marginTop: 1, marginBottom: 0, padding: '10px 12px' as any, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.redLo, borderRadius: 8, borderWidth: 0.5, borderColor: 'rgba(217,53,24,0.25)' },
    playerRank:    { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.red, width: 24, textAlign: 'center' },
    playerAvatar:  { width: 28, height: 28, borderRadius: 14, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' },
    playerAvatarText: { fontFamily: 'Barlow_500Medium', fontSize: 10, color: C.white },
    playerName:    { fontFamily: 'Barlow_500Medium', fontSize: 12, color: C.black },
    playerLvl:     { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3 },
    playerValue:   { fontFamily: 'Barlow_300Light', fontSize: 14, color: C.black, letterSpacing: -0.3 },
  });
}
