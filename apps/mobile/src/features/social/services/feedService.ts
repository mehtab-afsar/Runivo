import { supabase } from '@shared/services/supabase';
import { signPhotoUrls } from '@features/run/services/activityEditService';
import { fetchPublicProfiles } from '@mobile/shared/services/publicProfiles';
import type { FeedPost, SuggestedRunner, Comment, PostLiker, FollowState } from '../types';

function mapRow(row: any): FeedPost {
  return {
    id:                 row.id,
    userId:             row.user_id,
    username:           row.username ?? 'Runner',
    avatarUrl:          row.avatar_url ?? null,
    avatarColor:        row.avatar_color ?? '#888888',
    distanceM:          Math.round((row.distance_km ?? 0) * 1000),
    durationSec:        row.duration_sec ?? 0,
    avgPace:            row.avg_pace ?? '',
    activityType:       row.activity_type ?? 'run',
    routePoints:        row.route_points ?? [],
    kudosCount:         row.likes ?? 0,
    hasKudos:           row.has_liked ?? false,
    commentCount:       row.comment_count ?? 0,
    paceEarned:         row.pace_earned ?? 0,
    territoryTier:      row.territory_tier ?? null,
    territoryAreaM2:    row.territory_area_m2 ?? null,
    runnerRank:         row.runner_rank ?? null,
    postType:           row.post_type ?? 'run',
    stolenFromUsername: row.stolen_from_username ?? null,
    stolenAreaM2:       row.stolen_area_m2 ?? null,
    zoneTier:           row.zone_tier ?? null,
    stolenFromUserId:   row.stolen_from_user_id ?? null,
    createdAt:          row.created_at,
    title:              row.title ?? null,
    description:        row.content ?? null,
    visibility:         row.visibility ?? 'everyone',
    // Storage paths here; withSignedPhotos swaps them for signed links.
    photos:             (row.photo_paths as string[] | null) ?? [],
  };
}

/** Swap photo paths for signed links in one request; a photo that can't be signed is dropped. */
async function withSignedPhotos(posts: FeedPost[]): Promise<FeedPost[]> {
  const paths = posts.flatMap(p => p.photos ?? []);
  if (!paths.length) return posts;
  const signed = await signPhotoUrls(paths).catch(() => new Map<string, string>());
  return posts.map(p => (p.photos?.length
    ? { ...p, photos: p.photos.flatMap(path => (signed.has(path) ? [signed.get(path)!] : [])) }
    : p));
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
  const posts = await withSignedPhotos(await withCompanions((data ?? []).map(mapRow)).catch(() => (data ?? []).map(mapRow)));
  const nextCursor = posts.length === (opts.lim ?? 20)
    ? posts[posts.length - 1].createdAt
    : null;
  return { posts, nextCursor };
}

/** "Your feed": every post of your own, newest first (get_my_feed). */
export async function fetchMyFeed(cursorTs?: string | null, lim = 20): Promise<{ posts: FeedPost[]; nextCursor: string | null }> {
  const { data, error } = await supabase.rpc('get_my_feed', { lim, cursor_ts: cursorTs ?? null });
  if (error) throw error;
  const posts = await withSignedPhotos(await withCompanions((data ?? []).map(mapRow)).catch(() => (data ?? []).map(mapRow)));
  return { posts, nextCursor: posts.length === lim ? posts[posts.length - 1].createdAt : null };
}

/** C3: a club's members' activities. */
export async function fetchClubFeed(clubId: string, cursorTs?: string | null): Promise<FeedPost[]> {
  const { data, error } = await supabase.rpc('get_club_feed', { p_club: clubId, lim: 20, cursor_ts: cursorTs ?? null });
  if (error) throw error;
  return withSignedPhotos(await withCompanions((data ?? []).map(mapRow)));
}

/** F5: "with Sam and 1 other" — runners who started within 100 m and 5 min. */
export async function withCompanions(posts: FeedPost[]): Promise<FeedPost[]> {
  if (posts.length === 0) return posts;
  const { data } = await supabase.rpc('get_post_companions', { p_post_ids: posts.map(p => p.id) });
  const by = new Map<string, { userId: string; username: string }[]>();
  for (const r of (data as { post_id: string; user_id: string; username: string }[] | null) ?? []) {
    const arr = by.get(r.post_id) ?? [];
    arr.push({ userId: r.user_id, username: r.username });
    by.set(r.post_id, arr);
  }
  return posts.map(p => (by.has(p.id) ? { ...p, companions: by.get(p.id) } : p));
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
  // O3: runners near you first; the global top list only when there's no one nearby.
  const near = await supabase.rpc('suggest_runners_nearby', { lim: 5 });
  if (!near.error && (near.data as unknown[] | null)?.length) {
    return (near.data as any[]).map(r => ({
      id: r.id, username: r.username ?? 'Runner', avatarUrl: r.avatar_url ?? null, avatarColor: r.avatar_color ?? '#888888',
      totalDistanceKm: Number(r.total_distance_km ?? 0), territoryScore: Math.round(Number(r.territory_score ?? 0)),
      distanceKm: r.distance_km == null ? undefined : Number(r.distance_km),
    }));
  }
  const { data, error } = await supabase
    .from('profiles_public')
    .select('id, username, avatar_url, avatar_color, total_distance_km, territory_score')
    .neq('id', userId)
    .order('territory_score', { ascending: false })
    .limit(8);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id:              r.id,
    username:        r.username ?? 'Runner',
    avatarUrl:       r.avatar_url ?? null,
    avatarColor:     r.avatar_color ?? '#888888',
    totalDistanceKm: Number(r.total_distance_km ?? 0),
    territoryScore:  Math.round(Number(r.territory_score ?? 0)),
  }));
}

