import type { Reward } from './types';

export type LockKind = 'plus' | 'rank' | 'new_account' | 'sold_out' | 'ended' | 'upcoming' | 'redeemed' | 'region' | 'none';

export interface LockState {
  kind: LockKind;
  /** Short label for cards and the detail banner; null when nothing to say. */
  label: string | null;
  /** True when the reward can't be claimed at all right now (dim the card). */
  blocked: boolean;
}

const RANK_LABEL: Record<string, string> = {
  pacer: 'Pacer', strider: 'Strider', chaser: 'Chaser', hunter: 'Hunter', sovereign: 'Sovereign',
};

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Turns the server's lock reason into what the runner sees. */
export function lockStateFor(reward: Reward): LockState {
  if (reward.redeemed) return { kind: 'redeemed', label: 'Redeemed', blocked: false };
  if (reward.status === 'coming_soon') return { kind: 'upcoming', label: 'Coming soon', blocked: true };
  switch (reward.lockReason) {
    case 'plus_only':
      return { kind: 'plus', label: 'Runivo Plus', blocked: true };
    case 'rank_locked':
      return { kind: 'rank', label: `Reach ${RANK_LABEL[reward.minRank ?? 'hunter'] ?? 'a higher rank'} to unlock`, blocked: true };
    case 'new_account':
      return { kind: 'new_account', label: 'Unlocks after 3 runs and 14 days', blocked: true };
    case 'sold_out':
      return { kind: 'sold_out', label: 'Sold out', blocked: true };
    case 'expired':
      return { kind: 'ended', label: 'Ended', blocked: true };
    case 'not_started':
      return { kind: 'upcoming', label: reward.startsAt ? `Starts ${shortDate(reward.startsAt)}` : 'Coming soon', blocked: true };
    case 'not_available':
      return { kind: 'upcoming', label: 'Coming soon', blocked: true };
    case 'not_in_region':
      return { kind: 'region', label: 'Not in your city', blocked: true };
    case 'already_redeemed':
      return { kind: 'redeemed', label: 'Redeemed', blocked: false };
    default:
      // not_enough_pace, signed_out, null: show the price; the detail screen explains.
      if (reward.stockLeft != null && reward.stockLeft > 0 && reward.stockLeft <= 10) {
        return { kind: 'none', label: `${reward.stockLeft} left`, blocked: false };
      }
      return { kind: 'none', label: reward.expiresLabel ?? null, blocked: false };
  }
}
