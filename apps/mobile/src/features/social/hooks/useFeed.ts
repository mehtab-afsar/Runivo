import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@shared/services/supabase';
import {
  fetchFeed,
  toggleKudos as toggleKudosService,
  fetchFollowingIds,
  fetchSuggestedRunners,
  toggleFollow as toggleFollowService,
} from '@features/social/services/feedService';
import type { FeedPost, SuggestedRunner } from '@features/social/types';

export function useFeed() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [suggestedRunners, setSuggestedRunners] = useState<SuggestedRunner[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async (uid: string) => {
    try {
      const [feedData, followIds, suggested] = await Promise.all([
        fetchFeed(uid),
        fetchFollowingIds(uid),
        fetchSuggestedRunners(uid),
      ]);
      setPosts(feedData);
      setFollowingIds(followIds);
      setSuggestedRunners(suggested.filter(r => !followIds.includes(r.id)));
    } catch { /* offline */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user.id ?? null;
      setUserId(uid);
      if (uid) load(uid);
      else { setLoading(false); }
    });
  }, [load]);

  const toggleKudos = useCallback(async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post || !userId) return;

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, hasKudos: !p.hasKudos, kudosCount: p.kudosCount + (p.hasKudos ? -1 : 1) }
          : p,
      ),
    );

    try {
      await toggleKudosService(postId, userId, post.hasKudos);
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, hasKudos: post.hasKudos, kudosCount: post.kudosCount }
            : p,
        ),
      );
    }
  }, [posts, userId]);

  const toggleFollow = useCallback(async (targetId: string) => {
    setFollowingIds(prev =>
      prev.includes(targetId) ? prev.filter(id => id !== targetId) : [...prev, targetId],
    );
    await toggleFollowService(targetId);
  }, []);

  const refresh = useCallback(() => {
    if (!userId) return;
    setRefreshing(true);
    load(userId);
  }, [userId, load]);

  return { posts, loading, refreshing, followingIds, suggestedRunners, toggleKudos, toggleFollow, refresh };
}
