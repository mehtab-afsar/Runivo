import React, { useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { EntryRow } from '../components/EntryRow';
import { LeaderboardFilters } from '../components/LeaderboardFilters';
import type { LeaderboardEntry } from '../types';
import { avatarColor } from '@shared/lib/avatarUtils';
import { Seal, Medal, ArrowLeft } from 'phosphor-react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Module-level for a stable identity across renders.
const keyExtractor = (e: LeaderboardEntry) => String(e.rank);

// Podium: [2nd, 1st, 3rd] order, heights: [50, 70, 36]
function Podium({ entries, unit, currentUserId: _currentUserId }: { entries: LeaderboardEntry[]; unit: string; currentUserId?: string }) {
  const C = useTheme();
  const ps = useMemo(() => mkPsStyles(C), [C]);
  if (entries.length < 3) return null;
  const order = [entries[1], entries[0], entries[2]];
  const ranks = [2, 1, 3];
  const heights = [50, 70, 36];
  const avatarSizes = [36, 44, 30];
  const medalColors = [C.silver, C.gold, C.bronze];
  const fmtVal = (v: number) =>
    unit === 'km'     ? `${v.toFixed(1)} km`
    : unit === 'PACE' ? `${v} PACE`
    : `${Intl.NumberFormat().format(Math.round(v))} TS`;

  return (
    <View style={ps.wrap}>
      {order.map((entry, i) => (
        <View key={entry.rank} style={[ps.slot, i === 1 && ps.slotCenter]}>
          {i === 1
            ? <Seal size={16} color={C.gold} weight="light" style={{ marginBottom: 4 }} />
            : <Medal size={14} color={medalColors[i]} weight="light" style={{ marginBottom: 4 }} />
          }
          <View style={[ps.avatar, { width: avatarSizes[i], height: avatarSizes[i], borderRadius: avatarSizes[i] / 2, backgroundColor: avatarColor(entry.name), borderColor: medalColors[i] }]}>
            <Text style={[ps.avatarText, { fontSize: avatarSizes[i] * 0.45 }]}>{entry.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={[ps.name, i === 1 && ps.nameFirst]} numberOfLines={1}>{entry.name}</Text>
          {entry.isPlayer && (
            <View style={ps.youBadge}><Text style={ps.youText}>YOU</Text></View>
          )}
          <Text style={ps.val}>{fmtVal(entry.value)}</Text>
          {i === 1 ? (
            <LinearGradient
              colors={['#3A2F0A', C.alwaysDark]}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={[ps.block, { height: heights[i] }, ps.blockFirst]}
            >
              <Text style={[ps.rankNum, { color: C.alwaysLight }]}>#{ranks[i]}</Text>
            </LinearGradient>
          ) : (
            <View style={[ps.block, { height: heights[i], backgroundColor: C.stone }]}>
              <Text style={[ps.rankNum, { color: C.t2 }]}>#{ranks[i]}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

// Shimmering placeholder rows shown while the board loads — replaces the bare
// centered spinner, matching the row shape so the swap-in doesn't jump.
function SkeletonRows() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={s.skeletonWrap}>
      {Array.from({ length: 7 }).map((_, i) => (
        <Animated.View key={i} style={[s.skeletonRow, pulseStyle, { backgroundColor: C.surface }]} />
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
    avatarText: { fontFamily: Fonts.semiBold, color: C.white },
    name:       { fontFamily: Fonts.regular, fontSize: 10, color: C.black, textAlign: 'center' },
    nameFirst:  { fontFamily: Fonts.semiBold, fontSize: 11 },
    val:        { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, textAlign: 'center', fontVariant: ['tabular-nums'] },
    youBadge:   { backgroundColor: 'rgba(217,53,24,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 2 },
    youText:    { fontFamily: Fonts.semiBold, fontSize: 10, color: C.red, letterSpacing: 0.5 },
    block:      { width: '100%', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    blockFirst: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: -3 }, elevation: 3 },
    rankNum:    { fontFamily: Fonts.semiBold, fontSize: 11 },
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
  const fmtVal = (v: number) =>
    unit === 'km'     ? `${v.toFixed(1)} km`
    : unit === 'PACE' ? `${v} PACE`
    : `${Intl.NumberFormat().format(Math.round(v))} TS`;

  // Stable identities so the memoised EntryRow can bail out. The podium was
  // previously constructed inline as a JSX element on every render, remounting
  // the whole list header each time.
  const openProfile = useCallback(
    (entry: LeaderboardEntry) =>
      navigation.navigate('UserProfile', { userId: entry.userId, username: entry.name }),
    [navigation],
  );
  const renderItem = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <EntryRow entry={item} unit={unit} onPress={item.isPlayer ? undefined : openProfile} />
    ),
    [unit, openProfile],
  );
  const podium = useMemo(
    () => <Podium entries={entries} unit={unit} currentUserId={currentUserId} />,
    [entries, unit, currentUserId],
  );

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <ArrowLeft size={18} color={C.t2} weight="regular" />
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
        <SkeletonRows />
      ) : (
        <FlatList
          // Podium only renders (and only makes sense) at 3+ entries — below that,
          // slice(3) on a 1-2 entry array is empty, so the podium's own null-return
          // combined with an empty list rendered "No data yet" even when there WAS
          // data. Show every entry in the list until there are enough for a podium.
          data={entries.length < 3 ? entries : entries.slice(3)}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          // Page size is 100; without these the entire board mounts at once.
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={podium}
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
              <Text style={{ fontFamily: Fonts.medium, fontSize: 10, color: C.red, textTransform: 'uppercase' }}>You</Text>
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
    title: { fontFamily: Fonts.semiBold, fontSize: 24, color: C.black },
    list:          { paddingBottom: 100 },
    skeletonWrap:  { paddingTop: 8 },
    skeletonRow:   { height: 51, marginHorizontal: Spacing.gutter, marginBottom: 8, borderRadius: Spacing.radius.md },
    empty:         { alignItems: 'center' as const, paddingVertical: 48, paddingHorizontal: 16 },
    emptyTitle:    { fontFamily: Fonts.semiBold, fontSize: 18, color: C.black, marginBottom: 6 },
    emptyText:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, textAlign: 'center' },
    playerFooter:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, marginTop: 1, marginBottom: 0, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.redLo, borderRadius: 8, borderWidth: 0.5, borderColor: 'rgba(217,53,24,0.25)', shadowColor: C.red, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
    playerRank:    { fontFamily: Fonts.regular, fontSize: 13, color: C.red, width: 24, textAlign: 'center', fontVariant: ['tabular-nums'] },
    playerAvatar:  { width: 28, height: 28, borderRadius: 14, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center' },
    playerAvatarText: { fontFamily: Fonts.medium, fontSize: 10, color: C.alwaysLight },
    playerName:    { fontFamily: Fonts.medium, fontSize: 12, color: C.black },
    playerLvl:     { fontFamily: Fonts.regular, fontSize: 10, color: C.t3 },
    playerValue:   { fontFamily: Fonts.regular, fontSize: 14, color: C.black, letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  });
}
