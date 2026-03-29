import { supabase } from '@shared/services/supabase';
import type { Club } from '@features/clubs/types';

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
      created_by: userId,
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
