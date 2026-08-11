import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { supabase } from '@shared/services/supabase';
import { fetchPublicProfiles } from '@mobile/shared/services/publicProfiles';
import { toggleFollowService } from '@features/social/services/feedService';
import { avatarColor as getAvatarColor } from '@shared/lib/avatarUtils';
import { RANK_COLORS } from '@shared/constants/territory';
import { ArrowLeft } from 'phosphor-react-native';
import { Avatar } from '@mobile/shared/components/Avatar';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = NativeStackScreenProps<RootStackParamList, 'Followers'>['route'];

interface FollowerEntry {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  runnerRank: string;
  isFollowing: boolean;
}

async function loadFollowers(targetUserId: string, currentUserId: string): Promise<FollowerEntry[]> {
  const { data } = await supabase
    .from('followers')
    .select('follower_id')
    .eq('following_id', targetUserId);
  if (!data) return [];

  const followingResp = await supabase
    .from('followers')
    .select('following_id')
    .eq('follower_id', currentUserId);
  const followingSet = new Set((followingResp.data ?? []).map((r: { following_id: string }) => r.following_id));

  const profiles = await fetchPublicProfiles(data.map((r: any) => r.follower_id as string));

  return data.map((row: any) => {
    const id = row.follower_id as string;
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

export default function FollowersScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId } = route.params;

  const [entries, setEntries] = useState<FollowerEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
      const list = await loadFollowers(userId, user?.id ?? '');
      setEntries(list);
      setLoading(false);
    })();
  }, [userId]);

  const filtered = useMemo(() => {
    if (!query) return entries;
    const q = query.toLowerCase();
    return entries.filter(e =>
      e.username.toLowerCase().includes(q) ||
      (e.displayName ?? '').toLowerCase().includes(q),
    );
  }, [entries, query]);

  const toggle = useCallback(async (entry: FollowerEntry) => {
    if (!currentUserId || entry.userId === currentUserId) return;
    const optimistic = entries.map(e => e.userId === entry.userId ? { ...e, isFollowing: !e.isFollowing } : e);
    setEntries(optimistic);
    try {
      await toggleFollowService(entry.userId);
    } catch {
      setEntries(entries); // revert on failure
    }
  }, [currentUserId, entries]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <ArrowLeft size={18} color={C.t2} weight="regular" />
        </Pressable>
        <Text style={s.title}>Followers</Text>
        <View style={{ width: 32 }} />
      </View>

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
                {!isSelf && (
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
              <Text style={s.emptyText}>{query ? 'No matches' : 'No followers yet'}</Text>
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
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
    backBtn:      { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    title:        { fontFamily: Fonts.semiBold, fontSize: 20, color: C.black },
    searchWrap:   { paddingHorizontal: Spacing.gutter, paddingBottom: 8 },
    search:       { backgroundColor: C.stone, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontFamily: Fonts.regular, fontSize: 13, color: C.black, borderWidth: 0.5, borderColor: C.border },
    center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list:         { paddingHorizontal: Spacing.gutter, paddingBottom: 100 },
    row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
    name:         { fontFamily: Fonts.medium, fontSize: 14, color: C.black },
    handle:       { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
    rankBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    rankText:     { fontFamily: Fonts.medium, fontSize: 10, letterSpacing: 0.3 },
    followBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 0.5, borderColor: C.black },
    followBtnActive: { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
    followBtnText: { fontFamily: Fonts.medium, fontSize: 12, color: C.black },
    followBtnTextActive: { color: C.alwaysLight },
    empty:        { alignItems: 'center', paddingVertical: 40 },
    emptyText:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
  });
}
