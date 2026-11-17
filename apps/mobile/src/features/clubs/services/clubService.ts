import { positionIfAllowed } from '@mobile/shared/location/devicePosition';
import { supabase } from '@shared/services/supabase';
import { readCleanImage } from '@mobile/shared/lib/cleanImageUpload';
import { fetchPublicProfiles } from '@mobile/shared/services/publicProfiles';
import type { Club, NearbyClubs, ActivityItem, ClubFeedActivityItem, ClubMember, JoinRequest } from '@features/clubs/types';

export async function fetchClubs(userId: string | null): Promise<Club[]> {
  const { data: clubsData } = await supabase
    .from('clubs')
    .select('id, name, description, badge_emoji, member_count, total_km, join_policy, avatar_url, banner_url')
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
    avatar_url: c.avatar_url ?? null,
    banner_url: c.banner_url ?? null,
  }));
}

/** A club's picture and cover URLs. */
export async function fetchClubMedia(clubId: string): Promise<{ avatar: string | null; banner: string | null }> {
  const { data } = await supabase.from('clubs').select('avatar_url, banner_url').eq('id', clubId).maybeSingle();
  return { avatar: (data?.avatar_url as string | null) ?? null, banner: (data?.banner_url as string | null) ?? null };
}

/**
 * Upload a club's picture or cover (owner/admin only, enforced by storage
 * rules) and save its URL on the club. Location data is stripped first. The
 * URL carries a version so a replaced picture isn't served from cache.
 */
