import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@shared/services/supabase';
import {
  fetchFeed,
  toggleLike,
  fetchFollowingIds,
  fetchSuggestedRunners,
  toggleFollowService,
  deletePost as deletePostService,
} from '@features/social/services/feedService';
import { fetchMyClubActivity } from '@features/clubs/services/clubService';
import type { FeedPost, SuggestedRunner } from '@features/social/types';
import type { ClubFeedActivityItem } from '@features/clubs/types';

type Tab = 'following' | 'discover';

export function useFeed() {
  const [followingPosts, setFollowingPosts]     = useState<FeedPost[]>([]);
  const [discoverPosts,  setDiscoverPosts]       = useState<FeedPost[]>([]);
  const [followingCursor, setFollowingCursor]   = useState<string | null>(null);
  const [discoverCursor,  setDiscoverCursor]    = useState<string | null>(null);
  const [followingHasMore, setFollowingHasMore] = useState(true);
  const [discoverHasMore,  setDiscoverHasMore]  = useState(true);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingIds,     setFollowingIds]     = useState<string[]>([]);
  const [suggestedRunners, setSuggestedRunners] = useState<SuggestedRunner[]>([]);
  const [clubActivity,     setClubActivity]     = useState<ClubFeedActivityItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const loadingMoreRef = useRef(false);
  const kudosInFlightRef = useRef(new Set<string>());

  const loadTab = useCallback(async (tab: Tab, refresh = false, uid?: string) => {
    const isDiscover = tab === 'discover';
    const cursorTs   = refresh ? null : (isDiscover ? discoverCursor : followingCursor);
    const hasMore    = isDiscover ? discoverHasMore : followingHasMore;

    if (!refresh && !hasMore) return;

    try {
      const { posts, nextCursor } = await fetchFeed({
        discover: isDiscover,
        cursorTs,
        lim: 20,
      });

      if (isDiscover) {
        setDiscoverPosts(prev => refresh ? posts : [...prev, ...posts]);
        setDiscoverCursor(nextCursor);
        setDiscoverHasMore(nextCursor !== null);
      } else {
        setFollowingPosts(prev => refresh ? posts : [...prev, ...posts]);
        setFollowingCursor(nextCursor);
        setFollowingHasMore(nextCursor !== null);
      }
    } catch { /* offline */ }
  }, [discoverCursor, followingCursor, discoverHasMore, followingHasMore]);

  const initLoad = useCallback(async (uid: string) => {
    const [followIds, suggested, myClubActivity] = await Promise.all([
      fetchFollowingIds(uid),
      fetchSuggestedRunners(uid),
      fetchMyClubActivity().catch(() => []),
    ]);
    setFollowingIds(followIds);
    setSuggestedRunners(suggested.filter(r => r.id !== uid));
    setClubActivity(myClubActivity);

    await loadTab('following', true, uid);
    setLoading(false);
  }, [loadTab]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user.id ?? null;
      setUserId(uid);
      if (uid) initLoad(uid);
      else setLoading(false);
    });
  }, [initLoad]);

  const loadMore = useCallback(async (tab: Tab) => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    await loadTab(tab);
    loadingMoreRef.current = false;
  }, [loadTab]);

  const switchToDiscover = useCallback(() => {
    if (discoverPosts.length === 0) loadTab('discover', true);
  }, [discoverPosts.length, loadTab]);

  const updateBothLists = (postId: string, updater: (p: FeedPost) => FeedPost) => {
    setFollowingPosts(prev => prev.map(p => p.id === postId ? updater(p) : p));
    setDiscoverPosts (prev => prev.map(p => p.id === postId ? updater(p) : p));
  };

  const toggleKudos = useCallback(async (postId: string) => {
    // Without this, rapid tap-spam fires multiple concurrent toggle_like RPCs
    // whose out-of-order responses can leave the wrong final state on screen.
    if (kudosInFlightRef.current.has(postId)) return;
    kudosInFlightRef.current.add(postId);

    const post =
      followingPosts.find(p => p.id === postId) ??
      discoverPosts.find(p  => p.id === postId);
    if (!post) { kudosInFlightRef.current.delete(postId); return; }

    const optimistic: FeedPost = {
      ...post,
      hasKudos:   !post.hasKudos,
      kudosCount: post.kudosCount + (post.hasKudos ? -1 : 1),
    };
    updateBothLists(postId, () => optimistic);

    try {
      const { liked, count } = await toggleLike(postId);
      updateBothLists(postId, p => ({ ...p, hasKudos: liked, kudosCount: count }));
    } catch {
      updateBothLists(postId, () => post);
    } finally {
      kudosInFlightRef.current.delete(postId);
    }
  }, [followingPosts, discoverPosts]);

  const toggleFollow = useCallback(async (targetId: string) => {
    if (!userId || targetId === userId) return;
    const wasFollowing = followingIds.includes(targetId);
    setFollowingIds(prev => wasFollowing ? prev.filter(id => id !== targetId) : [...prev, targetId]);
    try {
      await toggleFollowService(targetId);
    } catch {
      // Revert — toggleFollowService now throws on failure instead of silently
      // no-oping, so a failed request no longer leaves the UI desynced from the
      // server until the next full refresh.
      setFollowingIds(prev => wasFollowing ? [...prev, targetId] : prev.filter(id => id !== targetId));
    }
  }, [userId, followingIds]);

  const refresh = useCallback(async (tab: Tab) => {
    setRefreshing(true);
    const uid = userId;
    if (uid) {
      const [followIds, suggested] = await Promise.all([
        fetchFollowingIds(uid),
        fetchSuggestedRunners(uid),
      ]);
      setFollowingIds(followIds);
      setSuggestedRunners(suggested.filter(r => r.id !== uid));
    }
    await loadTab(tab, true);
    setRefreshing(false);
  }, [userId, loadTab]);

  const onCommentPosted = useCallback((postId: string) => {
    updateBothLists(postId, p => ({ ...p, commentCount: p.commentCount + 1 }));
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    const prevFollowing = followingPosts;
    const prevDiscover  = discoverPosts;
    setFollowingPosts(prev => prev.filter(p => p.id !== postId));
    setDiscoverPosts(prev => prev.filter(p => p.id !== postId));
    try {
      await deletePostService(postId);
    } catch {
      // Rare (RLS already prevents deleting anyone else's post) — restore rather
      // than leave the list silently missing a post that's still on the server.
      setFollowingPosts(prevFollowing);
      setDiscoverPosts(prevDiscover);
    }
  }, [followingPosts, discoverPosts]);

  return {
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
  };
}
