import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, Platform, Animated, ScrollView, Modal, TextInput, useWindowDimensions } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Search, Check, Plus, UserPlus, X, ChevronLeft } from '@mobile/shared/icons/lucideCompat';
import { useFeed } from '@features/social/hooks/useFeed';
import { ErrorState } from '@mobile/shared/components/ErrorState';
import { fetchStolenZone, searchRunners } from '@features/social/services/feedService';
import { FeedPostCard } from '@features/social/components/FeedPostCard';
import CommentSheet from '@features/social/components/CommentSheet';
import { InviteRow } from '@features/social/components/InviteRow';
import { EmptyFeed } from '@features/social/components/EmptyFeed';
import { FeedSkeleton } from '@features/social/components/FeedSkeleton';
import { ClubActivityStrip } from '@features/social/components/ClubActivityStrip';
import { Avatar } from '@mobile/shared/components/Avatar';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';
import type { FeedPost, SuggestedRunner } from '@features/social/types';
import type { ClubFeedActivityItem } from '@features/clubs/types';
import { AlertLayer } from '@mobile/shared/components/AppAlert';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'following' | 'discover';

export default function FeedScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const { width } = useWindowDimensions();
  const navigation = useNavigation<Nav>();

  const [tab, setTab]                     = useState<Tab>('following');
  // Home's search button opens straight into runner search; its comment button straight into that post's comments.
  const route = useRoute<RouteProp<RootStackParamList, 'Feed'>>();
  const [commentPostId, setCommentPostId] = useState<string | null>(route.params?.post ?? null);
  const [searchVisible, setSearchVisible] = useState(!!route.params?.search);
  const [runnerQuery, setRunnerQuery]     = useState('');
  // A comment or kudos push tapped while Feed is already open brings a new post id (B13).
  useEffect(() => { if (route.params?.post) setCommentPostId(route.params.post); }, [route.params?.post]);

  const tabX = useRef(new Animated.Value(0)).current;
  // Three segments as in the mock: Following · Discover · Clubs (Clubs opens the Clubs screen).
  const TAB_W = (width - 36 - 6) / 3;

  const {
    followingPosts,
    discoverPosts,
    followingHasMore,
    discoverHasMore,
    loading,
    refreshing,
    loadError,
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
    muteAuthor,
    blockAuthor,
  } = useFeed();

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

  // Empty box: the suggestions. Typed (2+ letters): every runner by username on
  // the server (search_runners), debounced. It used to filter only the 5-8
  // suggestions on the phone, so friends could never be found.
  const [searchHits, setSearchHits] = useState<SuggestedRunner[] | null>(null);
  useEffect(() => {
    const q = runnerQuery.trim();
    if (q.length < 2) { setSearchHits(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      searchRunners(q).then(r => { if (alive) setSearchHits(r); }).catch(() => { if (alive) setSearchHits([]); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [runnerQuery]);
  const runnerResults = useMemo(() => {
    const q = runnerQuery.trim().toLowerCase();
    if (!q) return suggestedRunners;
    if (q.length < 2 || searchHits === null) return suggestedRunners.filter(r => r.username.toLowerCase().startsWith(q));
    return searchHits;
  }, [suggestedRunners, runnerQuery, searchHits]);

  // "Take it back": straight to a run.
  // Defend: run straight at the zone that was taken; fall back to the Run tab.
  const handleDefend = useCallback(async (post: FeedPost) => {
    const zone = await fetchStolenZone(post.id).catch(() => null);
    if (zone) {
      navigation.navigate('ActiveRun', {
        autoStart: false, activityType: 'run',
        targetZone: { id: zone.id, name: 'back your zone', ring: zone.ring, mode: 'attack' },
      });
    } else {
      navigation.navigate('Main', { screen: 'Run' });
    }
  }, [navigation]);

  const renderPost = useCallback(({ item }: { item: FeedPost }) => (
    <FeedPostCard
      post={item}
      currentUserId={userId}
      onKudos={() => toggleKudos(item.id)}
      onComment={() => setCommentPostId(item.id)}
      onUserPress={() => navigation.navigate('UserProfile', { userId: item.userId, username: item.username })}
      onDelete={() => deletePost(item.id)}
      onMuteAuthor={() => muteAuthor(item.userId)}
      onBlockAuthor={() => blockAuthor(item.userId)}
      onDefend={item.postType === 'attack' ? () => { void handleDefend(item); } : undefined}
    />
  ), [toggleKudos, navigation, userId, deletePost, handleDefend, muteAuthor, blockAuthor]);

  const keyExtractor = useCallback((item: FeedPost) => item.id, []);

  const goToDiscover = useCallback(() => switchTab('discover'), [switchTab]);
  // Run is a tab inside Main: React Navigation 7 won't find it from this root-stack screen (B09).
  const goToRun = useCallback(() => navigation.navigate('Main', { screen: 'Run' }), [navigation]);

  const goToClub = useCallback((item: ClubFeedActivityItem) => {
    navigation.navigate('ClubDetail', {
      clubId: item.clubId, clubName: item.clubName, badgeEmoji: item.badgeEmoji,
      memberCount: item.memberCount, totalKm: item.totalKm,
    });
  }, [navigation]);

  const DiscoverHeader = useMemo(() => {
    // O3: on day one (following fewer than 3), suggestions show on Following too.
    if ((tab !== 'discover' && followingIds.length >= 3) || suggestedRunners.length === 0) return null;
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
                    <Pressable
                      style={s.followDot} onPress={() => toggleFollow(runner.id)} hitSlop={12}
                      accessibilityRole="button" accessibilityLabel={isFollowing ? `Unfollow ${runner.username}` : `Follow ${runner.username}`}
                    >
                      {isFollowing
                        ? <Check size={9} color={C.white} strokeWidth={2.5} />
                        : <Plus  size={9} color={C.white} strokeWidth={2.5} />}
                    </Pressable>
                  )}
                </View>
                <Text style={s.runnerName} numberOfLines={1}>{runner.username.split(' ')[0]}</Text>
                <Text style={s.runnerScore}>{runner.distanceKm != null ? `${runner.distanceKm} km away` : Intl.NumberFormat().format(runner.territoryScore)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }, [tab, suggestedRunners, followingIds, userId, C, s, navigation, toggleFollow]);

  const FollowingHeader = useMemo(() => {
    if (tab !== 'following') return null;
    if (clubActivity.length === 0) return null;
    return (
      <>
        <ClubActivityStrip items={clubActivity} onPress={goToClub} />
      </>
    );
  }, [tab, clubActivity, goToClub]);

  return (
    <SafeAreaView style={s.root}>
      {/* Header: title + runner search (there's no direct-messages feature to link yet) */}
      <View style={s.titleRow}>
        {navigation.canGoBack() && (
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.searchIcon} accessibilityLabel="Back" accessibilityRole="button">
            <ChevronLeft size={18} color={C.t1} strokeWidth={2} />
          </Pressable>
        )}
        <Text style={[s.title, navigation.canGoBack() && { flex: 1, marginLeft: 10 }]}>Feed</Text>
        <Pressable onPress={() => setSearchVisible(true)} hitSlop={10} style={s.searchIcon} accessibilityLabel="Search runners">
          <Search size={16} color={C.t1} strokeWidth={1.8} />
        </Pressable>
      </View>
      <View style={s.header}>
        <View style={s.pillTrack}>
          <Animated.View style={[s.pillActive, { width: TAB_W, transform: [{ translateX: tabX }] }]} />
          <Pressable style={s.tabItem} onPress={() => switchTab('following')}>
            <Text style={[s.tabLabel, tab === 'following' && s.tabLabelActive]}>Following</Text>
          </Pressable>
          <Pressable style={s.tabItem} onPress={() => switchTab('discover')}>
            <Text style={[s.tabLabel, tab === 'discover' && s.tabLabelActive]}>Discover</Text>
          </Pressable>
          <Pressable style={s.tabItem} onPress={() => navigation.navigate('Club')}>
            <Text style={s.tabLabel}>Clubs</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <FeedSkeleton />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={keyExtractor}
          renderItem={renderPost}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh(tab)} tintColor={C.red} />}
          onEndReached={hasMore ? () => loadMore(tab) : undefined}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={tab === 'following' ? <>{DiscoverHeader}{FollowingHeader}</> : DiscoverHeader}
          ListEmptyComponent={
            loadError
              ? <ErrorState title="Couldn't load the feed" onRetry={() => refresh(tab)} />
              : <EmptyFeed
                  tab={tab === 'following' ? 'following' : 'explore'}
                  onCta={tab === 'following' ? goToDiscover : goToRun}
                />
          }
          ListFooterComponent={hasMore && posts.length > 0 ? <FooterSpinner C={C} /> : null}
        />
      )}

      <CommentSheet
        postId={commentPostId}
        onClose={() => setCommentPostId(null)}
        onCommentPosted={onCommentPosted}
      />

      {/* Runner search modal */}
      <Modal visible={searchVisible} animationType="slide" transparent={false} onRequestClose={() => setSearchVisible(false)}>
        {/* A Modal is a new native root: give it its own safe-area measurement,
            or the content starts under the status bar. */}
        <SafeAreaProvider>
        <SafeAreaView style={s.searchModal}>
          <Text style={s.searchTitle}>Search</Text>
          <View style={s.searchHeader}>
            <TextInput
              style={s.searchInput}
              placeholder="Runners by name"
              placeholderTextColor={C.t3}
              value={runnerQuery}
              onChangeText={setRunnerQuery}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable onPress={() => { setSearchVisible(false); setRunnerQuery(''); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close search">
              <X size={18} color={C.t2} strokeWidth={1.75} />
            </Pressable>
          </View>
          {!runnerQuery.trim() && <InviteRow />}
          {!runnerQuery.trim() && (
            <Text style={[Type.overline, s.suggestedLabel]}>Suggested</Text>
          )}
          <FlatList
            data={runnerResults}
            keyExtractor={r => r.id}
            renderItem={({ item }) => (
              <RunnerRow
                runner={item}
                isFollowing={followingIds.includes(item.id)}
                isSelf={item.id === userId}
                onPress={() => { setSearchVisible(false); navigation.navigate('UserProfile', { userId: item.id, username: item.username }); }}
                onFollow={() => toggleFollow(item.id)}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.list}
            ListEmptyComponent={
              runnerQuery.trim()
                ? <Text style={s.searchEmpty}>No runners match "{runnerQuery.trim()}"</Text>
                : null
            }
          />
        </SafeAreaView>
        <AlertLayer />
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}

// Same row for both the default "Suggested" list and typed-query results —
// no separate layout for the two states.
function RunnerRow({
  runner, isFollowing, isSelf, onPress, onFollow,
}: {
  runner: SuggestedRunner;
  isFollowing: boolean;
  isSelf: boolean;
  onPress: () => void;
  onFollow: () => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mkRowStyles(C), [C]);
  return (
    <Pressable style={s.row} onPress={onPress}>
      <Avatar name={runner.username} color={runner.avatarColor} size={44} uri={runner.avatarUrl} />
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{runner.username}</Text>
        <Text style={s.score}>{Intl.NumberFormat().format(runner.territoryScore)} territory score</Text>
      </View>
      {!isSelf && (
        <Pressable hitSlop={8}
          style={[s.followBtn, isFollowing && s.followBtnActive]}
          onPress={onFollow}
          accessibilityRole="button" accessibilityLabel={isFollowing ? `Unfollow ${runner.username}` : `Follow ${runner.username}`}
        >
          {isFollowing
            ? <Check size={13} color={C.t2} strokeWidth={2} />
            : <UserPlus size={13} color={C.alwaysLight} strokeWidth={2} />}
        </Pressable>
      )}
    </Pressable>
  );
}

function mkRowStyles(C: AppColors) {
  return StyleSheet.create({
    row:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.gutter, paddingVertical: 10 },
    info:         { flex: 1 },
    name:         { fontFamily: Fonts.medium, fontSize: 14, color: C.black },
    score:        { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 2 },
    followBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center' },
    followBtnActive: { backgroundColor: C.stone, borderWidth: 0.5, borderColor: C.border },
  });
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
    titleRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 18 : 8, paddingBottom: 12 },
    title:          { fontFamily: Fonts.bold, fontSize: 28, lineHeight: 30, letterSpacing: -0.7, color: C.t1 },
    header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 12 },
    pillTrack:      { flex: 1, flexDirection: 'row', position: 'relative', backgroundColor: C.border, borderRadius: 999, padding: 3, height: 38 },
    pillActive:     { position: 'absolute', top: 3, bottom: 3, left: 3, backgroundColor: C.card, borderRadius: 999, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    tabItem:        { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    tabLabel:       { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t2 },
    tabLabelActive: { color: C.t1 },
    searchIcon:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    list:           { paddingTop: 4, paddingBottom: 100 },
    // Suggested runners
    suggestedSection: { backgroundColor: C.card, marginHorizontal: 18, marginBottom: 12, borderRadius: 22, paddingTop: 16, paddingBottom: 14 },
    suggestedLabel:   { color: C.t2, paddingHorizontal: 14, marginBottom: 12 },
    suggestedScroll:  { paddingHorizontal: 14, gap: 12 },
    runnerCard:       { alignItems: 'center', gap: 5, minWidth: 68 },
    runnerAvatarWrap: { position: 'relative' },
    followDot:        { position: 'absolute', bottom: -1, right: -1, width: 20, height: 20, borderRadius: 10, backgroundColor: C.red, borderWidth: 2, borderColor: C.card, alignItems: 'center', justifyContent: 'center' },
    runnerName:       { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t1, textAlign: 'center' },
    runnerScore:      { fontFamily: Fonts.numeric, fontSize: 14, color: C.t2, textAlign: 'center', marginTop: -2 },
    // Search modal
    searchModal:  { flex: 1, backgroundColor: C.bg },
    searchTitle:  { fontFamily: Fonts.semiBold, fontSize: 28, color: C.t1, paddingHorizontal: Spacing.gutter, paddingTop: 12 },
    searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.gutter, paddingVertical: 12 },
    searchInput:  { flex: 1, fontFamily: Fonts.regular, fontSize: 15, color: C.t1, height: 52, backgroundColor: C.card, borderRadius: 26, paddingHorizontal: 18 },
    searchEmpty:  { fontFamily: Fonts.regular, fontSize: 13, color: C.t3, textAlign: 'center', paddingTop: 40, paddingHorizontal: 32 },
  });
}
