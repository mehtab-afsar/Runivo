import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@shared/services/supabase';
import {
  fetchFeed,
  toggleLike,
  fetchFollowingIds,
  fetchSuggestedRunners,
  toggleFollowService,
} from '@features/social/services/feedService';
import type { FeedPost, SuggestedRunner } from '@features/social/types';

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
  const [userId, setUserId] = useState<string | null>(null);

  const loadingMoreRef = useRef(false);

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
    const [followIds, suggested] = await Promise.all([
      fetchFollowingIds(uid),
      fetchSuggestedRunners(uid),
    ]);
    setFollowingIds(followIds);
    setSuggestedRunners(suggested.filter(r => r.id !== uid));

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
    const post =
      followingPosts.find(p => p.id === postId) ??
      discoverPosts.find(p  => p.id === postId);
    if (!post) return;

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
    }
  }, [followingPosts, discoverPosts]);

  const toggleFollow = useCallback(async (targetId: string) => {
    if (!userId || targetId === userId) return;
    setFollowingIds(prev =>
      prev.includes(targetId) ? prev.filter(id => id !== targetId) : [...prev, targetId],
    );
    await toggleFollowService(targetId);
  }, [userId]);

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

  return {
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
  };
}
