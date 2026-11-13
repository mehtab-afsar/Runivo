import { supabase } from '@shared/services/supabase';

/** A reward you redeemed (20261113000002_my_rewards_circle_boards.sql). */
export type MyRewardStatus = 'pending' | 'unused' | 'used' | 'expired' | 'review' | 'refunded';

export interface MyReward {
  id: string;
  rewardId: string;
  brand: string;
  title: string;
  valueLabel: string;
  brandColor: string;
  code: string | null;
  howToUse: string | null;
  paceSpent: number;
  redeemedAt: string;
  usedAt: string | null;
  expiresAt: string | null;
  status: MyRewardStatus;
}

interface Row {
  redemption_id: string; reward_id: string; brand: string; title: string; value_label: string; brand_color: string;
  code: string | null; how_to_use: string | null; pace_spent: number; redeemed_at: string; used_at: string | null;
  expires_at: string | null; status: MyRewardStatus;
}

export async function fetchMyRewards(): Promise<MyReward[]> {
  const { data, error } = await supabase.rpc('get_my_rewards');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(r => ({
    id: r.redemption_id, rewardId: r.reward_id, brand: r.brand, title: r.title, valueLabel: r.value_label,
    brandColor: r.brand_color, code: r.code, howToUse: r.how_to_use, paceSpent: r.pace_spent,
    redeemedAt: r.redeemed_at, usedAt: r.used_at, expiresAt: r.expires_at, status: r.status,
  }));
}

export async function setRewardUsed(id: string, used: boolean): Promise<void> {
  const { data, error } = await supabase.rpc('set_reward_used', { p_redemption_id: id, p_used: used });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error('not found');
}
