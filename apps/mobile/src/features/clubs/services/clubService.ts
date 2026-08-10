import { supabase } from '@shared/services/supabase';
import { fetchPublicProfiles } from '@mobile/shared/services/publicProfiles';
import type { Club, ActivityItem, ClubFeedActivityItem, ClubMember, JoinRequest } from '@features/clubs/types';

export async function fetchClubs(userId: string | null): Promise<Club[]> {
  const { data: clubsData } = await supabase
    .from('clubs')
    .select('id, name, description, badge_emoji, member_count, total_km, join_policy')
    .order('member_count', { ascending: false });

  if (!clubsData) return [];

  let joinedSet = new Set<string>();
  if (userId) {
    const { data: memberships } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', userId);
    joinedSet = new Set(memberships?.map((m) => m.club_id) ?? []);
  }

  return clubsData.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    badge_emoji: c.badge_emoji ?? '🏃',
    member_count: c.member_count ?? 0,
    total_km: Number(c.total_km ?? 0),
    join_policy: c.join_policy ?? 'open',
    joined: joinedSet.has(c.id),
  }));
}

export async function joinClub(clubId: string, userId: string): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('club_members')
    .upsert({ club_id: clubId, user_id: userId, role: 'member' }, { onConflict: 'club_id,user_id' });
  return { error };
}

/**
 * Request to join an invite-only club. Previously the UI showed "Request sent"
 * without ever inserting a row, so admins never saw any pending requests and
 * gated clubs were unjoinable through the app.
 */
export async function requestToJoinClub(clubId: string, userId: string): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from('club_join_requests')
    .insert({ club_id: clubId, user_id: userId, status: 'pending' });
  // A unique-constraint violation means a request already exists (pending, or a
  // past rejection) — treat that as an idempotent success rather than a failure;
  // an upsert-based reset would need club-admin UPDATE rights the requester
  // doesn't have under RLS.
  return { ok: !error || error.code === '23505' };
}

export async function leaveClub(clubId: string, userId: string): Promise<void> {
  await supabase
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', userId);
}

export async function createClub(
  userId: string,
  name: string,
  description: string,
  badgeEmoji: string,
  joinPolicy: 'open' | 'invite_only',
): Promise<Club | null> {
  const { data, error } = await supabase
    .from('clubs')
    .insert({
      name: name.trim(),
      description: description.trim() || null,
      badge_emoji: badgeEmoji,
      join_policy: joinPolicy,
      member_count: 1,
      total_km: 0,
      owner_id: userId,
    })
    .select('id, name, description, badge_emoji, member_count, total_km, join_policy')
    .single();

  if (error || !data) return null;

  // Auto-join creator as admin. This used to be fire-and-forget, which hid a
  // real failure: for invite_only clubs the club_members INSERT policy rejected
  // it, so the club existed with nobody in it and no admin — unusable and
  // unrecoverable. The owner-self-join policy (20260804000001) permits it now,
  // but check the error regardless: a club whose creator isn't a member is
  // worse than no club, so roll the club back rather than return a broken one.
  const { error: memberError } = await supabase.from('club_members').insert({
    club_id: data.id,
    user_id: userId,
    role: 'admin',
  });

  if (memberError) {
    await supabase.from('clubs').delete().eq('id', data.id);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    badge_emoji: data.badge_emoji ?? '🏃',
    member_count: data.member_count ?? 1,
    total_km: Number(data.total_km ?? 0),
    join_policy: data.join_policy ?? 'open',
    joined: true,
  };
}

/**
 * Get the club's chat lobby, creating one if this club doesn't have one yet.
 * ClubDetailScreen previously passed a fabricated `club_${clubId}` string to
 * useLobbyChat — lobby_messages.lobby_id is a UUID FK to lobbies(id), so that
 * value could never match anything; chat was entirely non-functional. Lobbies
 * are looked up (or lazily created) by club_id instead.
 */
export async function getOrCreateClubLobby(clubId: string, clubName: string, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('lobbies')
    .select('id')
    .eq('club_id', clubId)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('lobbies')
    .insert({ club_id: clubId, name: clubName, status: 'open', created_by: userId })
    .select('id')
    .single();
  if (error) {
    // Lost a race with another member creating it concurrently — read it back.
    const { data: retry } = await supabase.from('lobbies').select('id').eq('club_id', clubId).limit(1).maybeSingle();
    return retry?.id ?? null;
  }
  return created?.id ?? null;
}

