/**
 * Cheers: a quick message to a friend who is running right now
 * (20261115000025_run_cheers.sql). The server decides who may cheer whom,
 * allows one cheer per friend per run, and queues the lock-screen push; the
 * runner's app also hears it over realtime and says it out loud.
 */
import { supabase } from '@shared/services/supabase';
import { loadPublicProfiles } from '@features/social/hooks/usePublicProfiles';

import type { CheerKey } from './cheerMessages';
export { CHEERS, cheerText, type CheerKey } from './cheerMessages';

export type SendCheerResult = 'sent' | 'already' | 'not_live' | 'too_many' | 'bad_message';

export async function sendCheer(toUserId: string, key: CheerKey): Promise<SendCheerResult> {
  const { data, error } = await supabase.rpc('send_cheer', { p_to: toUserId, p_message: key });
  if (error) throw error;
  return (data as SendCheerResult) ?? 'not_live';
}

export async function thankCheer(cheerId: string): Promise<void> {
  await supabase.rpc('thank_cheer', { p_id: cheerId });
}

export interface Cheer {
  id: string;
  runId: string;
  fromUserId: string;
  fromName: string;
  message: CheerKey;
  createdAt: number;
}

// Other runners' names come from profiles_public: `profiles` is owner-only, so
// reading it here always came back empty and every cheer was from "A friend".
async function namesFor(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const profiles = await loadPublicProfiles(ids);
  return new Map([...profiles].map(([id, p]) => [id, p.username ?? 'A friend']));
}

/** Cheers a runner received during one run, oldest first (for the activity page). */
export async function fetchRunCheers(runId: string): Promise<Cheer[]> {
  const { data, error } = await supabase
    .from('run_cheers')
    .select('id, run_id, from_user, message, created_at')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  const names = await namesFor([...new Set(data.map(r => r.from_user as string))]);
  return data.map(r => ({
    id: r.id as string,
    runId: r.run_id as string,
    fromUserId: r.from_user as string,
    fromName: names.get(r.from_user as string) ?? 'A friend',
    message: r.message as CheerKey,
    createdAt: Date.parse(r.created_at as string),
  }));
}

/**
 * Cheers arriving for `userId` while this is mounted (the live run screen).
 * RLS limits the stream to cheers the runner may read.
 */
export function subscribeCheers(userId: string, onCheer: (cheer: Cheer) => void): () => void {
  const channel = supabase
    .channel(`run-cheers-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'run_cheers', filter: `to_user=eq.${userId}` },
      async payload => {
        const row = payload.new as Record<string, unknown>;
        const names = await namesFor([row.from_user as string]).catch(() => new Map<string, string>());
        onCheer({
          id: row.id as string,
          runId: row.run_id as string,
          fromUserId: row.from_user as string,
          fromName: names.get(row.from_user as string) ?? 'A friend',
          message: row.message as CheerKey,
          createdAt: Date.parse(row.created_at as string),
        });
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
