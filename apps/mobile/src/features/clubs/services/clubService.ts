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
