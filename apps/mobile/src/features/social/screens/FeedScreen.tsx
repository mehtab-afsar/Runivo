import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, SafeAreaView,
  ActivityIndicator, RefreshControl, Platform, Modal, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useFeed } from '@features/social/hooks/useFeed';
import { FeedPostCard } from '@features/social/components/FeedPostCard';
import { EmptyFeed } from '@features/social/components/EmptyFeed';
import { StoryReel } from '@features/social/components/StoryReel';
import { fetchStories, type StoryGroup } from '@features/social/services/storyService';
import { supabase } from '@shared/services/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { FeedPost } from '@features/social/types';
import { fmtDistShort } from '@mobile/shared/lib/formatters';
import { avatarColor } from '@shared/lib/avatarUtils';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type FeedTab = 'explore' | 'following';

const C = {
  bg: '#F7F6F4', black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD',
  red: '#D93518', border: '#DDD9D4', white: '#FFFFFF', stone: '#F0EDE8',
};

const REACTIONS = [
  { key: 'kudos',  emoji: '❤️',  label: 'Kudos' },
  { key: 'fire',   emoji: '🔥',  label: 'Fire' },
  { key: 'crown',  emoji: '👑',  label: 'Crown' },
  { key: 'muscle', emoji: '💪',  label: 'Strong' },
];

