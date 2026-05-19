import { useState, useEffect } from 'react';
import { supabase } from '@shared/services/supabase';
import { getPlayer } from '@shared/services/store';
import { GAME_CONFIG } from '@shared/services/config';
import { computeRunnerRank } from '@shared/services/claimEngine';
import type { StoredPlayer } from '@shared/services/store';
import { HARDCODED_REWARDS } from '../rewards';
import type { Reward } from '../types';

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
    expiresLabel: row.expires_at
      ? `Expires ${new Date(String(row.expires_at)).toLocaleDateString()}`
      : undefined,
  };
}

export function usePACEStore() {
  const [player, setPlayer]               = useState<StoredPlayer | null>(null);
  const [rewards, setRewards]             = useState<Reward[]>(HARDCODED_REWARDS);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [isRedeemVisible, setIsRedeemVisible] = useState(false);

  useEffect(() => {
    getPlayer().then(p => { if (p) setPlayer(p); }).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('pace_store_rewards')
        .select('*')
        .neq('status', 'hidden')
        .order('sort_order', { ascending: true });
      if (data && data.length > 0) {
        setRewards(data.map(row => mapDbRowToReward(row as Record<string, unknown>)));
      }
    })().catch(() => { /* keep HARDCODED_REWARDS fallback */ });
  }, []);

  const paceBalance      = player?.paceBalance      ?? 0;
  const paceWeeklyEarned = player?.paceWeeklyEarned ?? 0;
  const capLimit         = GAME_CONFIG.PACE_WEEKLY_CAP_FREE;
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
    rewards, selectedReward, isRedeemVisible, handleRedeem, closeRedeem,
  };
}
