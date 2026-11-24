import { ErrorState } from '@mobile/shared/components/ErrorState';
import React, { useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { EntryRow, splitValue } from '../components/EntryRow';
import { LeaderboardFilters } from '../components/LeaderboardFilters';
import type { LeaderboardEntry } from '../types';
import { useTheme, Fonts, type AppColors } from '@theme';
import { Avatar } from '@mobile/shared/components/Avatar';
import { ScreenHeader } from '@mobile/shared/components/ScreenHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Module-level for a stable identity across renders.
const keyExtractor = (e: LeaderboardEntry) => String(e.rank);

// Podium: No.2 · No.1 (black, taller) · No.3 as cards, like the mock.
function Podium({ entries, unit }: { entries: LeaderboardEntry[]; unit: string }) {
  const C = useTheme();
  const ps = useMemo(() => mkPsStyles(C), [C]);
  if (entries.length < 3) return null;
  const order = [entries[1], entries[0], entries[2]];

  return (
    <View style={ps.wrap}>
      {order.map((entry, i) => {
        const v = splitValue(entry.value, unit);
        const first = i === 1;
        const size = first ? 50 : 40;
        // Heights as in the mock: No.1 166, No.2 140, No.3 126 — content sits at the bottom.
        const h = first ? 166 : i === 0 ? 140 : 126;
        return (
          <View key={entry.rank} style={[ps.card, { height: h }, first ? ps.cardFirst : ps.cardSide]}>
            <View style={[ps.ring, first && { borderColor: C.red }, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]}>
              <View style={[ps.avatar, { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }]}>
                <Avatar name={entry.name} uri={entry.avatarUrl ?? null} size={size} />
              </View>
            </View>
            <Text style={[ps.name, first && ps.nameFirst]} numberOfLines={1}>{entry.isPlayer ? 'You' : entry.name}</Text>
            <Text style={[ps.val, first && ps.valFirst]} numberOfLines={1} adjustsFontSizeToFit>
              {v.num}{unit !== 'TS' ? <Text style={[ps.valUnit, first && ps.valUnitFirst]}> {v.suffix}</Text> : null}
            </Text>
            <Text style={[ps.rankLabel, first && ps.rankLabelFirst]}>No. {entry.rank}</Text>
          </View>
        );
      })}
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
    wrap:          { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 18, paddingBottom: 12, gap: 8 },
    card:          { flex: 1, alignItems: 'center', justifyContent: 'flex-end', borderRadius: 24, padding: 12, gap: 6 },
    cardSide:      { backgroundColor: C.card },
    cardFirst:     { backgroundColor: C.alwaysDark, flex: 1.15 },
    ring:          { borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    avatar:        { alignItems: 'center', justifyContent: 'center' },
    avatarText:    { fontFamily: Fonts.semiBold, color: C.alwaysLight },
    name:          { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t1 },
    nameFirst:     { color: C.alwaysLight },
    val:           { fontFamily: Fonts.numeric, fontSize: 22, lineHeight: 22, color: C.t1, fontVariant: ['tabular-nums'] },
    valFirst:      { fontSize: 28, lineHeight: 28, color: C.alwaysLight },
    valUnit:       { fontFamily: Fonts.medium, fontSize: 11, color: C.t2 },
    valUnitFirst:  { color: 'rgba(255,255,255,0.6)' },
    rankLabel:     { fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    rankLabelFirst:{ color: C.lime },
  });
}

export default function LeaderboardScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { entries, loading, error, reload, tab, timeFrame, scope, unit, setTab, setTimeFrame, setScope } = useLeaderboard();

  // Current player's entry (for sticky footer if rank > 3)
  const playerEntry = entries.find(e => e.isPlayer);
  const playerOutsideTop3 = playerEntry && playerEntry.rank > 3;
  const playerVal = playerEntry ? splitValue(playerEntry.value, unit) : null;
  // "380 behind No. 13" — only when the runner above is on the loaded page.
  const above = playerEntry ? entries.find(e => e.rank === playerEntry.rank - 1) : undefined;
  const gapLine = playerEntry && above
    ? `${splitValue(Math.max(0, above.value - playerEntry.value), unit).num}${unit === 'TS' ? '' : ` ${splitValue(0, unit).suffix}`} behind No. ${above.rank}`
    : '';

  // Stable identities so the memoised EntryRow can bail out. The podium was
  // previously constructed inline as a JSX element on every render, remounting
  // the whole list header each time.
  const openProfile = useCallback(
    (entry: LeaderboardEntry) =>
      navigation.navigate('UserProfile', { userId: entry.userId, username: entry.name }),
    [navigation],
  );
  const listData = entries.length < 3 ? entries : entries.slice(3);
  const lastIndex = listData.length - 1;
  const renderItem = useCallback(
    ({ item, index }: { item: LeaderboardEntry; index: number }) => (
      <EntryRow
        entry={item}
        unit={unit}
        onPress={item.isPlayer ? undefined : openProfile}
        position={lastIndex === 0 ? 'only' : index === 0 ? 'first' : index === lastIndex ? 'last' : 'middle'}
      />
    ),
    [unit, openProfile, lastIndex],
  );
  const podium = useMemo(
    () => <Podium entries={entries} unit={unit} />,
    [entries, unit],
  );

  return (
    <SafeAreaView style={s.root}>
      <ScreenHeader variant="large" title="Leaderboard" onBack={() => navigation.goBack()} right={
        <LeaderboardFilters
          part="pill"
          tab={tab} timeFrame={timeFrame} scope={scope}
          onTabChange={setTab} onTimeFrameChange={setTimeFrame} onScopeChange={setScope}
        />
      } />
      <LeaderboardFilters
        part="segment"
        tab={tab} timeFrame={timeFrame} scope={scope}
        onTabChange={setTab} onTimeFrameChange={setTimeFrame} onScopeChange={setScope}
      />

      {loading ? (
        <SkeletonRows />
      ) : error ? (
        <ErrorState title="Couldn't load the leaderboard" onRetry={reload} />
      ) : (
        <FlatList
          // Podium only renders (and only makes sense) at 3+ entries — below that,
          // slice(3) on a 1-2 entry array is empty, so the podium's own null-return
          // combined with an empty list rendered "No data yet" even when there WAS
          // data. Show every entry in the list until there are enough for a podium.
          data={listData}
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
              <Text style={s.emptyTitle}>Nobody's claimed the board yet.</Text>
              <Text style={s.emptyText}>Finish a run and be the first name up here.</Text>
            </View>
          }
        />
      )}

      {/* Sticky "You" bar — shown when the runner is outside the top 3 */}
      {!loading && playerOutsideTop3 && playerEntry && (
        <View style={s.playerFooter}>
          <Text style={s.playerRank}>{playerEntry.rank}</Text>
          <View style={s.playerAvatar}>
            <Avatar name={playerEntry.name} uri={playerEntry.avatarUrl ?? null} size={34} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.playerName} numberOfLines={1}>You</Text>
            {!!gapLine && <Text style={s.playerLvl} numberOfLines={1}>{gapLine}</Text>}
          </View>
          <Text style={s.playerValue}>{playerVal?.num}{unit !== 'TS' ? <Text style={s.playerUnit}> {playerVal?.suffix}</Text> : null}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    list:          { paddingBottom: 120 },
    skeletonWrap:  { paddingTop: 8 },
    skeletonRow:   { height: 60, marginHorizontal: 12, marginBottom: 8, borderRadius: 18 },
    empty:         { alignItems: 'center' as const, paddingVertical: 48, paddingHorizontal: 16 },
    emptyTitle:    { fontFamily: Fonts.bold, fontSize: 20, lineHeight: 25, color: C.t1, marginBottom: 6, textAlign: 'center' },
    emptyText:     { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, textAlign: 'center' },
    playerFooter:  { position: 'absolute', left: 14, right: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: C.alwaysDark, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    playerRank:    { fontFamily: Fonts.numeric, fontSize: 24, color: C.alwaysLight, width: 30 },
    playerAvatar:  { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    playerAvatarText: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysLight },
    playerName:    { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysLight },
    playerLvl:     { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
    playerValue:   { fontFamily: Fonts.numeric, fontSize: 22, color: C.lime },
    playerUnit:    { fontFamily: Fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  });
}
