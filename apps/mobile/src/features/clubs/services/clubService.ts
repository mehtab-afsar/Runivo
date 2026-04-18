import { supabase } from '@shared/services/supabase';
import type { Club, ActivityItem, ClubMember, JoinRequest } from '@features/clubs/types';

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

export async function joinClub(clubId: string, userId: string): Promise<void> {
  await supabase
    .from('club_members')
    .upsert({ club_id: clubId, user_id: userId, role: 'member' }, { onConflict: 'club_id,user_id' });
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
  joinPolicy: 'open' | 'request' | 'invite',
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

  // Auto-join creator as admin
  await supabase.from('club_members').insert({
    club_id: data.id,
    user_id: userId,
    role: 'admin',
  });

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

interface ClubMemberRow {
  user_id: string;
  role: string;
  profiles: { username: string | null; level: number | null; total_distance_km: number | null } | null;
}

/** Fetch club members ranked by total_km descending. */
export async function fetchClubMembers(clubId: string): Promise<ClubMember[]> {
  const { data } = await supabase
    .from('club_members')
    .select('user_id, role, profiles(username, level, total_distance_km)')
    .eq('club_id', clubId);
  if (!data) return [];
  return (data as unknown as ClubMemberRow[])
    .map(m => ({
      id: m.user_id,
      username: m.profiles?.username ?? 'Runner',
      level: m.profiles?.level ?? 1,
      total_km: Math.round(Number(m.profiles?.total_distance_km ?? 0)),
      role: (m.role as 'admin' | 'member') ?? 'member',
    }))
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

interface JoinRequestRow {
  id: string;
  user_id: string;
  created_at: string;
  profiles: { username: string | null } | null;
}

/** Fetch pending join requests for a club (admin only). */
export async function fetchJoinRequests(clubId: string): Promise<JoinRequest[]> {
  const { data } = await supabase
    .from('club_join_requests')
    .select('id, user_id, created_at, profiles(username)')
    .eq('club_id', clubId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (!data) return [];
  return (data as unknown as JoinRequestRow[]).map(r => ({
    id: r.id,
    userId: r.user_id,
    username: r.profiles?.username ?? 'Runner',
    requestedAt: r.created_at,
  }));
}

/** Approve a join request. */
export async function approveJoinRequest(requestId: string, clubId: string, userId: string): Promise<void> {
  await supabase.from('club_join_requests').update({ status: 'approved' }).eq('id', requestId);
  await supabase.from('club_members').upsert({ club_id: clubId, user_id: userId, role: 'member' }, { onConflict: 'club_id,user_id' });
}

/** Reject a join request. */
export async function rejectJoinRequest(requestId: string): Promise<void> {
  await supabase.from('club_join_requests').update({ status: 'rejected' }).eq('id', requestId);
}

/** Update club description (admin/owner only). */
export async function updateClubDescription(clubId: string, description: string): Promise<void> {
  await supabase.from('clubs').update({ description: description.trim() }).eq('id', clubId);
}

/** Update club badge emoji (admin/owner only). */
export async function updateClubBadge(clubId: string, badgeEmoji: string): Promise<void> {
  await supabase.from('clubs').update({ badge_emoji: badgeEmoji }).eq('id', clubId);
}
