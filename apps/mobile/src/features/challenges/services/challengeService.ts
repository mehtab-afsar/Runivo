/** C4: group challenges between 2 and 20 runners you follow. */
import { supabase } from '@shared/services/supabase';

export type ChallengeMetric = 'distance_km' | 'zones' | 'active_days';
export interface Challenge {
  id: string; title: string; metric: ChallengeMetric; target: number;
  startsAt: string; endsAt: string; creatorName: string; myStatus: 'invited' | 'joined'; people: number;
}
export interface ChallengeEntry { userId: string; username: string; avatarColor: string | null; status: string; progress: number }

export const METRIC_LABEL: Record<ChallengeMetric, { name: string; unit: string }> = {
  distance_km: { name: 'Distance', unit: 'km' },
  zones:       { name: 'Zones claimed', unit: 'zones' },
  active_days: { name: 'Days active', unit: 'days' },
};

export async function fetchMyChallenges(): Promise<Challenge[]> {
  const { data, error } = await supabase.rpc('my_group_challenges');
  if (error) throw error;
  return ((data as any[]) ?? []).map(r => ({
    id: r.id, title: r.title, metric: r.metric, target: Number(r.target), startsAt: r.starts_at, endsAt: r.ends_at,
    creatorName: r.creator_name ?? 'Runner', myStatus: r.my_status, people: r.people ?? 0,
  }));
}

export async function fetchChallengeProgress(id: string): Promise<ChallengeEntry[]> {
  const { data, error } = await supabase.rpc('group_challenge_progress', { p_challenge: id });
  if (error) throw error;
  return ((data as any[]) ?? []).map(r => ({ userId: r.user_id, username: r.username, avatarColor: r.avatar_color, status: r.status, progress: Number(r.progress ?? 0) }));
}

export async function createChallenge(input: { title: string; metric: ChallengeMetric; target: number; days: number; invitees: string[] }): Promise<string> {
  const ends = new Date(Date.now() + input.days * 86_400_000);
  const { data, error } = await supabase.rpc('create_group_challenge', {
    p_title: input.title, p_metric: input.metric, p_target: input.target, p_ends_at: ends.toISOString(), p_invitees: input.invitees,
  });
  if (error) throw error;
  return data as string;
}

export async function respondChallenge(id: string, join: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_group_challenge', { p_challenge: id, p_join: join });
  if (error) throw error;
}

/** People you follow, for the invite list. */
export async function fetchFollowing(): Promise<{ id: string; username: string; avatarColor: string | null }[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data } = await supabase.from('followers').select('following_id').eq('follower_id', session.user.id).limit(200);
  const ids = ((data as { following_id: string }[] | null) ?? []).map(r => r.following_id);
  if (!ids.length) return [];
  const { data: ps } = await supabase.from('profiles_public').select('id, username, avatar_color').in('id', ids);
  return ((ps as any[]) ?? []).map(p => ({ id: p.id, username: p.username ?? 'Runner', avatarColor: p.avatar_color ?? null }))
    .sort((a, b) => a.username.localeCompare(b.username));
}
