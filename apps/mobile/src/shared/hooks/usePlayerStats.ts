import { useState, useEffect, useRef } from 'react';
import { getPlayer, savePlayer, getRuns, getAllTerritories, getTerritoryPolygons } from '@shared/services/store';
import type { StoredPlayer, StoredRun } from '@shared/services/store';
import { collectLoginBonus } from '@shared/services/passiveIncome';

export function usePlayerStats() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [recentRuns, setRecentRuns] = useState<StoredRun[]>([]);
  const [totalAreaM2, setTotalAreaM2] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loginBonusCoins, setLoginBonusCoins] = useState(0);
  const [error, setError] = useState(false);
  // `loading` is for the first load only. Reloading after an action (claiming a mission)
  // keeps the screen on its current content instead of blanking it and resetting scroll.
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    if (!hasLoadedRef.current) setLoading(true);
    try {
      let p = await getPlayer();

      if (p) {
        const territories = await getAllTerritories();
        const ownedCount = territories.filter(t => t.ownerId === p!.id).length;
        const { updatedPlayer, alreadyCollected, coinsEarned } = collectLoginBonus(p, ownedCount);
        if (!alreadyCollected) {
          await savePlayer(updatedPlayer);
          p = updatedPlayer;
          if (coinsEarned > 0) setLoginBonusCoins(coinsEarned);
        }
      }

      setPlayer(p);
      const [runs, polygons] = await Promise.all([
        getRuns(10),
        p ? getTerritoryPolygons(p.id) : Promise.resolve([]),
      ]);
      setRecentRuns(runs);
      setTotalAreaM2(polygons.reduce((s, poly) => s + poly.areaM2, 0));
      hasLoadedRef.current = true;
      setError(false);
    } catch {
      // Keep whatever is already on screen; only the very first load shows an error state.
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const dismissLoginBonus = () => setLoginBonusCoins(0);

  return { player, recentRuns, totalAreaM2, loading, error, loginBonusCoins, dismissLoginBonus, reload: load };
}
