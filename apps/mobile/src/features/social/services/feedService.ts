import { supabase } from '@shared/services/supabase';
import type { FeedPost, SuggestedRunner, Comment } from '../types';

function mapRow(row: any): FeedPost {
  return {
    id:             row.id,
    userId:         row.user_id,
    username:       row.username ?? 'Runner',
    avatarUrl:      row.avatar_url ?? null,
    avatarColor:    row.avatar_color ?? '#888888',
    distanceM:      Math.round((row.distance_km ?? 0) * 1000),
    durationSec:    row.duration_sec ?? 0,
    avgPace:        row.avg_pace ?? '',
    activityType:   row.activity_type ?? 'run',
    routePoints:    row.route_points ?? [],
    kudosCount:     row.likes ?? 0,
    hasKudos:       row.has_liked ?? false,
    commentCount:   row.comment_count ?? 0,
    paceEarned:     row.pace_earned ?? 0,
    territoryTier:  row.territory_tier ?? null,
    territoryAreaM2:row.territory_area_m2 ?? null,
    runnerRank:     row.runner_rank ?? null,
    createdAt:      row.created_at,
  };
}

// supabase-js never throws on a DB/RPC error — it resolves { data: null, error }.
// Every function here used to discard `error` and fall back to an empty/default
// value, which made network or server failures indistinguishable from "no data" —
// callers (useFeed) then applied that empty fallback as truth (e.g. zeroing a
// post's kudos count on a transient failure). Throwing lets callers roll back an
// optimistic update or show an error state instead.

export async function fetchFeed(opts: {
  discover?: boolean;
  cursorTs?: string | null;
  lim?: number;
}): Promise<{ posts: FeedPost[]; nextCursor: string | null }> {
  const { data, error } = await supabase.rpc('get_feed', {
    lim:       opts.lim ?? 20,
    cursor_ts: opts.cursorTs ?? null,
    discover:  opts.discover ?? false,
  });
  if (error) throw error;
  const posts = (data ?? []).map(mapRow);
  const nextCursor = posts.length === (opts.lim ?? 20)
    ? posts[posts.length - 1].createdAt
    : null;
  return { posts, nextCursor };
}

export async function toggleLike(postId: string): Promise<{ liked: boolean; count: number }> {
  const { data, error } = await supabase.rpc('toggle_like', { p_post_id: postId });
  if (error) throw error;
  return (data ?? { liked: false, count: 0 }) as { liked: boolean; count: number };
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('followers')
    .select('following_id')
    .eq('follower_id', userId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.following_id as string);
}

export async function fetchSuggestedRunners(userId: string): Promise<SuggestedRunner[]> {
  const { data, error } = await supabase
    .from('profiles_public')
    .select('id, username, total_distance_km, territory_score')
    .neq('id', userId)
    .order('territory_score', { ascending: false })
    .limit(8);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id:              r.id,
    username:        r.username ?? 'Runner',
    totalDistanceKm: Number(r.total_distance_km ?? 0),
    territoryScore:  Math.round(Number(r.territory_score ?? 0)),
  }));
}

export async function toggleFollowService(targetId: string): Promise<void> {
  const { error } = await supabase.rpc('toggle_follow', { target_id: targetId });
  if (error) throw error;
}

export async function getComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase.rpc('get_comments', { p_post_id: postId });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id:          r.id,
    userId:      r.user_id,
    username:    r.username ?? 'Runner',
    avatarColor: r.avatar_color ?? '#888888',
    content:     r.content,
    createdAt:   r.created_at,
  }));
}

export async function addComment(postId: string, content: string): Promise<string> {
  const { data, error } = await supabase.rpc('add_comment', {
    p_post_id: postId,
    p_content: content.trim(),
  });
  if (error) throw error;
  return data as string;
}
