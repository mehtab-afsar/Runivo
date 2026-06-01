import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePlayerStats } from '@mobile/shared/hooks/usePlayerStats';
import { fetchDashboardData } from '../services/dashboardService';
import type { StoredRun } from '@shared/services/store';
import type { TerritoryPolygon } from '@shared/types/game';
import type { Mission } from '@shared/services/missions';
import { GAME_CONFIG } from '@shared/services/config';
import { computeFreshness, computeTerritoryScore } from '@shared/services/claimEngine';
import { supabase } from '@shared/services/supabase';

export function useDashboard() {
  const { player, loading } = usePlayerStats();

  const [territories, setTerritories] = useState<TerritoryPolygon[]>([]);
  const [missions, setMissions]       = useState<Mission[]>([]);
  const [recentRuns, setRecentRuns]   = useState<StoredRun[]>([]);
  const [weeklyKm, setWeeklyKm]       = useState(0);
  const [runDays, setRunDays]         = useState<boolean[]>(Array(7).fill(false));
  const [weeklyGoal, setWeeklyGoal]   = useState(20);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [calorieGoal, setCalorieGoal]           = useState(2000);
  const [hasRunToday, setHasRunToday] = useState(false);
  const [cityRank, setCityRank]       = useState<number | null>(null);
  const [isPremium, setIsPremium]     = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [syncError, setSyncError]     = useState(false);

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
    const today = new Date().toDateString();
    setHasRunToday(data.recentRuns.some(r => new Date(r.startTime).toDateString() === today));
    return data.recentRuns;
  }, []);

  const fetchCityRank = useCallback(async (userId: string, runs: StoredRun[]) => {
    const lastRun = runs[0];
    if (!lastRun?.gpsPoints?.length) return;
    const { lat, lng } = lastRun.gpsPoints[0];
    const { data, error } = await supabase.rpc('get_city_rank', {
      p_user_id: userId, p_lat: lat, p_lng: lng, p_radius_km: 10,
    });
    if (error) console.warn('[dashboard] city rank:', error.message);
    if (typeof data === 'number') setCityRank(data);
  }, []);

  const fetchSubscriptionTier = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();
    setIsPremium(!!data?.subscription_tier && data.subscription_tier !== 'free');
  }, []);

  useEffect(() => {
    if (!player?.id) return;
    const id = player.id;
    fetchSubscriptionTier(id).catch(() => {});
    loadData(id)
      .then(runs => {
        setSyncError(false);
        fetchCityRank(id, runs).catch(() => {});
      })
      .catch(() => setSyncError(true));
  }, [player?.id, loadData, fetchCityRank, fetchSubscriptionTier]);

  const refresh = useCallback(async () => {
    if (!player?.id) return;
    const id = player.id;
    setRefreshing(true);
    try {
      fetchSubscriptionTier(id).catch(() => {});
      const runs = await loadData(id);
      setSyncError(false);
      fetchCityRank(id, runs).catch(() => {});
    } catch {
      setSyncError(true);
    } finally {
      setRefreshing(false);
    }
  }, [player?.id, loadData, fetchCityRank, fetchSubscriptionTier]);

  const weeklyCapLimit = isPremium ? GAME_CONFIG.PACE_WEEKLY_CAP_PREMIUM : GAME_CONFIG.PACE_WEEKLY_CAP_FREE;

  const pacePct = useMemo(() => {
    const earned = player?.paceWeeklyEarned ?? 0;
    return weeklyCapLimit > 0 ? Math.min(100, (earned / weeklyCapLimit) * 100) : 0;
  }, [player?.paceWeeklyEarned, weeklyCapLimit]);

  const { ownedCount, staleCount, avgFreshness, totalAreaM2, territoryScore } = useMemo(() => {
    const owned = player ? territories.filter(t => t.ownerId === player.id) : [];
    const count = owned.length;
    if (count === 0) return { ownedCount: 0, staleCount: 0, avgFreshness: 0, totalAreaM2: 0, territoryScore: 0 };

    let freshSum = 0;
    let areaSum  = 0;
    let stale    = 0;

    for (const t of owned) {
      const fresh = computeFreshness(t.lastDefendedAt, t.freshness);
      freshSum += fresh;
      areaSum  += t.areaM2;
      if (fresh < 40) stale++;
    }

    return {
      ownedCount:     count,
      staleCount:     stale,
      avgFreshness:   Math.round(freshSum / count),
      totalAreaM2:    Math.round(areaSum),
      territoryScore: computeTerritoryScore(owned),
    };
  }, [territories, player]);

  const netCaloriesToday = useMemo(() => {
    const today = new Date().toDateString();
    const burned = recentRuns
      .filter(r => new Date(r.startTime).toDateString() === today)
      .reduce((sum, r) => sum + Math.round((r.distanceMeters / 1000) * 65), 0);
    return burned - caloriesConsumed;
  }, [recentRuns, caloriesConsumed]);

  return {
    player,
    loading,
    pacePct,
    weeklyCapLimit,
    territories,
    missions,
    recentRuns,
    weeklyKm,
    runDays,
    weeklyGoal,
    caloriesConsumed,
    calorieGoal,
    netCaloriesToday,
    refreshing,
    ownedCount,
    staleCount,
    avgFreshness,
    totalAreaM2,
    territoryScore,
    hasRunToday,
    cityRank,
    syncError,
    refresh,
  };
}
