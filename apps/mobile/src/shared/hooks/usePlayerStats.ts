import { useState, useEffect } from 'react';
import { getPlayer, savePlayer, getRuns, getAllTerritories, getTerritoryPolygons } from '@shared/services/store';
import type { StoredPlayer, StoredRun } from '@shared/services/store';
import { collectLoginBonus } from '@shared/services/passiveIncome';

export function usePlayerStats() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [recentRuns, setRecentRuns] = useState<StoredRun[]>([]);
  const [totalAreaM2, setTotalAreaM2] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loginBonusCoins, _setLoginBonusCoins] = useState(0);

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
        const { updatedPlayer, alreadyCollected } = collectLoginBonus(p, ownedCount);
        if (!alreadyCollected) {
          await savePlayer(updatedPlayer);
          p = updatedPlayer;
        }
      }

      setPlayer(p);
      const [runs, polygons] = await Promise.all([
        getRuns(10),
        p ? getTerritoryPolygons(p.id) : Promise.resolve([]),
      ]);
      setRecentRuns(runs);
      setTotalAreaM2(polygons.reduce((s, poly) => s + poly.areaM2, 0));
    } finally {
      setLoading(false);
    }
  };

  return { player, recentRuns, totalAreaM2, loading, loginBonusCoins, reload: load };
}
