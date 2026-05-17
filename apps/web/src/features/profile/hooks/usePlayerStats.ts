import { useState, useEffect } from 'react';
import { getPlayer, savePlayer, getRuns, getAllTerritories, StoredPlayer, StoredRun } from '@shared/services/store';
import { GAME_CONFIG } from '@shared/services/config';
import { collectLoginBonus } from '@shared/services/passiveIncome';

export function usePlayerStats() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [recentRuns, setRecentRuns] = useState<StoredRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginBonusCoins, setLoginBonusCoins] = useState(0);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      let p = await getPlayer();

      if (p) {
        const territories = await getAllTerritories();
        const ownedCount = territories.filter(t => t.ownerId === p!.id).length;
        const { coinsEarned, updatedPlayer, alreadyCollected } = collectLoginBonus(p, ownedCount);
        if (!alreadyCollected) {
          await savePlayer(updatedPlayer);
          p = updatedPlayer;
          if (coinsEarned > 0) setLoginBonusCoins(coinsEarned);
        }
      }

      setPlayer(p);
      const runs = await getRuns(10);
      setRecentRuns(runs);
    } finally {
      setLoading(false);
    }
  };

  const xpProgress = player
    ? (() => {
        const weekly = player.paceWeeklyEarned ?? 0;
        const cap    = GAME_CONFIG.PACE_WEEKLY_CAP_FREE;
        const percent = cap > 0 ? Math.min(100, (weekly / cap) * 100) : 0;
        return { progress: weekly, needed: cap, percent };
      })()
    : { progress: 0, needed: 100, percent: 0 };

  const levelTitle = player?.runnerRank
    ? player.runnerRank.charAt(0).toUpperCase() + player.runnerRank.slice(1)
    : 'Pacer';

  return { player, recentRuns, loading, xpProgress, levelTitle, loginBonusCoins, reload: load };
}
