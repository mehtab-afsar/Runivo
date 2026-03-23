import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePlayerStats } from '@mobile/shared/hooks/usePlayerStats';
import { fetchDashboardData } from '../services/dashboardService';
import type { StoredTerritory, StoredRun } from '@shared/services/store';
import type { Mission } from '@shared/services/missions';

export function useDashboard() {
  const { player, loading, loginBonusCoins, xpProgress } = usePlayerStats();

  const [territories, setTerritories] = useState<StoredTerritory[]>([]);
  const [missions, setMissions]       = useState<Mission[]>([]);
  const [recentRuns, setRecentRuns]   = useState<StoredRun[]>([]);
  const [weeklyKm, setWeeklyKm]       = useState(0);
  const [runDays, setRunDays]         = useState<boolean[]>(Array(7).fill(false));
  const [weeklyGoal, setWeeklyGoal]   = useState(20);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [calorieGoal, setCalorieGoal]           = useState(2000);
  const [refreshing, setRefreshing]   = useState(false);
  const [bonusCollected, setBonusCollected] = useState(false);

  const loadData = useCallback(async (userId: string) => {
    const data = await fetchDashboardData(userId);
    setTerritories(data.territories);
    setMissions(data.missions);
    setRecentRuns(data.recentRuns);
    setWeeklyKm(data.weeklyKm);
    setRunDays(data.runDays);
    setWeeklyGoal(data.weeklyGoal);
    setCaloriesConsumed(data.caloriesConsumed);
    setCalorieGoal(data.calorieGoal);
  }, []);

  useEffect(() => {
    if (player?.id) loadData(player.id);
  }, [player?.id, loadData]);

  const refresh = useCallback(async () => {
    if (!player?.id) return;
    setRefreshing(true);
    try { await loadData(player.id); } finally { setRefreshing(false); }
  }, [player?.id, loadData]);

  const collectBonus = useCallback(() => {
    setBonusCollected(true);
  }, []);

  const { ownedCount, weakZones, avgDefense } = useMemo(() => {
    const owned = player ? territories.filter(t => t.ownerId === player.id) : [];
    const count = owned.length;
    const avg   = count > 0
      ? Math.round(owned.reduce((s, t) => s + t.defense, 0) / count)
      : 0;
    return {
      ownedCount: count,
      weakZones:  owned.filter(t => t.defense < 30),
      avgDefense: avg,
    };
  }, [territories, player]);

  const dailyIncome = 0;

  return {
    player,
    loading,
    xpProgress,
    loginBonusCoins,
    territories,
    missions,
    recentRuns,
    weeklyKm,
    runDays,
    weeklyGoal,
    caloriesConsumed,
    calorieGoal,
    refreshing,
    bonusCollected,
    ownedCount,
    weakZones,
    avgDefense,
    dailyIncome,
    collectBonus,
    refresh,
  };
}