/** Fetch club members ranked by total_km descending. */
export async function fetchClubMembers(clubId: string): Promise<ClubMember[]> {
  const { data } = await supabase
    .from('club_members')
    .select('user_id, role')
    .eq('club_id', clubId);
  if (!data) return [];

  const profiles = await fetchPublicProfiles(data.map(m => m.user_id as string));
  return data
    .map(m => {
      const p = profiles.get(m.user_id as string);
      return {
        id: m.user_id as string,
        username: p?.username ?? 'Runner',
        level: p?.level ?? 1,
        total_km: Math.round(Number(p?.total_distance_km ?? 0)),
        role: (m.role as 'admin' | 'member') ?? 'member',
      };
    })
    .sort((a, b) => b.total_km - a.total_km);
}

/** Fetch recent club activity from club_activity table (if exists). Falls back to empty. */
export async function fetchClubActivity(clubId: string): Promise<ActivityItem[]> {
  const { data } = await supabase
    .from('club_activity')
    .select('id, user_id, username, action, detail, created_at')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (!data) return [];
  return data.map(d => ({
    id: d.id,
    userId: d.user_id,
    username: d.username ?? 'Runner',
    action: d.action,
    detail: d.detail ?? '',
    time: d.created_at,
  }));
}

/**
 * Recent activity across every club the current user belongs to — powers the
 * "From your clubs" strip on the main Feed. No club_id filter is passed: the
 * `club_activity: members can read` RLS policy already scopes rows to clubs
 * the caller is a member of, so this one query is naturally "my clubs' activity".
 */
export async function fetchMyClubActivity(limit = 12): Promise<ClubFeedActivityItem[]> {
  const { data } = await supabase
    .from('club_activity')
    .select('id, club_id, user_id, username, action, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (!data || data.length === 0) return [];

  const clubIds = [...new Set(data.map(d => d.club_id as string))];
  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, name, badge_emoji, member_count, total_km')
    .in('id', clubIds);
  const clubMap = new Map((clubs ?? []).map(c => [c.id as string, c]));

  return data
    .map(d => {
      const club = clubMap.get(d.club_id as string);
      if (!club) return null;
      return {
        id:          d.id,
        clubId:      d.club_id,
        clubName:    club.name,
        badgeEmoji:  club.badge_emoji ?? '🏃',
        memberCount: club.member_count ?? 0,
        totalKm:     Number(club.total_km ?? 0),
        userId:      d.user_id,
        username:    d.username ?? 'Runner',
        action:      d.action,
        detail:      d.detail ?? '',
        time:        d.created_at,
      } as ClubFeedActivityItem;
    })
    .filter((item): item is ClubFeedActivityItem => item !== null);
}

/** Fetch pending join requests for a club (admin only). */
export async function fetchJoinRequests(clubId: string): Promise<JoinRequest[]> {
  const { data } = await supabase
    .from('club_join_requests')
    .select('id, user_id, created_at')
    .eq('club_id', clubId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (!data) return [];

  const profiles = await fetchPublicProfiles(data.map(r => r.user_id as string));
  return data.map(r => ({
    id: r.id as string,
    userId: r.user_id as string,
    username: profiles.get(r.user_id as string)?.username ?? 'Runner',
    requestedAt: r.created_at as string,
  }));
}

/**
 * Approve a join request via the accept_club_join_request SECURITY DEFINER RPC.
 * The previous direct update+upsert set status='approved' (the CHECK constraint
 * only allows 'accepted') and tried to insert the REQUESTER into club_members as
 * the calling admin — blocked by RLS (self-join only) — so approval appeared to
 * work (optimistic UI) but never actually added the member or bumped
 * member_count; the request just reappeared on next load.
 */
export async function approveJoinRequest(requestId: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.rpc('accept_club_join_request', { request_id: requestId });
  return { ok: !error };
}

/** Reject a join request. */
export async function rejectJoinRequest(requestId: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.from('club_join_requests').update({ status: 'rejected' }).eq('id', requestId);
  return { ok: !error };
}

/** Update club description (admin/owner only). */
export async function updateClubDescription(clubId: string, description: string): Promise<void> {
  await supabase.from('clubs').update({ description: description.trim() }).eq('id', clubId);
}

/** Update club badge emoji (admin/owner only). */
export async function updateClubBadge(clubId: string, badgeEmoji: string): Promise<void> {
  await supabase.from('clubs').update({ badge_emoji: badgeEmoji }).eq('id', clubId);
}
