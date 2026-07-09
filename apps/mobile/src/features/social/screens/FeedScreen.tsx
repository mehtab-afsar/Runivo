import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, SafeAreaView,
  ActivityIndicator, RefreshControl, Platform, Animated, ScrollView,
  Modal, TextInput, useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { MagnifyingGlass, Check, Plus, X } from 'phosphor-react-native';
import { useFeed } from '@features/social/hooks/useFeed';
import { FeedPostCard } from '@features/social/components/FeedPostCard';
import CommentSheet from '@features/social/components/CommentSheet';
import { EmptyFeed } from '@features/social/components/EmptyFeed';
import { StoryReel } from '@features/social/components/StoryReel';
import { fetchStories, type StoryGroup } from '@features/social/services/storyService';
import { supabase } from '@shared/services/supabase';
import { avatarColor } from '@shared/lib/avatarUtils';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';
import type { FeedPost } from '@features/social/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'following' | 'discover';

export default function FeedScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const { width } = useWindowDimensions();
  const navigation = useNavigation<Nav>();

  const [tab, setTab]                     = useState<Tab>('following');
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [stories, setStories]             = useState<StoryGroup[]>([]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');

  const tabX = useRef(new Animated.Value(0)).current;
  const TAB_W = (width - 40) / 2;

  const {
    followingPosts,
    discoverPosts,
    followingHasMore,
    discoverHasMore,
    loading,
    refreshing,
    followingIds,
    suggestedRunners,
    userId,
    loadMore,
    switchToDiscover,
    toggleKudos,
    toggleFollow,
    refresh,
    onCommentPosted,
  } = useFeed();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user.id) fetchStories(session.user.id).then(setStories).catch(() => {});
    });
  }, []);

  const switchTab = useCallback((t: Tab) => {
    setTab(t);
    Animated.timing(tabX, {
      toValue: t === 'following' ? 0 : TAB_W,
      duration: 200,
      useNativeDriver: true,
    }).start();
    if (t === 'discover') switchToDiscover();
  }, [tabX, TAB_W, switchToDiscover]);

  const posts = tab === 'following' ? followingPosts : discoverPosts;
  const hasMore = tab === 'following' ? followingHasMore : discoverHasMore;

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.trim().toLowerCase();
    return posts.filter(p => p.username.toLowerCase().includes(q));
  }, [posts, searchQuery]);

  const renderPost = useCallback(({ item }: { item: FeedPost }) => (
    <FeedPostCard
      post={item}
      onKudos={() => toggleKudos(item.id)}
      onComment={() => setCommentPostId(item.id)}
      onUserPress={() => navigation.navigate('UserProfile', { userId: item.userId, username: item.username })}
    />
  ), [toggleKudos, navigation]);

  const keyExtractor = useCallback((item: FeedPost) => item.id, []);

  const DiscoverHeader = useMemo(() => {
    if (tab !== 'discover' || suggestedRunners.length === 0) return null;
    return (
      <View style={s.suggestedSection}>
        <Text style={s.suggestedLabel}>Runners near you</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggestedScroll}>
          {suggestedRunners.map(runner => {
            const color = avatarColor(runner.username);
            const initial = runner.username.slice(0, 1).toUpperCase();
            const isFollowing = followingIds.includes(runner.id);
            const isSelf = runner.id === userId;
            return (
              <Pressable
                key={runner.id}
                style={s.runnerCard}
                onPress={() => navigation.navigate('UserProfile', { userId: runner.id, username: runner.username })}
              >
                <View style={s.runnerAvatarWrap}>
                  <View style={[s.runnerAvatar, { backgroundColor: color }]}>
                    <Text style={s.runnerAvatarText}>{initial}</Text>
                  </View>
                  {!isSelf && (
                    <Pressable style={s.followDot} onPress={() => toggleFollow(runner.id)}>
                      {isFollowing
                        ? <Check size={9} color={C.white} weight="bold" />
                        : <Plus  size={9} color={C.white} weight="bold" />}
                    </Pressable>
                  )}
                </View>
                <Text style={s.runnerName} numberOfLines={1}>{runner.username.split(' ')[0]}</Text>
                <Text style={s.runnerScore}>{runner.territoryScore} TS</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }, [tab, suggestedRunners, followingIds, userId, C, s, navigation, toggleFollow]);

  const FollowingHeader = useMemo(() => {
    if (tab !== 'following' || stories.length === 0) return null;
    return (
      <StoryReel
        groups={stories}
        onPress={(_g, i) => navigation.navigate('StoryViewer', { groups: stories, initialGroupIndex: i })}
      />
    );
  }, [tab, stories, navigation]);

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.tabs}>
          <Pressable style={s.tabItem} onPress={() => switchTab('following')}>
            <Text style={[s.tabLabel, tab === 'following' && s.tabLabelActive]}>Following</Text>
          </Pressable>
          <Pressable style={s.tabItem} onPress={() => switchTab('discover')}>
            <Text style={[s.tabLabel, tab === 'discover' && s.tabLabelActive]}>Discover</Text>
          </Pressable>
          <Animated.View style={[s.underline, { width: TAB_W, transform: [{ translateX: tabX }] }]} />
        </View>
        <Pressable onPress={() => setSearchVisible(true)} hitSlop={10}>
          <MagnifyingGlass size={19} color={C.t2} weight="light" />
        </Pressable>
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={C.red} /></View>
      ) : (
        <FlatList
          data={filteredPosts}
          keyExtractor={keyExtractor}
          renderItem={renderPost}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh(tab)} tintColor={C.red} />}
          onEndReached={hasMore ? () => loadMore(tab) : undefined}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={tab === 'following' ? FollowingHeader : DiscoverHeader}
          ListEmptyComponent={<EmptyFeed tab={tab === 'following' ? 'following' : 'explore'} />}
          ListFooterComponent={hasMore ? <ActivityIndicator color={C.red} style={{ paddingVertical: 16 }} /> : null}
        />
      )}

      <CommentSheet
        postId={commentPostId}
        onClose={() => setCommentPostId(null)}
        onCommentPosted={onCommentPosted}
      />

      {/* Search modal */}
      <Modal visible={searchVisible} animationType="slide" transparent={false} onRequestClose={() => setSearchVisible(false)}>
        <SafeAreaView style={s.searchModal}>
          <View style={s.searchHeader}>
            <TextInput
              style={s.searchInput}
              placeholder="Search runners…"
              placeholderTextColor={C.t3}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable onPress={() => { setSearchVisible(false); setSearchQuery(''); }} hitSlop={8}>
              <X size={18} color={C.t2} weight="light" />
            </Pressable>
          </View>
          <FlatList
            data={filteredPosts}
            keyExtractor={keyExtractor}
            renderItem={renderPost}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.list}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:           { flex: 1, backgroundColor: C.bg },
    header:         { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 0, paddingTop: Platform.OS === 'android' ? 12 : 0 },
    tabs:           { flex: 1, flexDirection: 'row', position: 'relative' },
    tabItem:        { flex: 1, paddingVertical: 12, alignItems: 'center' },
    tabLabel:       { fontFamily: Fonts.regular, fontSize: 13, color: C.t3 },
    tabLabelActive: { fontFamily: Fonts.medium, color: C.black },
    underline:      { position: 'absolute', bottom: 0, height: 1.5, backgroundColor: C.black },
    loader:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list:           { paddingBottom: 100 },
    // Suggested runners
    suggestedSection: { backgroundColor: C.bg, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
    suggestedLabel:   { ...Type.overline, color: C.t3, paddingHorizontal: Spacing.gutter, marginBottom: 14 },
    suggestedScroll:  { paddingHorizontal: 20, gap: 10 },
    runnerCard:       { alignItems: 'center', gap: 5, minWidth: 68 },
    runnerAvatarWrap: { position: 'relative' },
    runnerAvatar:     { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    runnerAvatarText: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.white },
    followDot:        { position: 'absolute', bottom: -1, right: -1, width: 18, height: 18, borderRadius: 9, backgroundColor: C.alwaysDark, borderWidth: 1.5, borderColor: C.white, alignItems: 'center', justifyContent: 'center' },
    runnerName:       { fontFamily: Fonts.regular, fontSize: 11, color: C.black, textAlign: 'center' },
    runnerScore:      { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, textAlign: 'center', marginTop: -2 },
    // Search modal
    searchModal:  { flex: 1, backgroundColor: C.bg },
    searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.gutter, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
    searchInput:  { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: C.black, height: 36, backgroundColor: C.stone, borderRadius: 8, paddingHorizontal: 12 },
  });
}
