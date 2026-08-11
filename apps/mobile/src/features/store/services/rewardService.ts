import { supabase } from '@shared/services/supabase';

export interface RedeemResult {
  success: boolean;
  message: string;
  newBalance: number | null;
}

/** Calls the redeem-reward edge function, which proxies to the atomic
 *  redeem_reward() RPC using the service-role key (required — pace_balance
 *  can't be written directly by an authenticated client). */
export async function redeemReward(rewardId: string): Promise<RedeemResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, message: 'Sign in to redeem rewards.', newBalance: null };

  const { data, error } = await supabase.functions.invoke('redeem-reward', {
    body: { rewardId },
  });

  if (error) return { success: false, message: 'Redemption failed. Please try again.', newBalance: null };
  return data as RedeemResult;
}
