import { supabase } from '@shared/services/supabase';
import type { LockReason } from '../types';
import { lastKnownPoint, pointParams } from './devicePoint';

export interface RedeemResult {
  success: boolean;
  /** Why it failed (same codes as store_catalog's lock_reason); null on success. */
  reason: LockReason | null;
  message: string;
  newBalance: number | null;
  /** Single-use code from the partner's pool (or the reward's shared code). */
  code: string | null;
  howToUse: string | null;
  /** Held for review (the code comes later, once checked). */
  held?: boolean;
}

/** Calls the redeem-reward edge function, which runs the atomic, gated
 *  redeem_reward() RPC with the service-role key. */
export async function redeemReward(rewardId: string): Promise<RedeemResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { success: false, reason: 'signed_out', message: 'Sign in to redeem rewards.', newBalance: null, code: null, howToUse: null };
  }

  const point = await lastKnownPoint();
  const { data, error } = await supabase.functions.invoke('redeem-reward', {
    body: { rewardId, ...(point && { lat: point.lat, lng: point.lng }) },
  });
  if (error || !data) {
    return { success: false, reason: null, message: 'Redemption failed. Please try again.', newBalance: null, code: null, howToUse: null };
  }
  const d = data as Partial<RedeemResult>;
  return {
    success:    d.success === true,
    reason:     (d.reason ?? null) as LockReason | null,
    message:    d.message ?? (d.success ? 'Redeemed.' : 'Redemption failed. Please try again.'),
    newBalance: typeof d.newBalance === 'number' ? d.newBalance : null,
    code:       d.code ?? null,
    howToUse:   d.howToUse ?? null,
    held:       d.held === true,
  };
}

/** Counts a view for the partner's report. Anonymous: the server keeps city,
 *  country and rank, never who. Best-effort. */
export async function logRewardView(rewardId: string): Promise<void> {
  try {
    await supabase.rpc('log_reward_view', { p_reward_id: rewardId, ...pointParams(await lastKnownPoint()) });
  } catch { /* reporting only */ }
}
