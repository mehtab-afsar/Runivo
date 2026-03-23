import { supabase } from '@shared/services/supabase';
import type { FeedPost } from '@features/social/types';

export async function fetchFeed(userId: string): Promise<FeedPost[]> {
  const { data, error } = await supabase.rpc('get_feed', {
    p_limit: 40,
    p_offset: 0,
    p_user_id: userId,
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
    await supabase.from('kudos').delete().eq('post_id', postId).eq('user_id', userId);
  } else {
    await supabase.from('kudos').insert({ post_id: postId, user_id: userId });
  }
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  return (data ?? []).map((r: { following_id: string }) => r.following_id);
}