/**
 * Follow or unfollow. A runner whose profile isn't public gets a request they
 * accept or decline (set_follow, 20261123000004); the result says which.
 */
export async function setFollow(targetId: string, follow: boolean): Promise<FollowState> {
  const { data, error } = await supabase.rpc('set_follow', { p_target: targetId, p_follow: follow });
  if (error) throw error;
  return (data as FollowState | null) ?? 'none';
}

/** Kept for callers that only know "flip it": unfollows when following or asked, else follows. */
export async function toggleFollowService(targetId: string, current: FollowState = 'none'): Promise<FollowState> {
  return setFollow(targetId, current === 'none');
}

/** My relation to a runner: following, a pending request, or none. */
export async function fetchFollowState(meId: string, targetId: string): Promise<FollowState> {
  const [f, r] = await Promise.all([
    supabase.from('followers').select('follower_id').eq('follower_id', meId).eq('following_id', targetId).maybeSingle(),
    supabase.from('follow_requests').select('follower_id').eq('follower_id', meId).eq('following_id', targetId).maybeSingle(),
  ]);
  return f.data ? 'following' : r.data ? 'requested' : 'none';
}

/** Whether this runner has asked to follow me. */
export async function hasFollowRequestFrom(meId: string, followerId: string): Promise<boolean> {
  const { data } = await supabase.from('follow_requests').select('follower_id')
    .eq('follower_id', followerId).eq('following_id', meId).maybeSingle();
  return !!data;
}

export async function respondFollowRequest(followerId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_follow_request', { p_follower: followerId, p_accept: accept });
  if (error) throw error;
}

/** Stop someone following me (they are not told). */
export async function removeFollower(followerId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_follower', { p_follower: followerId });
  if (error) throw error;
}

/** Runners whose username starts with `query` (2+ characters), on the server. */
export async function searchRunners(query: string): Promise<SuggestedRunner[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.rpc('search_runners', { q, lim: 20 });
  if (error) throw error;
  return ((data ?? []) as any[]).map(r => ({
    id:              r.id,
    username:        r.username ?? 'Runner',
    avatarUrl:       r.avatar_url ?? null,
    avatarColor:     r.avatar_color ?? '#888888',
    totalDistanceKm: Number(r.total_distance_km ?? 0),
    territoryScore:  Math.round(Number(r.territory_score ?? 0)),
  }));
}

export async function getComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase.rpc('get_comments', { p_post_id: postId });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  // get_comments has no photo column; the public profiles carry it.
  const profiles = await fetchPublicProfiles(rows.map(r => r.user_id as string)).catch(() => new Map());
  return rows.map((r: any) => ({
    id:          r.id,
    userId:      r.user_id,
    username:    r.username ?? 'Runner',
    avatarColor: r.avatar_color ?? '#888888',
    avatarUrl:   r.avatar_url ?? profiles.get(r.user_id)?.avatar_url ?? null,
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

// RLS ("feed_posts: owner can delete") already scopes this to auth.uid() —
// this can't delete anyone else's post regardless of what postId is passed.
export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('feed_posts').delete().eq('id', postId);
  if (error) throw error;
}

export async function reportPost(postId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('report_post', { p_post_id: postId, p_reason: reason });
  if (error) throw error;
}

export async function fetchPostLikers(postId: string, lim = 3): Promise<PostLiker[]> {
  const { data, error } = await supabase.rpc('get_post_likers', { p_post_id: postId, lim });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id:          r.id,
    username:    r.username ?? 'Runner',
    avatarUrl:   r.avatar_url ?? null,
    avatarColor: r.avatar_color ?? '#888888',
  }));
}

/**
 * The zone a steal post is about, ready to run to (Defend). Null when the
 * zone can't be found (deleted, or an old post without a link).
 */
export async function fetchStolenZone(postId: string): Promise<{ id: string; ring: [number, number][]; ownerName: string | null } | null> {
  const { data: post } = await supabase.from('feed_posts').select('stolen_territory_id').eq('id', postId).maybeSingle();
  const zoneId = post?.stolen_territory_id as string | null | undefined;
  if (!zoneId) return null;
  const { data: z } = await supabase.from('territory_polygons').select('id, polygon_coords, owner_name').eq('id', zoneId).maybeSingle();
  const ring = (z?.polygon_coords as [number, number][] | null) ?? [];
  return z && ring.length >= 4 ? { id: z.id as string, ring, ownerName: (z.owner_name as string | null) ?? null } : null;
}
