import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, SafeAreaView,
  RefreshControl, Platform, Animated, ScrollView,
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
import { FeedSkeleton } from '@features/social/components/FeedSkeleton';
import { StoryReel } from '@features/social/components/StoryReel';
import { ClubActivityStrip } from '@features/social/components/ClubActivityStrip';
import { fetchStories, type StoryGroup } from '@features/social/services/storyService';
import { supabase } from '@shared/services/supabase';
import { Avatar } from '@mobile/shared/components/Avatar';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';
import type { FeedPost } from '@features/social/types';
import type { ClubFeedActivityItem } from '@features/clubs/types';

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
    clubActivity,
    userId,
    loadMore,
    switchToDiscover,
    toggleKudos,
    toggleFollow,
    refresh,
    onCommentPosted,
    deletePost,
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

  const handleDefend = useCallback(() => {
    navigation.navigate('TerritoryMap', { initialFilter: 'stale' });
  }, [navigation]);

  const renderPost = useCallback(({ item }: { item: FeedPost }) => (
    <FeedPostCard
      post={item}
      currentUserId={userId}
      onKudos={() => toggleKudos(item.id)}
      onComment={() => setCommentPostId(item.id)}
      onUserPress={() => navigation.navigate('UserProfile', { userId: item.userId, username: item.username })}
      onDelete={() => deletePost(item.id)}
      onDefend={item.postType === 'attack' ? handleDefend : undefined}
    />
  ), [toggleKudos, navigation, userId, deletePost, handleDefend]);

  const keyExtractor = useCallback((item: FeedPost) => item.id, []);

  const goToDiscover = useCallback(() => switchTab('discover'), [switchTab]);
  const goToRun = useCallback(() => navigation.navigate('Run' as never), [navigation]);

  const goToClub = useCallback((item: ClubFeedActivityItem) => {
    navigation.navigate('ClubDetail', {
      clubId: item.clubId, clubName: item.clubName, badgeEmoji: item.badgeEmoji,
      memberCount: item.memberCount, totalKm: item.totalKm,
    });
  }, [navigation]);

  const DiscoverHeader = useMemo(() => {
    if (tab !== 'discover' || suggestedRunners.length === 0) return null;
    return (
      <View style={s.suggestedSection}>
        <Text style={[Type.overline, s.suggestedLabel]}>Runners near you</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggestedScroll}>
          {suggestedRunners.map(runner => {
            const isFollowing = followingIds.includes(runner.id);
            const isSelf = runner.id === userId;
            return (
              <Pressable
                key={runner.id}
                style={s.runnerCard}
                onPress={() => navigation.navigate('UserProfile', { userId: runner.id, username: runner.username })}
              >
                <View style={s.runnerAvatarWrap}>
                  <Avatar name={runner.username} color={runner.avatarColor} size={48} uri={runner.avatarUrl} />
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
    if (tab !== 'following') return null;
    if (stories.length === 0 && clubActivity.length === 0) return null;
    return (
      <>
        {stories.length > 0 && (
          <StoryReel
            groups={stories}
            onPress={(_g, i) => navigation.navigate('StoryViewer', { groups: stories, initialGroupIndex: i })}
          />
        )}
        <ClubActivityStrip items={clubActivity} onPress={goToClub} />
      </>
    );
  }, [tab, stories, clubActivity, navigation, goToClub]);

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.pillTrack}>
          <Animated.View style={[s.pillActive, { width: TAB_W - 6, transform: [{ translateX: tabX }] }]} />
          <Pressable style={s.tabItem} onPress={() => switchTab('following')}>
            <Text style={[s.tabLabel, tab === 'following' && s.tabLabelActive]}>Following</Text>
          </Pressable>
          <Pressable style={s.tabItem} onPress={() => switchTab('discover')}>
            <Text style={[s.tabLabel, tab === 'discover' && s.tabLabelActive]}>Discover</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setSearchVisible(true)} hitSlop={10} style={s.searchIcon}>
          <MagnifyingGlass size={19} color={C.t2} weight="light" />
        </Pressable>
      </View>

      {loading ? (
        <FeedSkeleton />
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
          ListEmptyComponent={
            <EmptyFeed
              tab={tab === 'following' ? 'following' : 'explore'}
              onCta={tab === 'following' ? goToDiscover : goToRun}
            />
          }
          ListFooterComponent={hasMore ? <FooterSpinner C={C} /> : null}
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

function FooterSpinner({ C }: { C: AppColors }) {
  // A single small pulse rather than importing ActivityIndicator's OS-default
  // spinner mid-list — keeps pagination feedback consistent with the skeleton
  // above rather than switching visual languages mid-scroll.
  return <View style={{ paddingVertical: 20, alignItems: 'center' }}><Text style={{ color: C.t3, fontFamily: Fonts.regular, fontSize: 11 }}>Loading more…</Text></View>;
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:           { flex: 1, backgroundColor: C.bg },
    header:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12, paddingTop: Platform.OS === 'android' ? 12 : 4 },
    pillTrack:      { flex: 1, flexDirection: 'row', position: 'relative', backgroundColor: C.stone, borderRadius: 999, padding: 3, height: 40 },
    pillActive:     { position: 'absolute', top: 3, bottom: 3, left: 3, backgroundColor: C.card, borderRadius: 999, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    tabItem:        { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    tabLabel:       { fontFamily: Fonts.medium, fontSize: 13, color: C.t3 },
    tabLabelActive: { fontFamily: Fonts.semiBold, color: C.black },
    searchIcon:     { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    list:           { paddingBottom: 100 },
    // Suggested runners
    suggestedSection: { backgroundColor: C.bg, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
    suggestedLabel:   { color: C.t3, paddingHorizontal: Spacing.gutter, marginBottom: 14 },
    suggestedScroll:  { paddingHorizontal: 20, gap: 10 },
    runnerCard:       { alignItems: 'center', gap: 5, minWidth: 68 },
    runnerAvatarWrap: { position: 'relative' },
    followDot:        { position: 'absolute', bottom: -1, right: -1, width: 18, height: 18, borderRadius: 9, backgroundColor: C.alwaysDark, borderWidth: 1.5, borderColor: C.white, alignItems: 'center', justifyContent: 'center' },
    runnerName:       { fontFamily: Fonts.regular, fontSize: 11, color: C.black, textAlign: 'center' },
    runnerScore:      { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, textAlign: 'center', marginTop: -2 },
    // Search modal
    searchModal:  { flex: 1, backgroundColor: C.bg },
    searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.gutter, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
    searchInput:  { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: C.black, height: 36, backgroundColor: C.stone, borderRadius: 8, paddingHorizontal: 12 },
  });
}