export async function uploadClubImage(clubId: string, kind: 'avatar' | 'banner', uri: string): Promise<string> {
  const img = await readCleanImage(uri);
  const path = `${clubId}/${kind}.${img.ext}`;
  const { error } = await supabase.storage.from('club-media').upload(path, img.body, { upsert: true, contentType: img.contentType });
  if (error) throw new Error("Couldn't upload the picture. Try again.");
  const url = `${supabase.storage.from('club-media').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
  const { error: saveErr } = await supabase.from('clubs').update({ [`${kind}_url`]: url }).eq('id', clubId);
  if (saveErr) throw new Error("Couldn't save the picture. Try again.");
  return url;
}

/**
 * The device's last known position, only if location is already allowed.
 * Never prompts: asking is onboarding's and run setup's job.
 */
export async function lastKnownPositionIfAllowed(): Promise<{ lat: number; lng: number } | null> {
  return positionIfAllowed();
}

/**
 * Closest clubs (server-side, rounded distances, no coordinates), or the most
 * popular clubs when there's no position or nothing within the radius.
 */
export async function fetchClubsNear(
  position: { lat: number; lng: number } | null,
  limit = 20,
): Promise<NearbyClubs> {
  const { data, error } = await supabase.rpc('clubs_near', {
    p_lat: position?.lat ?? null,
    p_lng: position?.lng ?? null,
    p_radius_km: 15,
    p_limit: limit,
  });
  if (error || !Array.isArray(data)) return { clubs: [], nearby: false };
  const rows = data as {
    id: string; name: string; description: string | null; badge_emoji: string | null; join_policy: string | null;
    member_count: number | null; total_km: number | string | null; city: string | null;
    distance_km: number | string | null; nearby: boolean; joined: boolean;
  }[];
  return {
    nearby: rows.length > 0 && rows.every(r => r.nearby),
    clubs: rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      badge_emoji: r.badge_emoji ?? '🏃',
      member_count: r.member_count ?? 0,
      total_km: Number(r.total_km ?? 0),
      join_policy: r.join_policy ?? 'open',
      joined: !!r.joined,
      distance_km: r.distance_km == null ? null : Number(r.distance_km),
      city: r.city,
    })),
  };
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

/**
 * Leave a club (server: leave_club). The owner can't leave their own club,
 * so they get 'owner' back: transfer isn't built, they delete it instead.
 */
export async function leaveClub(clubId: string, _userId?: string): Promise<{ error: unknown; result?: 'left' | 'owner' | 'not_member' }> {
  const { data, error } = await supabase.rpc('leave_club', { p_club_id: clubId });
  if (error) return { error };
  const result = data as 'left' | 'owner' | 'not_member';
  return { error: result === 'owner' ? new Error('owner') : null, result };
}

/** Owner only (server: delete_club). Upcoming club runs and the chat go with it; members are told. */
export async function deleteClub(clubId: string): Promise<'deleted' | 'not_owner' | 'not_found'> {
  const { data, error } = await supabase.rpc('delete_club', { p_club_id: clubId });
  if (error) throw error;
  return data as 'deleted' | 'not_owner' | 'not_found';
}

export async function createClub(
  userId: string,
  name: string,
  description: string,
  badgeEmoji: string,
  joinPolicy: 'open' | 'invite_only',
): Promise<Club> {
  const { data, error } = await supabase
    .from('clubs')
    .insert({
      name: name.trim(),
      description: description.trim() || null,
      badge_emoji: badgeEmoji,
      join_policy: joinPolicy,
      // The server starts every club at 0; the creator's member row makes it 1.
      total_km: 0,
      owner_id: userId,
    })
    .select('id, name, description, badge_emoji, member_count, total_km, join_policy')
    .single();

  if (error || !data) throw new Error(clubCreateMessage(error));

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
    throw new Error(clubCreateMessage(memberError));
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

/** What to tell the runner when creating a club fails (the reason, not a generic line). */
function clubCreateMessage(err: { code?: string; message?: string } | null): string {
  if (!err) return 'Could not create the club. Please try again.';
  if (err.code === '23505') return 'A club with that name already exists. Try another name.';
  if (err.code === '42501') return "Your account isn't allowed to create clubs right now.";
  if (err.code === 'PGRST202' || err.code === '42883' || err.code === '42703') return 'The server needs an update before clubs can be created (run the database push).';
  return `Could not create the club: ${err.message ?? 'unknown error'}`;
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

// ── Moderation (20261113000001) ─────────────────────────────────────────────
export type ChatReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';

export interface ChatReport {
  messageId: string;
  content: string;
  authorId: string;
  authorUsername: string;
  reports: number;
  reasons: string[];
  lastReported: string;
}

export async function reportClubMessage(messageId: string, reason: ChatReportReason): Promise<void> {
  const { error } = await supabase.rpc('report_club_message', { p_message_id: messageId, p_reason: reason });
  if (error) throw new Error(error.message);
}

/** Author, or a club owner/admin. */
export async function deleteClubMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_club_message', { p_message_id: messageId });
  if (error) throw new Error(error.message);
}

/** Removes the member and bars them from rejoining. */
export async function removeClubMember(clubId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_club_member', { p_club_id: clubId, p_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function fetchClubReports(clubId: string): Promise<ChatReport[]> {
  const { data, error } = await supabase.rpc('get_club_reports', { p_club_id: clubId });
  if (error) throw new Error(error.message);
  type Row = { message_id: string; content: string; author_id: string; author_username: string | null; reports: number | string; reasons: string[] | null; last_reported: string };
  return ((data ?? []) as Row[]).map(r => ({
    messageId: r.message_id, content: r.content, authorId: r.author_id, authorUsername: r.author_username ?? 'Runner',
    reports: Number(r.reports), reasons: r.reasons ?? [], lastReported: r.last_reported,
  }));
}

export async function fetchClubOwnerId(clubId: string): Promise<string | null> {
  const { data } = await supabase.from('clubs').select('owner_id').eq('id', clubId).maybeSingle();
  return (data?.owner_id as string | null) ?? null;
}

// ── Club runs (C1) and club territory (C2), 20261113000008 ─────────────────
export interface ClubRun { id: string; title: string; description: string | null; startsAt: string; location: string | null; distanceM: number | null; going: number; isGoing: boolean; route: { lat: number; lng: number }[] | null }

export async function fetchClubRuns(clubId: string): Promise<ClubRun[]> {
  const { data, error } = await supabase.rpc('get_club_events', { p_club_id: clubId });
  if (error) throw new Error(error.message);
  type Row = { id: string; title: string; description: string | null; starts_at: string; location_name: string | null; distance_m: number | null; participant_count: number; going: boolean; route_points: { lat: number; lng: number }[] | null };
  return ((data ?? []) as Row[]).map(r => ({ id: r.id, title: r.title, description: r.description, startsAt: r.starts_at, location: r.location_name, distanceM: r.distance_m, going: r.participant_count, isGoing: r.going, route: r.route_points && r.route_points.length >= 2 ? r.route_points : null }));
}

/** At most 1,500 evenly spaced points (the server's limit), lat/lng only. */
function thinRoute(pts: { lat: number; lng: number }[]): { lat: number; lng: number }[] {
  const step = Math.max(1, Math.ceil(pts.length / 1500));
  const out = pts.filter((_, i) => i % step === 0).map(p => ({ lat: p.lat, lng: p.lng }));
  const last = pts[pts.length - 1];
  if (last && out[out.length - 1] !== last) out.push({ lat: last.lat, lng: last.lng });
  return out.slice(0, 1500);
}

export async function scheduleClubRun(clubId: string, run: { title: string; startsAt: Date; location: string; distanceKm?: number | null; description?: string; weeks: number; route?: { lat: number; lng: number }[] | null }): Promise<number> {
  const { data, error } = await supabase.rpc('create_club_event', {
    p_club_id: clubId, p_title: run.title, p_starts_at: run.startsAt.toISOString(), p_location: run.location,
    p_distance_m: run.distanceKm ? Math.round(run.distanceKm * 1000) : null, p_description: run.description ?? null, p_weeks: run.weeks,
    p_route: run.route && run.route.length >= 2 ? thinRoute(run.route) : null,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export interface ClubZone { id: string; ownerId: string; ownerName: string; ring: [number, number][]; areaM2: number; freshness: number }

export async function fetchClubTerritory(clubId: string): Promise<ClubZone[]> {
  const { data, error } = await supabase.rpc('get_club_territory', { p_club_id: clubId });
  if (error) throw new Error(error.message);
  type Row = { id: string; owner_id: string; owner_name: string | null; polygon_coords: [number, number][] | null; area_m2: number; freshness: number };
  return ((data ?? []) as Row[]).filter(r => (r.polygon_coords?.length ?? 0) >= 4)
    .map(r => ({ id: r.id, ownerId: r.owner_id, ownerName: r.owner_name ?? 'Runner', ring: r.polygon_coords!, areaM2: r.area_m2, freshness: r.freshness }));
}

export async function fetchClubTerritoryRank(clubId: string): Promise<{ rank: number; of: number } | null> {
  const { data, error } = await supabase.rpc('get_club_territory_board', { p_limit: 200 });
  if (error) return null;
  const rows = (data ?? []) as { club_id: string; rank: number }[];
  const me = rows.find(r => r.club_id === clubId);
  return me ? { rank: me.rank, of: rows.length } : null;
}

/** This week's club war (Mon–Sun UTC) for a club you're in; null when there's no rival yet. */
export interface ClubWar {
  clubName: string; rivalId: string; rivalName: string;
  clubAreaM2: number; rivalAreaM2: number;
  myAreaM2: number; myRank: number | null; membersScoring: number;
  endsAt: string;
}
export async function fetchClubWar(clubId: string): Promise<ClubWar | null> {
  const { data, error } = await supabase.rpc('club_war', { p_club_id: clubId });
  if (error) throw error;
  const r = (data as Record<string, unknown>[] | null)?.[0];
  if (!r) return null;
  return {
    clubName: String(r.club_name ?? ''), rivalId: String(r.rival_id), rivalName: String(r.rival_name ?? ''),
    clubAreaM2: Number(r.club_area_m2) || 0, rivalAreaM2: Number(r.rival_area_m2) || 0,
    myAreaM2: Number(r.my_area_m2) || 0, myRank: r.my_rank == null ? null : Number(r.my_rank),
    membersScoring: Number(r.members_scoring) || 0, endsAt: String(r.ends_at),
  };
}
