import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, SafeAreaView,
  ActivityIndicator, RefreshControl, Platform, Modal, ScrollView, TextInput,
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
import { Bell, Heart, Flame, Crown, Dumbbell, Check, Plus, Zap, Sparkles } from 'lucide-react-native';
import { useTheme, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type FeedTab = 'explore' | 'following';

const REACTIONS: { key: string; Icon: typeof Heart; color: string; label: string }[] = [
  { key: 'kudos',  Icon: Heart,    color: '#D93518', label: 'Kudos' },
  { key: 'fire',   Icon: Flame,    color: '#EA580C', label: 'Fire' },
  { key: 'crown',  Icon: Crown,    color: '#D97706', label: 'Crown' },
  { key: 'muscle', Icon: Dumbbell, color: '#7C3AED', label: 'Strong' },
];

function PostDetailSheet({ post, onClose, onKudos }: { post: FeedPost; onClose: () => void; onKudos: () => void }) {
  const C = useTheme();
  const sd = useMemo(() => mkSd(C), [C]);
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
            {post.territoriesClaimed > 0 && <View style={[sd.badge, sd.badgeInner]}><Zap size={10} color={C.red} strokeWidth={2} /><Text style={sd.badgeText}>{post.territoriesClaimed} zones</Text></View>}
            {post.xpEarned > 0 && <View style={[sd.badge, sd.badgeGreen, sd.badgeInner]}><Sparkles size={10} color="#1A6B40" strokeWidth={2} /><Text style={[sd.badgeText, { color: '#1A6B40' }]}>{post.xpEarned} XP</Text></View>}
          </View>
        )}
        <Text style={sd.reactLabel}>REACT</Text>
        <View style={sd.reactRow}>
          {REACTIONS.map(r => {
            const isActive = r.key === 'kudos' && post.hasKudos;
            return (
              <Pressable key={r.key} style={[sd.reactBtn, isActive && sd.reactBtnActive]} onPress={() => { if (r.key === 'kudos') { onKudos(); onClose(); } }}>
                <r.Icon size={22} color={isActive ? C.white : r.color} strokeWidth={1.5} />
                <Text style={sd.reactBtnLabel}>{r.key === 'kudos' ? post.kudosCount : ''}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

export default function FeedScreen() {
  const C = useTheme();
  const s = useMemo(() => mkS(C), [C]);
  const navigation = useNavigation<Nav>();
  const [tab, setTab]             = useState<FeedTab>('explore');
  const [stories, setStories]     = useState<StoryGroup[]>([]);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [searchQuery, setSearchQuery]   = useState('');
  const { posts, loading, refreshing, suggestedRunners, followingIds, toggleKudos, toggleFollow, refresh } = useFeed();

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return posts;
    return posts.filter(p => p.username.toLowerCase().includes(q));
  }, [posts, searchQuery]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user.id) fetchStories(session.user.id).then(setStories).catch(() => {});
    });
  }, []);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Feed</Text>
        <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8}>
          <Bell size={20} color={C.black} strokeWidth={1.5} />
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

      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search runners…"
          placeholderTextColor={C.t3}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <StoryReel groups={stories} onPress={(g, i) => navigation.navigate('StoryViewer', { groups: stories, initialGroupIndex: i })} />

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={C.red} /></View>
      ) : (
        <FlatList
          data={filteredPosts}
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
                      <Pressable key={runner.id} style={s.runnerCard} onPress={() => navigation.navigate('UserProfile', { userId: runner.id, username: runner.username })}>
                        <View style={s.runnerAvatarWrap}>
                          <View style={[s.runnerAvatar, { backgroundColor: color }, isFollowing && s.runnerAvatarFollowing]}>
                            <Text style={s.runnerAvatarText}>{initial}</Text>
                          </View>
                          <Pressable
                            style={s.followDot}
                            onPress={() => toggleFollow(runner.id)}
                          >
                            {isFollowing ? <Check size={9} color={C.white} strokeWidth={3} /> : <Plus size={9} color={C.white} strokeWidth={3} />}
                          </Pressable>
                        </View>
                        <Text style={s.runnerName} numberOfLines={1}>{runner.username.split(' ')[0]}</Text>
                        <Text style={s.runnerKm}>{runner.totalDistanceKm} km</Text>
                      </Pressable>
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
              onUserPress={() => navigation.navigate('UserProfile', { userId: item.userId, username: item.username })}
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

function mkSd(C: AppColors) {
  return StyleSheet.create({
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
    badgeInner:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
    badgeGreen:    { backgroundColor: '#EDF7F2' },
    badgeText:     { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.red },
    reactLabel:    { fontFamily: 'Barlow_500Medium', fontSize: 10, color: C.t3, letterSpacing: 1, marginBottom: 10 },
    reactRow:      { flexDirection: 'row', gap: 10, marginBottom: 8 },
    reactBtn:      { flex: 1, alignItems: 'center', paddingVertical: 12, backgroundColor: C.stone, borderRadius: 12, borderWidth: 0.5, borderColor: C.border },
    reactBtnActive:{ backgroundColor: '#FCE8EB', borderColor: C.red },
    reactBtnLabel: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 2 },
  });
}

function mkS(C: AppColors) {
  return StyleSheet.create({
    root:           { flex: 1, backgroundColor: C.bg },
    header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 8 },
    title:          { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, color: C.black },
    tabs:           { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 0.5, borderBottomColor: C.border },
    tabBtn:         { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: 'transparent' },
    tabBtnActive:   { borderBottomColor: C.black },
    tabLabel:       { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t3 },
    tabLabelActive: { fontFamily: 'Barlow_500Medium', color: C.black },
    searchRow:      { paddingHorizontal: 20, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: C.border },
    searchInput:    { height: 34, backgroundColor: C.white, borderRadius: 8, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 12, fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.black },
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
}
