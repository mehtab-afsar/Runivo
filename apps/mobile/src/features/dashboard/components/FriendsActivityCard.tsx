/**
 * Home: the latest 3 activities from runners you follow, with kudos inline
 * (PRD H2). Taps go to the Feed; the heart gives kudos without leaving Home.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Heart } from 'phosphor-react-native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Fonts, haptic, type AppColors } from '@theme';
import { Avatar } from '@mobile/shared/components/Avatar';
import { supabase } from '@shared/services/supabase';
import { fetchFeed, toggleLike } from '@features/social/services/feedService';
import type { FeedPost } from '@features/social/types';
import { activityTitle, fmtClock, fmtKm } from '@features/profile/utils/profileStats';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

export default function FriendsActivityCard() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useFocusEffect(useCallback(() => {
    let live = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { posts: all } = await fetchFeed({ lim: 15 });
      if (!live) return;
      setPosts(all.filter(p => p.userId !== user?.id && (p.postType === 'run' || p.postType === 'conquest')).slice(0, 3));
    })().catch(() => {});
    return () => { live = false; };
  }, []));

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

  if (!posts.length) return null;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.label}>From people you follow</Text>
        <Pressable onPress={() => navigation.navigate('Main', { screen: 'Feed' })} hitSlop={8} accessibilityRole="button">
          <Text style={s.all}>Feed</Text>
        </Pressable>
      </View>
      {posts.map((p, i) => (
        <View key={p.id} style={[s.row, i > 0 && s.border]}>
          <Pressable style={s.main} onPress={() => navigation.navigate('UserProfile', { userId: p.userId, username: p.username })} accessibilityRole="button">
            <Avatar uri={p.avatarUrl} name={p.username} color={p.avatarColor} size={34} />
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>
                {p.username} <Text style={s.when}>· {ago(p.createdAt)}</Text>
              </Text>
              <Text style={s.meta} numberOfLines={1}>
                {p.title || activityTitle({ activityType: p.activityType, startTime: new Date(p.createdAt).getTime() })} · {fmtKm(p.distanceM / 1000)} km
                {p.durationSec > 0 ? ` · ${fmtClock(p.durationSec)}` : ''}
              </Text>
            </View>
          </Pressable>
          <Pressable
            style={s.kudos}
            onPress={() => kudos(p)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={p.hasKudos ? 'Remove kudos' : 'Give kudos'}
            accessibilityState={{ selected: p.hasKudos }}
          >
            <Heart size={18} color={p.hasKudos ? C.red : C.t2} weight={p.hasKudos ? 'fill' : 'regular'} />
            {p.kudosCount > 0 && <Text style={[s.count, p.hasKudos && { color: C.red }]}>{p.kudosCount}</Text>}
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:   { backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
    head:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    label:  { fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    all:    { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    row:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8 },
    border: { borderTopWidth: 1, borderTopColor: C.border },
    main:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    name:   { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    when:   { fontFamily: Fonts.regular, fontSize: 12, color: C.t3 },
    meta:   { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, marginTop: 1 },
    kudos:  { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 40, justifyContent: 'flex-end' },
    count:  { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t2 },
  });
}
