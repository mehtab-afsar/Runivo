import { ErrorState } from '@mobile/shared/components/ErrorState';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { supabase } from '@shared/services/supabase';
import { fetchPublicProfiles } from '@mobile/shared/services/publicProfiles';
import { setFollow, removeFollower } from '@features/social/services/feedService';
import { fetchMyBlockedIds } from '@mobile/shared/services/safetyService';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { avatarColor as getAvatarColor } from '@shared/lib/avatarUtils';
import { RANK_COLORS } from '@shared/constants/territory';
import { Avatar } from '@mobile/shared/components/Avatar';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { ScreenHeader } from '@mobile/shared/components/ScreenHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = NativeStackScreenProps<RootStackParamList, 'Followers' | 'Following'>['route'];
export type FollowListMode = 'followers' | 'following';

interface FollowEntry {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  runnerRank: string;
  isFollowing: boolean;
}

/** The people who follow `targetUserId` (followers) or whom they follow (following), with whether you follow each. */
async function loadList(mode: FollowListMode, targetUserId: string, currentUserId: string): Promise<FollowEntry[]> {
  // followers: rows where they are followed, the other side is follower_id; following: the reverse.
  const col = mode === 'followers' ? 'follower_id' : 'following_id';
  const { data } = await supabase
    .from('followers')
    .select(col)
    .eq(mode === 'followers' ? 'following_id' : 'follower_id', targetUserId);
  if (!data) return [];

  const followingResp = await supabase
    .from('followers')
    .select('following_id')
    .eq('follower_id', currentUserId);
  const followingSet = new Set((followingResp.data ?? []).map((r: { following_id: string }) => r.following_id));

  const profiles = await fetchPublicProfiles(data.map((r: any) => r[col] as string));

  return data.map((row: any) => {
    const id = row[col] as string;
    const p = profiles.get(id);
    return {
      userId:      id,
      username:    p?.username ?? '',
      displayName: p?.display_name ?? null,
      avatarUrl:   p?.avatar_url ?? null,
      runnerRank:  p?.runner_rank ?? 'pacer',
      isFollowing: followingSet.has(id),
    };
  });
}

/**
 * Followers and Following: one list. Each row has a Follow / Following toggle,
 * so unfollowing from your own Following list can be undone with a tap.
 */
export function FollowListScreen({ mode }: { mode: FollowListMode }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId } = route.params;

  const [entries, setEntries] = useState<FollowEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const inFlightRef = useRef(new Set<string>());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!cancelled) setCurrentUserId(user?.id ?? null);
        const [list, blocked] = await Promise.all([
          loadList(mode, userId, user?.id ?? ''),
          fetchMyBlockedIds().catch(() => new Set<string>()),
        ]);
        // Runners you blocked stay out of every list, other people's too.
        if (!cancelled) setEntries(list.filter(e => !blocked.has(e.userId)));
      } catch {
        // A rejection used to leave the spinner up forever.
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, userId, reloadKey]);

  const filtered = useMemo(() => {
    if (!query) return entries;
    const q = query.toLowerCase();
    return entries.filter(e =>
      e.username.toLowerCase().includes(q) ||
      (e.displayName ?? '').toLowerCase().includes(q),
    );
  }, [entries, query]);

  const toggle = useCallback(async (entry: FollowEntry) => {
    if (!currentUserId || entry.userId === currentUserId) return;
    // Ignore a second tap while the first is in flight (two toggles = back where it started).
    if (inFlightRef.current.has(entry.userId)) return;
    inFlightRef.current.add(entry.userId);
    const flip = (id: string) => setEntries(prev => prev.map(e => e.userId === id ? { ...e, isFollowing: !e.isFollowing } : e));
    flip(entry.userId);
    try {
      const state = await setFollow(entry.userId, !entry.isFollowing);
      // A runner who isn't public gets a request: the row stays "Follow" until they accept.
      if (state === 'requested') { flip(entry.userId); appAlert('Request sent', `${entry.username} will see your request.`); }
    } catch {
      flip(entry.userId); // revert just this row, not a stale copy of the whole list
    } finally {
      inFlightRef.current.delete(entry.userId);
    }
  }, [currentUserId]);

  // Your own Followers list: take someone off it (they are not told).
  const ownFollowers = mode === 'followers' && !!currentUserId && userId === currentUserId;
  const confirmRemove = useCallback((entry: FollowEntry) => {
    appAlert(`Remove ${entry.username}?`, "They stop seeing your followers-only activities. They aren't told.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await removeFollower(entry.userId); setEntries(prev => prev.filter(e => e.userId !== entry.userId)); }
        catch { appAlert("Couldn't remove them", 'Check your connection and try again.'); }
      } },
    ]);
  }, []);

  return (
    <SafeAreaView style={s.root}>
      <ScreenHeader title={mode === 'followers' ? 'Followers' : 'Following'} onBack={() => navigation.goBack()} />

      <View style={s.searchWrap}>
        <TextInput
          style={s.search}
          placeholder="Search"
          placeholderTextColor={C.t3}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.red} /></View>
      ) : loadError ? (
        <ErrorState title="Couldn't load this list" onRetry={() => setReloadKey(k => k + 1)} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={e => e.userId}
          contentContainerStyle={s.list}
          renderItem={({ item }) => {
            const rankColor = RANK_COLORS[item.runnerRank] ?? RANK_COLORS.pacer;
            const isSelf = item.userId === currentUserId;
            const ac = getAvatarColor(item.username);
            return (
              <View style={s.row}>
                <Avatar name={item.displayName ?? item.username} color={ac} size={40} uri={item.avatarUrl} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.displayName ?? item.username}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Text style={s.handle}>@{item.username}</Text>
                    <View style={[s.rankBadge, { backgroundColor: rankColor.bg }]}>
                      <Text style={[s.rankText, { color: rankColor.fg }]}>
                        {item.runnerRank.charAt(0).toUpperCase() + item.runnerRank.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
                {ownFollowers && !isSelf && (
                  <Pressable style={s.followBtn} onPress={() => confirmRemove(item)} accessibilityRole="button" accessibilityLabel={`Remove ${item.username} from your followers`}>
                    <Text style={s.followBtnText}>Remove</Text>
                  </Pressable>
                )}
                {!isSelf && !ownFollowers && (
                  <Pressable
                    style={[s.followBtn, item.isFollowing && s.followBtnActive]}
                    onPress={() => toggle(item)}
                  >
                    <Text style={[s.followBtnText, item.isFollowing && s.followBtnTextActive]}>
                      {item.isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>{query ? 'No matches' : mode === 'followers' ? 'No followers yet' : 'Not following anyone yet'}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:         { flex: 1, backgroundColor: C.bg },
    searchWrap:   { paddingHorizontal: Spacing.gutter, paddingBottom: 8 },
    search:       { backgroundColor: C.stone, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontFamily: Fonts.regular, fontSize: 13, color: C.black, borderWidth: 0.5, borderColor: C.border },
    center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list:         { paddingHorizontal: Spacing.gutter, paddingBottom: 100 },
    row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
    name:         { fontFamily: Fonts.medium, fontSize: 14, color: C.black },
    handle:       { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
    rankBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    rankText:     { fontFamily: Fonts.medium, fontSize: 11, letterSpacing: 0.3 },
    followBtn:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.t1 },
    followBtnActive: { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
    followBtnText: { fontFamily: Fonts.medium, fontSize: 12, color: C.black },
    followBtnTextActive: { color: C.alwaysLight },
    empty:        { alignItems: 'center', paddingVertical: 40 },
    emptyText:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
  });
}
