export type RewardTier   = 'entry' | 'mid' | 'premium';
export type RewardStatus = 'available' | 'coming_soon';

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
}
