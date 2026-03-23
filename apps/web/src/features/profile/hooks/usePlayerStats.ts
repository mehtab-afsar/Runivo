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
        const levels = GAME_CONFIG.LEVEL_XP;
        const currentLevelXP = levels[player.level - 1] || 0;
        const nextLevelXP = levels[player.level] || currentLevelXP + 1000;
        const progress = player.xp - currentLevelXP;
        const needed = nextLevelXP - currentLevelXP;
        return { progress, needed, percent: needed > 0 ? (progress / needed) * 100 : 100 };
      })()
    : { progress: 0, needed: 100, percent: 0 };

  const levelTitle = GAME_CONFIG.LEVEL_TITLES[(player?.level ?? 1) - 1] || 'Scout';

  return { player, recentRuns, loading, xpProgress, levelTitle, loginBonusCoins, reload: load };
}
