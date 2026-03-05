import { useState, useEffect } from 'react';
import { getPlayer, getRuns, StoredPlayer, StoredRun } from '../game/store';
import { GAME_CONFIG } from '../game/config';

export function usePlayerStats() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [recentRuns, setRecentRuns] = useState<StoredRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const p = await getPlayer();
    setPlayer(p);
    const runs = await getRuns(10);
    setRecentRuns(runs);
    setLoading(false);
  };

  const xpProgress = player
    ? (() => {
        const levels = GAME_CONFIG.LEVEL_XP;
        const currentLevelXP = levels[player.level - 1] || 0;
        const nextLevelXP = levels[player.level] || currentLevelXP + 1000;
        const progress = player.xp - currentLevelXP;
        const needed = nextLevelXP - currentLevelXP;
        return { progress, needed, percent: (progress / needed) * 100 };
      })()
    : { progress: 0, needed: 100, percent: 0 };

  const levelTitle = GAME_CONFIG.LEVEL_TITLES[(player?.level ?? 1) - 1] || 'Scout';

  return { player, recentRuns, loading, xpProgress, levelTitle, reload: load };
}
