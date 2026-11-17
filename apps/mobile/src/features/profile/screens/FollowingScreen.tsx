import { ErrorState } from '@mobile/shared/components/ErrorState';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { supabase } from '@shared/services/supabase';
import { fetchPublicProfiles } from '@mobile/shared/services/publicProfiles';
import { toggleFollowService } from '@features/social/services/feedService';
import { avatarColor as getAvatarColor } from '@shared/lib/avatarUtils';
import { RANK_COLORS } from '@shared/constants/territory';
import { Avatar } from '@mobile/shared/components/Avatar';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { ScreenHeader } from '@mobile/shared/components/ScreenHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = NativeStackScreenProps<RootStackParamList, 'Following'>['route'];

interface FollowingEntry {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  runnerRank: string;
}

async function loadFollowing(targetUserId: string): Promise<FollowingEntry[]> {
  const { data } = await supabase
    .from('followers')
    .select('following_id')
    .eq('follower_id', targetUserId);
  if (!data) return [];

  const profiles = await fetchPublicProfiles(data.map((r: any) => r.following_id as string));

  return data.map((row: any) => {
    const id = row.following_id as string;
    const p = profiles.get(id);
    return {
      userId:      id,
      username:    p?.username ?? '',
      displayName: p?.display_name ?? null,
      avatarUrl:   p?.avatar_url ?? null,
      runnerRank:  p?.runner_rank ?? 'pacer',
    };
  });
}

export default function FollowingScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId } = route.params;

  const [entries, setEntries] = useState<FollowingEntry[]>([]);
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
        const list = await loadFollowing(userId);
        if (!cancelled) setEntries(list);
      } catch {
        // A rejection used to leave the spinner up forever.
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, reloadKey]);

  const filtered = useMemo(() => {
    if (!query) return entries;
    const q = query.toLowerCase();
    return entries.filter(e =>
      e.username.toLowerCase().includes(q) ||
      (e.displayName ?? '').toLowerCase().includes(q),
    );
  }, [entries, query]);

  const unfollow = useCallback(async (entry: FollowingEntry) => {
    if (!currentUserId) return;
    if (inFlightRef.current.has(entry.userId)) return;
    inFlightRef.current.add(entry.userId);
    setEntries(prev => prev.filter(e => e.userId !== entry.userId));
    try {
      await toggleFollowService(entry.userId);
    } catch {
      setEntries(prev => (prev.some(e => e.userId === entry.userId) ? prev : [...prev, entry]));   // put the row back
    } finally {
      inFlightRef.current.delete(entry.userId);
    }
  }, [currentUserId]);

  const isOwn = currentUserId === userId;

  return (
    <SafeAreaView style={s.root}>
      <ScreenHeader title="Following" onBack={() => navigation.goBack()} />

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
                {isOwn && item.userId !== currentUserId && (
                  <Pressable style={s.unfollowBtn} onPress={() => unfollow(item)}>
                    <Text style={s.unfollowText}>Unfollow</Text>
                  </Pressable>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>{query ? 'No matches' : 'Not following anyone yet'}</Text>
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
    unfollowBtn:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 0.5, borderColor: C.border },
    unfollowText: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    empty:        { alignItems: 'center', paddingVertical: 40 },
    emptyText:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
  });
}
