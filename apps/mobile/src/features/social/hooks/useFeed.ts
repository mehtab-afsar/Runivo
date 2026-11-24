import { muteUser as muteUserService, blockUser as blockUserService } from '@mobile/shared/services/safetyService';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@shared/services/supabase';
import {
  fetchFeed,
  toggleLike,
  fetchFollowingIds,
  fetchSuggestedRunners,
  setFollow,
  deletePost as deletePostService,
} from '@features/social/services/feedService';
import { fetchMyClubActivity } from '@features/clubs/services/clubService';
import type { FeedPost, SuggestedRunner } from '@features/social/types';
import type { ClubFeedActivityItem } from '@features/clubs/types';

/** Pages can overlap when new posts land between fetches; keep the first copy. */
function uniqById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter(i => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

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
  /** The last first-page load / refresh failed (offline or server). Not set by paging. */
  const [loadError, setLoadError] = useState(false);

  const loadingMoreRef = useRef(false);
  const kudosInFlightRef = useRef(new Set<string>());
  const followInFlightRef = useRef(new Set<string>());

  const loadTab = useCallback(async (tab: Tab, refresh = false) => {
    const isDiscover = tab === 'discover';
    const cursorTs   = refresh ? null : (isDiscover ? discoverCursor : followingCursor);
    const hasMore    = isDiscover ? discoverHasMore : followingHasMore;

    if (!refresh && !hasMore) return;
    if (refresh) setLoadError(false);

    try {
      const { posts, nextCursor } = await fetchFeed({
        discover: isDiscover,
        cursorTs,
        lim: 20,
      });

      if (isDiscover) {
        setDiscoverPosts(prev => uniqById(refresh ? posts : [...prev, ...posts]));
        setDiscoverCursor(nextCursor);
        setDiscoverHasMore(nextCursor !== null);
      } else {
        setFollowingPosts(prev => uniqById(refresh ? posts : [...prev, ...posts]));
        setFollowingCursor(nextCursor);
        setFollowingHasMore(nextCursor !== null);
      }
    } catch {
      // A failed first page / refresh must not look like an empty feed. A failed
      // next page just stops paging until the user scrolls again.
      if (refresh) setLoadError(true);
    }
  }, [discoverCursor, followingCursor, discoverHasMore, followingHasMore]);

  const initLoad = useCallback(async (uid: string) => {
    try {
      // Side data (who I follow, suggestions, club activity) must never block the feed:
      // each falls back to empty so the posts still load.
      const [followIds, suggested, myClubActivity] = await Promise.all([
        fetchFollowingIds(uid).catch(() => [] as string[]),
        fetchSuggestedRunners(uid).catch(() => [] as SuggestedRunner[]),
        fetchMyClubActivity().catch(() => [] as ClubFeedActivityItem[]),
      ]);
      setFollowingIds(followIds);
      setSuggestedRunners(uniqById(suggested.filter(r => r.id !== uid)));
      setClubActivity(myClubActivity);

      await loadTab('following', true);
    } finally {
      setLoading(false);
    }
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
    try { await loadTab(tab); } finally { loadingMoreRef.current = false; }
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
      // Kudos failed: restore the post as it was (optimistic rollback).
      updateBothLists(postId, () => post);
    } finally {
      kudosInFlightRef.current.delete(postId);
    }
  }, [followingPosts, discoverPosts]);

  const toggleFollow = useCallback(async (targetId: string) => {
    if (!userId || targetId === userId) return;
    // A double-tap would send two toggles and end up back where it started.
    if (followInFlightRef.current.has(targetId)) return;
    followInFlightRef.current.add(targetId);
    const wasFollowing = followingIds.includes(targetId);
    setFollowingIds(prev => wasFollowing ? prev.filter(id => id !== targetId) : [...prev, targetId]);
    try {
      const state = await setFollow(targetId, !wasFollowing);
      if (state === 'requested') {
        // Their profile isn't public: they accept or decline first.
        setFollowingIds(prev => prev.filter(id => id !== targetId));
        appAlert('Request sent', "They'll see your request. You can see their activities once they accept.");
      }
    } catch {
      // Revert — toggleFollowService now throws on failure instead of silently
      // no-oping, so a failed request no longer leaves the UI desynced from the
      // server until the next full refresh.
      setFollowingIds(prev => wasFollowing ? [...prev, targetId] : prev.filter(id => id !== targetId));
    } finally {
      followInFlightRef.current.delete(targetId);
    }
  }, [userId, followingIds]);

  const refresh = useCallback(async (tab: Tab) => {
    setRefreshing(true);
    try {
      const uid = userId;
      if (uid) {
        const [followIds, suggested] = await Promise.all([
          fetchFollowingIds(uid).catch(() => null),
          fetchSuggestedRunners(uid).catch(() => null),
        ]);
        if (followIds) setFollowingIds(followIds);
        if (suggested) setSuggestedRunners(uniqById(suggested.filter(r => r.id !== uid)));
      }
      await loadTab(tab, true);
    } finally {
      setRefreshing(false);
    }
  }, [userId, loadTab]);

  const onCommentPosted = useCallback((postId: string) => {
    updateBothLists(postId, p => ({ ...p, commentCount: p.commentCount + 1 }));
  }, []);

  // Mute: their posts leave both lists now; the server keeps them out from here on.
  const muteAuthor = useCallback(async (authorId: string) => {
    const prevFollowing = followingPosts;
    const prevDiscover  = discoverPosts;
    setFollowingPosts(prev => prev.filter(p => p.userId !== authorId));
    setDiscoverPosts(prev => prev.filter(p => p.userId !== authorId));
    try {
      await muteUserService(authorId);
    } catch {
      // Mute failed: restore both feeds (optimistic rollback).
      setFollowingPosts(prevFollowing);
      setDiscoverPosts(prevDiscover);
    }
  }, [followingPosts, discoverPosts]);

  // Block: their posts leave both lists now; the server hides everything both ways.
  const blockAuthor = useCallback(async (authorId: string) => {
    const prevFollowing = followingPosts;
    const prevDiscover  = discoverPosts;
    setFollowingPosts(prev => prev.filter(p => p.userId !== authorId));
    setDiscoverPosts(prev => prev.filter(p => p.userId !== authorId));
    setFollowingIds(prev => prev.filter(id => id !== authorId));
    try {
      await blockUserService(authorId);
    } catch {
      setFollowingPosts(prevFollowing);
      setDiscoverPosts(prevDiscover);
      appAlert("Couldn't block", 'Check your connection and try again.');
    }
  }, [followingPosts, discoverPosts]);

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
  };
}
