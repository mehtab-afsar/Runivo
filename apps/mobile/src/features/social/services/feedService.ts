import { supabase } from '@shared/services/supabase';
import type { FeedPost, SuggestedRunner } from '@features/social/types';

export async function fetchFeed(): Promise<FeedPost[]> {
  const { data, error } = await supabase.rpc('get_feed', {
    lim: 40,
    off_set: 0,
  });
  if (error) throw error;
  return (data ?? []) as FeedPost[];
}

export async function toggleKudos(
  postId: string,
  userId: string,
  hasKudos: boolean,
): Promise<void> {
  if (hasKudos) {
    await supabase.from('feed_post_likes').delete().eq('post_id', postId).eq('user_id', userId);
  } else {
    await supabase.from('feed_post_likes').insert({ post_id: postId, user_id: userId });
  }
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('followers')
    .select('following_id')
    .eq('follower_id', userId);
  return (data ?? []).map((r: { following_id: string }) => r.following_id);
}

export async function fetchSuggestedRunners(userId: string): Promise<SuggestedRunner[]> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, level, total_distance_km, total_territories_claimed')
      .neq('id', userId)
      .order('total_distance_km', { ascending: false })
      .limit(12);
    return (data ?? []).map((r: {
      id: string;
      username: string | null;
      level: number | null;
      total_distance_km: number | null;
      total_territories_claimed: number | null;
    }): SuggestedRunner => ({
      id: r.id,
      username: r.username ?? 'Runner',
      level: r.level ?? 1,
      totalDistanceKm: Math.round(r.total_distance_km ?? 0),
      territoriesClaimed: r.total_territories_claimed ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function toggleFollow(targetId: string): Promise<void> {
  try {
    await supabase.rpc('toggle_follow', { target_id: targetId });
  } catch { /* ignore */ }
}
