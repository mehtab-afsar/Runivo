/**
 * Home → "Your feed": the latest 3 activities from runners you follow, as full
 * feed cards (stats, route, kudos), like the mock. Comments open the Feed.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Fonts, haptic, type AppColors } from '@theme';
import { FeedPostCard } from '@features/social/components/FeedPostCard';
import { supabase } from '@shared/services/supabase';
import { fetchFeed, toggleLike } from '@features/social/services/feedService';
import type { FeedPost } from '@features/social/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;


export default function FriendsActivityCard({ discover = false }: { discover?: boolean }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [me, setMe] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let live = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMe(user?.id ?? null);
      const { posts: all } = await fetchFeed({ lim: 15, discover });
      if (!live) return;
      setPosts(all.filter(p => p.userId !== user?.id && (p.postType === 'run' || p.postType === 'conquest')).slice(0, 3));
    })().catch(() => {});
    return () => { live = false; };
  }, [discover]));

  const kudos = async (p: FeedPost) => {
    haptic.light();
    const optimistic = { ...p, hasKudos: !p.hasKudos, kudosCount: p.kudosCount + (p.hasKudos ? -1 : 1) };
    setPosts(prev => prev.map(x => (x.id === p.id ? optimistic : x)));
    try {
      const r = await toggleLike(p.id);
      setPosts(prev => prev.map(x => (x.id === p.id ? { ...x, hasKudos: r.liked, kudosCount: r.count } : x)));
    } catch {
      setPosts(prev => prev.map(x => (x.id === p.id ? p : x)));
    }
  };

  if (!posts.length) {
    return (
      <Pressable style={s.empty} onPress={() => navigation.navigate('Feed')} accessibilityRole="button">
        <Text style={s.emptyTitle}>Nothing from friends yet</Text>
        <Text style={s.emptySub}>Follow runners near you to see their runs here.</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ marginHorizontal: -18 }}>
      {posts.map(p => (
        <FeedPostCard
          key={p.id} post={p} currentUserId={me}
          onKudos={() => kudos(p)}
          onComment={() => navigation.navigate('Feed')}
          onUserPress={() => navigation.navigate('UserProfile', { userId: p.userId, username: p.username })}
          onDelete={() => {}}
        />
      ))}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    empty:      { backgroundColor: C.card, borderRadius: 24, padding: 18, gap: 4 },
    emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    emptySub:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
  });
}
