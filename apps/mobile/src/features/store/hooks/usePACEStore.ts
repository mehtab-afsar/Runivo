import { useEffect, useState } from 'react';
import { getPlayer } from '@shared/services/store';
import { GAME_CONFIG } from '@shared/services/config';
import { computeRunnerRank } from '@shared/services/claimEngine';
import type { StoredPlayer } from '@shared/services/store';
import { HARDCODED_REWARDS } from '../rewards';
import type { Reward } from '../types';

export function usePACEStore() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [isRedeemVisible, setIsRedeemVisible] = useState(false);

  useEffect(() => {
    getPlayer().then(p => { if (p) setPlayer(p); }).catch(() => {});
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
    rewards: HARDCODED_REWARDS, selectedReward, isRedeemVisible,
    handleRedeem, closeRedeem,
  };
}