function PostDetailSheet({ post, onClose, onKudos }: { post: FeedPost; onClose: () => void; onKudos: () => void }) {
  const insets = useSafeAreaInsets();
  const fmt = (s: number) => { const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sd.backdrop} onPress={onClose} />
      <View style={[sd.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={sd.handle} />
        <View style={sd.userRow}>
          <View style={[sd.avatar, { backgroundColor: post.avatarColor }]}>
            <Text style={sd.avatarText}>{post.username.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={sd.username}>{post.username}</Text>
            <Text style={sd.time}>{new Date(post.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
          </View>
        </View>
        <View style={sd.statsRow}>
          <View style={sd.statItem}><Text style={sd.statVal}>{fmtDistShort(post.distanceM)}</Text><Text style={sd.statLbl}>Distance</Text></View>
          <View style={sd.divider} />
          <View style={sd.statItem}><Text style={sd.statVal}>{fmt(post.durationSec)}</Text><Text style={sd.statLbl}>Time</Text></View>
          <View style={sd.divider} />
          <View style={sd.statItem}><Text style={sd.statVal}>{post.avgPace}</Text><Text style={sd.statLbl}>Pace</Text></View>
        </View>
        {(post.territoriesClaimed > 0 || post.xpEarned > 0) && (
          <View style={sd.badgeRow}>
            {post.territoriesClaimed > 0 && <View style={sd.badge}><Text style={sd.badgeText}>⚡ {post.territoriesClaimed} zones</Text></View>}
            {post.xpEarned > 0 && <View style={[sd.badge, sd.badgeGreen]}><Text style={[sd.badgeText, { color: '#1A6B40' }]}>✨ {post.xpEarned} XP</Text></View>}
          </View>
        )}
        <Text style={sd.reactLabel}>REACT</Text>
        <View style={sd.reactRow}>
          {REACTIONS.map(r => (
            <Pressable key={r.key} style={[sd.reactBtn, r.key === 'kudos' && post.hasKudos && sd.reactBtnActive]} onPress={() => { if (r.key === 'kudos') { onKudos(); onClose(); } }}>
              <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
              <Text style={sd.reactBtnLabel}>{r.key === 'kudos' ? post.kudosCount : ''}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const sd = StyleSheet.create({
  backdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet:         { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12 },
  handle:        { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  userRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar:        { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText:    { fontFamily: 'Barlow_600SemiBold', fontSize: 16, color: C.white },
  username:      { fontFamily: 'Barlow_500Medium', fontSize: 14, color: C.black },
  time:          { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 2 },
  statsRow:      { flexDirection: 'row', backgroundColor: C.stone, borderRadius: 12, padding: 14, marginBottom: 12 },
  statItem:      { flex: 1, alignItems: 'center' },
  statVal:       { fontFamily: 'Barlow_600SemiBold', fontSize: 16, color: C.black },
  statLbl:       { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginTop: 2 },
  divider:       { width: 0.5, height: 32, backgroundColor: C.border },
  badgeRow:      { flexDirection: 'row', gap: 8, marginBottom: 16 },
  badge:         { backgroundColor: '#FEF0EE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  badgeGreen:    { backgroundColor: '#EDF7F2' },
  badgeText:     { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.red },
  reactLabel:    { fontFamily: 'Barlow_500Medium', fontSize: 10, color: C.t3, letterSpacing: 1, marginBottom: 10 },
  reactRow:      { flexDirection: 'row', gap: 10, marginBottom: 8 },
  reactBtn:      { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: C.stone, borderRadius: 12, borderWidth: 0.5, borderColor: C.border },
  reactBtnActive:{ backgroundColor: '#FCE8EB', borderColor: C.red },
  reactBtnLabel: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 2 },
});

export default function FeedScreen() {
  const navigation = useNavigation<Nav>();
  const [tab, setTab]             = useState<FeedTab>('explore');
  const [stories, setStories]     = useState<StoryGroup[]>([]);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const { posts, loading, refreshing, suggestedRunners, followingIds, toggleKudos, toggleFollow, refresh } = useFeed();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user.id) fetchStories(session.user.id).then(setStories).catch(() => {});
    });
  }, []);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Feed</Text>
        <Pressable onPress={() => navigation.navigate('Notifications')}>
          <Text style={{ fontSize: 20 }}>🔔</Text>
        </Pressable>
      </View>

      <View style={s.tabs}>
        <Pressable style={[s.tabBtn, tab === 'explore' && s.tabBtnActive]} onPress={() => setTab('explore')}>
          <Text style={[s.tabLabel, tab === 'explore' && s.tabLabelActive]}>Discover</Text>
        </Pressable>
        <Pressable style={[s.tabBtn, tab === 'following' && s.tabBtnActive]} onPress={() => setTab('following')}>
          <Text style={[s.tabLabel, tab === 'following' && s.tabLabelActive]}>Following</Text>
        </Pressable>
      </View>

      <StoryReel groups={stories} onPress={(g, i) => navigation.navigate('StoryViewer' as any, { groups: stories, initialGroupIndex: i })} />

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={C.red} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
          ListHeaderComponent={
            tab === 'explore' && suggestedRunners.length > 0 ? (
              <View style={s.suggestedSection}>
                <Text style={s.suggestedLabel}>Suggested Runners</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.suggestedScroll}
                >
                  {suggestedRunners.slice(0, 10).map(runner => {
                    const color = avatarColor(runner.username);
                    const initial = runner.username.slice(0, 1).toUpperCase();
                    const isFollowing = followingIds.includes(runner.id);
                    return (
                      <View key={runner.id} style={s.runnerCard}>
                        <View style={s.runnerAvatarWrap}>
                          <View style={[s.runnerAvatar, { backgroundColor: color }, isFollowing && s.runnerAvatarFollowing]}>
                            <Text style={s.runnerAvatarText}>{initial}</Text>
                          </View>
                          <Pressable
                            style={s.followDot}
                            onPress={() => toggleFollow(runner.id)}
                          >
                            <Text style={{ fontSize: 9, color: C.white }}>{isFollowing ? '✓' : '+'}</Text>
                          </Pressable>
                        </View>
                        <Text style={s.runnerName} numberOfLines={1}>{runner.username.split(' ')[0]}</Text>
                        <Text style={s.runnerKm}>{runner.totalDistanceKm} km</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <FeedPostCard
              post={item}
              onKudos={() => toggleKudos(item.id)}
              onPress={() => setSelectedPost(item)}
            />
          )}
          ListEmptyComponent={<EmptyFeed tab={tab} />}
        />
      )}

      {selectedPost && (
        <PostDetailSheet
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onKudos={() => { toggleKudos(selectedPost.id); setSelectedPost(null); }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.bg },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 8 },
  title:          { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, color: C.black },
  tabs:           { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tabBtn:         { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: 'transparent' },
  tabBtnActive:   { borderBottomColor: C.black },
  tabLabel:       { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t3 },
  tabLabelActive: { fontFamily: 'Barlow_500Medium', color: C.black },
  list:           { paddingBottom: 100 },
  loader:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // Suggested runners
  suggestedSection: { backgroundColor: C.bg, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
  suggestedLabel:   { fontFamily: 'Barlow_300Light', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.8, color: C.t3, paddingHorizontal: 20, marginBottom: 14 },
  suggestedScroll:  { paddingHorizontal: 20, gap: 10 },
  runnerCard:       { alignItems: 'center', gap: 6, minWidth: 72 },
  runnerAvatarWrap: { position: 'relative' },
  runnerAvatar:     { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.border },
  runnerAvatarFollowing: { borderWidth: 2, borderColor: C.black },
  runnerAvatarText: { fontFamily: 'Barlow_600SemiBold', fontSize: 15, color: C.white },
  followDot:        { position: 'absolute', bottom: -1, right: -1, width: 18, height: 18, borderRadius: 9, backgroundColor: C.black, borderWidth: 1.5, borderColor: C.white, alignItems: 'center', justifyContent: 'center' },
  runnerName:       { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.black, textAlign: 'center' },
  runnerKm:         { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, textAlign: 'center', marginTop: -3 },
});
