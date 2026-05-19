import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { supabase } from '@shared/services/supabase';
import { avatarColor as getAvatarColor } from '@shared/lib/avatarUtils';
import { RANK_COLORS } from '@shared/constants/territory';
import { ArrowLeft } from 'phosphor-react-native';
import { useTheme, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = NativeStackScreenProps<RootStackParamList, 'Following'>['route'];

interface FollowingEntry {
  userId: string;
  username: string;
  displayName: string | null;
  runnerRank: string;
}

async function loadFollowing(targetUserId: string): Promise<FollowingEntry[]> {
  const { data } = await supabase
    .from('follows')
    .select('following_id, profiles!follows_following_id_fkey(id, username, display_name, runner_rank)')
    .eq('follower_id', targetUserId);
  if (!data) return [];
  return data.map((row: any) => {
    const p = row.profiles;
    return {
      userId:      p.id,
      username:    p.username ?? '',
      displayName: p.display_name ?? null,
      runnerRank:  p.runner_rank ?? 'pacer',
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
      const list = await loadFollowing(userId);
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

  const unfollow = useCallback(async (entry: FollowingEntry) => {
    if (!currentUserId) return;
    setEntries(prev => prev.filter(e => e.userId !== entry.userId));
    await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', entry.userId);
  }, [currentUserId]);

  const isOwn = currentUserId === userId;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <ArrowLeft size={18} color={C.t2} weight="regular" />
        </Pressable>
        <Text style={s.title}>Following</Text>
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
            const ac = getAvatarColor(item.username);
            return (
              <View style={s.row}>
                <View style={[s.avatar, { backgroundColor: ac }]}>
                  <Text style={s.avatarText}>{(item.displayName ?? item.username).charAt(0).toUpperCase()}</Text>
                </View>
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
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
    backBtn:      { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    title:        { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
    searchWrap:   { paddingHorizontal: 16, paddingBottom: 8 },
    search:       { backgroundColor: C.stone, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: C.black, borderWidth: 0.5, borderColor: C.border },
    center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list:         { paddingHorizontal: 16, paddingBottom: 100 },
    row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
    avatar:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    avatarText:   { fontWeight: '600', fontSize: 16, color: '#fff' },
    name:         { fontWeight: '500', fontSize: 14, color: C.black },
    handle:       { fontSize: 11, color: C.t3 },
    rankBadge:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    rankText:     { fontWeight: '500', fontSize: 9, letterSpacing: 0.3 },
    unfollowBtn:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 0.5, borderColor: C.border },
    unfollowText: { fontSize: 12, color: C.t2 },
    empty:        { alignItems: 'center', paddingVertical: 40 },
    emptyText:    { fontSize: 13, color: C.t2 },
  });
}
