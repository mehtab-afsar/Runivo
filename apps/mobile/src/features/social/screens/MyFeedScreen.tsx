import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CaretLeft } from 'phosphor-react-native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { useAuth } from '@shared/hooks/useAuth';
import { fetchMyFeed, toggleLike, deletePost } from '../services/feedService';
import { FeedPostCard } from '../components/FeedPostCard';
import CommentSheet from '../components/CommentSheet';
import type { FeedPost } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Your own feed: every run, battle card and milestone you've posted. */
export default function MyFeedScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);

  const load = useCallback(async (fresh: boolean) => {
    try {
      const r = await fetchMyFeed(fresh ? null : cursor);
      setPosts(prev => (fresh ? r.posts : [...prev, ...r.posts.filter(p => !prev.some(q => q.id === p.id))]));
      setCursor(r.nextCursor);
      setError(false);
    } catch { setError(true); }
  }, [cursor]);

  useEffect(() => { load(true).finally(() => setLoading(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => { setRefreshing(true); await load(true); setRefreshing(false); }, [load]);

  const kudos = useCallback(async (id: string) => {
    setPosts(prev => prev.map(p => (p.id === id ? { ...p, hasKudos: !p.hasKudos, kudosCount: p.kudosCount + (p.hasKudos ? -1 : 1) } : p)));
    try {
      const r = await toggleLike(id);
      setPosts(prev => prev.map(p => (p.id === id ? { ...p, hasKudos: r.liked, kudosCount: r.count } : p)));
    } catch { /* Kudos failed: refresh to show the server state. */ refresh(); }
  }, [refresh]);

  const remove = useCallback((id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    deletePost(id).catch(() => refresh());
  }, [refresh]);

  const renderItem = useCallback(({ item }: { item: FeedPost }) => (
    <FeedPostCard
      post={item}
      currentUserId={user?.id ?? null}
      onKudos={() => kudos(item.id)}
      onComment={() => setCommentPostId(item.id)}
      onDelete={() => remove(item.id)}
    />
  ), [user?.id, kudos, remove]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back} accessibilityRole="button" accessibilityLabel="Back">
          <CaretLeft size={20} color={C.t1} weight="bold" />
        </Pressable>
        <Text style={s.title} accessibilityRole="header">Your feed</Text>
        <View style={s.back} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={C.t2} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
          onEndReachedThreshold={0.5}
          onEndReached={() => { if (cursor) load(false); }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>{error ? "Couldn't load your feed" : 'Nothing posted yet'}</Text>
              <Text style={s.emptyBody}>{error ? 'Pull down to try again.' : 'Every run you finish shows up here, with your battle cards and milestones.'}</Text>
            </View>
          }
        />
      )}
      <CommentSheet postId={commentPostId} onClose={() => setCommentPostId(null)} onCommentPosted={() => refresh()} />
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:       { flex: 1, backgroundColor: C.bg },
    header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.gutter, height: 52 },
    back:       { width: 44, height: 44, justifyContent: 'center' },
    title:      { flex: 1, textAlign: 'center', fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    empty:      { alignItems: 'center', paddingHorizontal: 32, paddingTop: 64, gap: 8 },
    emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    emptyBody:  { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.t2, textAlign: 'center' },
  });
}
