export type RewardTier   = 'entry' | 'mid' | 'premium';
export type RewardStatus = 'available' | 'coming_soon';

/** Why a reward can't be redeemed by this runner right now (from store_catalog / redeem_reward). */
export type LockReason =
  | 'not_found' | 'profile_not_found' | 'not_available' | 'not_started' | 'expired'
  | 'not_in_region' | 'already_redeemed' | 'plus_only' | 'rank_locked' | 'new_account'
  | 'sold_out' | 'not_enough_pace' | 'signed_out';

export type RunnerRankName = 'pacer' | 'strider' | 'chaser' | 'hunter' | 'sovereign';

export interface Reward {
  id: string;
  brand: string;
  title: string;
  description: string;
  paceCost: number;
  tier: RewardTier;
  status: RewardStatus;
  brandColor: string;
  brandInitial: string;
  expiresLabel?: string;
  valueLabel: string;
  category: 'gear' | 'nutrition' | 'tech' | 'events';
  // Partner programme (store_catalog). All optional so the offline fallback still works.
  plusOnly?: boolean;
  minRank?: RunnerRankName | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  /** Codes or stock left; null = unlimited. */
  stockLeft?: number | null;
  /** Null when this runner can redeem it now. */
  lockReason?: LockReason | null;
  redeemed?: boolean;
  /** This runner's code, once redeemed. */
  myCode?: string | null;
  howToUse?: string | null;
}
