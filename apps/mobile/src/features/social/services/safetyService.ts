import { supabase } from '@shared/services/supabase';

/**
 * Block, mute and report (20261112000003_block_mute_report.sql).
 * Block is two-way and removes follows; mute only hides their posts from your
 * feed and they are not told. The server enforces both.
 */
export type ReportReason = 'spam' | 'harassment' | 'impersonation' | 'cheating' | 'inappropriate' | 'other';

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'harassment',    label: 'Harassment or bullying' },
  { id: 'spam',          label: 'Spam' },
  { id: 'cheating',      label: 'Cheating (GPS, vehicles)' },
  { id: 'impersonation', label: 'Pretending to be someone' },
  { id: 'inappropriate', label: 'Inappropriate name or photo' },
  { id: 'other',         label: 'Something else' },
];

async function call(fn: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
}

export const blockUser   = (id: string) => call('block_user',   { p_target: id });
export const unblockUser = (id: string) => call('unblock_user', { p_target: id });
export const muteUser    = (id: string) => call('mute_user',    { p_target: id });
export const unmuteUser  = (id: string) => call('unmute_user',  { p_target: id });
export const reportUser  = (id: string, reason: ReportReason, details?: string) =>
  call('report_user', { p_target: id, p_reason: reason, p_details: details ?? null });

/** Whether I have blocked or muted this runner. */
export async function fetchRelation(targetId: string): Promise<{ blocked: boolean; muted: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { blocked: false, muted: false };
  const [b, m] = await Promise.all([
    supabase.from('user_blocks').select('blocked_id').eq('blocker_id', user.id).eq('blocked_id', targetId).maybeSingle(),
    supabase.from('user_mutes').select('muted_id').eq('muter_id', user.id).eq('muted_id', targetId).maybeSingle(),
  ]);
  return { blocked: !!b.data, muted: !!m.data };
}

export interface HiddenRunner { userId: string; username: string; avatarColor: string | null; kind: 'blocked' | 'muted'; since: string }

export async function fetchBlocksAndMutes(): Promise<HiddenRunner[]> {
  const { data, error } = await supabase.rpc('get_my_blocks_and_mutes');
  if (error) throw new Error(error.message);
  return ((data ?? []) as { user_id: string; username: string | null; avatar_color: string | null; kind: 'blocked' | 'muted'; since: string }[])
    .map(r => ({ userId: r.user_id, username: r.username ?? 'Runner', avatarColor: r.avatar_color, kind: r.kind, since: r.since }));
}

/** Runners I have blocked: used to hide their messages in club chat. */
export async function fetchMyBlockedIds(): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', user.id);
  return new Set((data ?? []).map(r => r.blocked_id as string));
}
