import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@shared/services/supabase';
import { getPlayer } from '@shared/services/store';
import { computeRunnerRank } from '@shared/services/claimEngine';
import { weeklyCapFor, weeklyPaceNow } from '@shared/engine/runEngine';
import { pullProfile } from '@shared/services/sync';
import type { StoredPlayer } from '@shared/services/store';
import type { Reward } from '../types';
import { lastKnownPoint, pointParams } from '../services/devicePoint';
import { effectiveTier } from '@shared/engine/entitlements';

function expiresLabelFor(iso: unknown): string | undefined {
  return iso ? `Ends ${new Date(String(iso)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : undefined;
}

/** Row from the pace_store_rewards table (fallback when store_catalog isn't deployed). */
function mapDbRowToReward(row: Record<string, unknown>): Reward {
  return {
    id:           String(row.id),
    brand:        String(row.brand),
    title:        String(row.title),
    description:  String(row.description),
    paceCost:     Number(row.pace_cost),
    tier:         (row.tier as Reward['tier']) ?? 'entry',
    status:       row.status === 'available' ? 'available' : 'coming_soon',
    brandColor:   String(row.brand_color),
    brandInitial: String(row.brand_initial),
    valueLabel:   String(row.value_label),
    category:     (row.category as Reward['category']) ?? 'gear',
    expiresLabel: expiresLabelFor(row.expires_at),
    expiresAt:    row.expires_at ? String(row.expires_at) : null,
  };
}

/** Row from store_catalog(): the reward plus this runner's lock reason and code. */
function mapCatalogRowToReward(row: Record<string, unknown>): Reward {
  const status = String(row.status);
  return {
    ...mapDbRowToReward(row),
    // Sold-out rewards stay listed (locked) rather than "coming soon".
    status:     status === 'coming_soon' ? 'coming_soon' : 'available',
    plusOnly:   row.plus_only === true,
    minRank:    (row.min_rank as Reward['minRank']) ?? null,
    startsAt:   row.starts_at ? String(row.starts_at) : null,
    stockLeft:  row.stock_left == null ? null : Number(row.stock_left),
    lockReason: (row.lock_reason as Reward['lockReason']) ?? null,
    redeemed:   row.redeemed === true,
    myCode:     row.my_code ? String(row.my_code) : null,
    howToUse:   row.how_to_use ? String(row.how_to_use) : null,
  };
}

/** Live rewards for this runner: server catalogue, then the table, then the built-in fallback. */
export async function loadRewards(): Promise<Reward[] | null> {
  // City rewards use the phone's last known position when the profile has
  // no saved location (never prompts; see devicePoint.ts).
  const catalog = await supabase.rpc('store_catalog', pointParams(await lastKnownPoint()));
  if (!catalog.error && Array.isArray(catalog.data)) {
    return (catalog.data as Record<string, unknown>[]).map(mapCatalogRowToReward);
  }
  const { data } = await supabase
    .from('pace_store_rewards')
    .select('*')
    .neq('status', 'hidden')
    .order('sort_order', { ascending: true });
  return data && data.length > 0 ? data.map(row => mapDbRowToReward(row as Record<string, unknown>)) : null;
}

export function usePACEStore() {
  const [player, setPlayer]               = useState<StoredPlayer | null>(null);
  const [rewards, setRewards]             = useState<Reward[]>([]);
  // false until the first server answer, so the screen doesn't flash "no rewards" while loading.
  const [rewardsLoaded, setRewardsLoaded] = useState(false);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [isRedeemVisible, setIsRedeemVisible] = useState(false);

  // Balance: the cached player first (instant), then the server's copy. Read on
  // every refresh (the screen refreshes on focus), not just on mount: coming back
  // from a redemption, or after a refund (review_redemption) or a mission claim,
  // used to keep showing the old balance.
  const loadPlayer = useCallback(async () => {
    const cached = await getPlayer().catch(() => null);
    if (cached) setPlayer(cached);
    await pullProfile().catch(() => {});
    const fresh = await getPlayer().catch(() => null);
    if (fresh) setPlayer(fresh);
  }, []);

  const refresh = useCallback(async () => {
    loadPlayer();
    try {
      // Whatever the server has for this runner's area, including nothing: rewards
      // are partner offers in selected cities, so an empty list is a real answer.
      // (There used to be a hardcoded sample reward here that nobody could redeem.)
      const loaded = await loadRewards();
      setRewards(loaded ?? []);
    } catch { /* keep what is shown; a network error is not "no rewards" */ }
    finally { setRewardsLoaded(true); }
  }, [loadPlayer]);

  useEffect(() => { refresh(); }, [refresh]);

  const paceBalance      = player?.paceBalance      ?? 0;
  const paceWeeklyEarned = weeklyPaceNow(player?.paceWeeklyEarned, player?.paceWeeklyResetAt);
  const capLimit         = weeklyCapFor(effectiveTier(player?.subscriptionTier));
  const weeklyPct        = capLimit > 0 ? Math.min(1, paceWeeklyEarned / capLimit) : 0;
  const runnerRank       = computeRunnerRank(player?.paceTotalEarned ?? 0);

  function handleRedeem(reward: Reward) {
    setSelectedReward(reward);
    setIsRedeemVisible(true);
  }

  function closeRedeem() {
    setSelectedReward(null);
    setIsRedeemVisible(false);
  }

  return {
    paceBalance, paceWeeklyEarned, capLimit, weeklyPct, runnerRank,
    rewards, rewardsLoaded, selectedReward, isRedeemVisible, handleRedeem, closeRedeem, refresh,
  };
}
