import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePlayerStats } from '@mobile/shared/hooks/usePlayerStats';
import { fetchDashboardData } from '../services/dashboardService';
import type { StoredRun } from '@shared/services/store';
import type { TerritoryPolygon } from '@shared/types/game';
import type { Mission } from '@shared/services/missions';
import { computeFreshness, computeTerritoryScore } from '@shared/services/claimEngine';
import { weeklyCapFor } from '@shared/engine/runEngine';
import { supabase } from '@shared/services/supabase';
import { claimMissionReward } from '@shared/services/missionStore';
import { estimateRunCalories } from '@shared/services/nutrition';

export function useDashboard() {
  const { player, loading, error: loadError, loginBonusCoins, dismissLoginBonus, reload: reloadPlayer } = usePlayerStats();

  const [territories, setTerritories] = useState<TerritoryPolygon[]>([]);
  const [missions, setMissions]       = useState<Mission[]>([]);
  const [recentRuns, setRecentRuns]   = useState<StoredRun[]>([]);
  const [weeklyKm, setWeeklyKm]       = useState(0);
  const [runDays, setRunDays]         = useState<boolean[]>(Array(7).fill(false));
  const [dayKm, setDayKm]             = useState<number[]>(Array(7).fill(0));
  const [avatarUrl, setAvatarUrl]     = useState<string | null>(null);
  const [weeklyGoal, setWeeklyGoal]   = useState(20);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [calorieGoal, setCalorieGoal]           = useState(2000);
  const [weightKg, setWeightKg]                 = useState(70);
  const [hasRunToday, setHasRunToday] = useState(false);
  const [cityRank, setCityRank]       = useState<number | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('free');
  const [refreshing, setRefreshing]   = useState(false);
  const [syncError, setSyncError]     = useState(false);
  const [claimingId, setClaimingId]   = useState<string | null>(null);

  const loadData = useCallback(async (userId: string) => {
    const data = await fetchDashboardData(userId);
    setTerritories(data.territories);
    setMissions(data.missions);
    setRecentRuns(data.recentRuns);
    setWeeklyKm(data.weeklyKm);
    setRunDays(data.runDays);
    setDayKm(data.dayKm);
    setWeeklyGoal(data.weeklyGoal);
    setCaloriesConsumed(data.caloriesConsumed);
    setCalorieGoal(data.calorieGoal);
    setWeightKg(data.weightKg);
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
      .select('subscription_tier, avatar_url')
      .eq('id', userId)
      .single();
    setSubscriptionTier(typeof data?.subscription_tier === 'string' ? data.subscription_tier : 'free');
    setAvatarUrl(typeof data?.avatar_url === 'string' && data.avatar_url ? data.avatar_url : null);
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

  // Optimistic claimed-flag flip + local mission replace; PACE balance itself
  // only ever moves via claimMissionReward's own server round-trip (see its
  // doc comment) — reloadPlayer() just pulls that already-applied local write
  // back into `player` so the balance shown elsewhere on this screen updates.
  const claimMission = useCallback(async (missionId: string) => {
    setClaimingId(missionId);
    try {
      const claimed = await claimMissionReward(missionId);
      if (claimed) {
        setMissions(prev => prev.map(m => m.id === missionId ? claimed : m));
        await reloadPlayer();
      }
      return claimed;
    } finally {
      setClaimingId(null);
    }
  }, [reloadPlayer]);

  const weeklyCapLimit = weeklyCapFor(subscriptionTier);

  const pacePct = useMemo(() => {
    const earned = player?.paceWeeklyEarned ?? 0;
    return weeklyCapLimit > 0 ? Math.min(100, (earned / weeklyCapLimit) * 100) : 0;
  }, [player?.paceWeeklyEarned, weeklyCapLimit]);

  const { ownedCount, staleCount, avgFreshness, totalAreaM2, territoryScore, lowestFreshness } = useMemo(() => {
    const owned = player ? territories.filter(t => t.ownerId === player.id) : [];
    const count = owned.length;
    if (count === 0) return { ownedCount: 0, staleCount: 0, avgFreshness: 0, totalAreaM2: 0, territoryScore: 0, lowestFreshness: 100 };

    let freshSum = 0;
    let areaSum  = 0;
    let stale    = 0;
    let lowest   = 100;

    for (const t of owned) {
      const fresh = computeFreshness(t.lastDefendedAt, t.freshness);
      freshSum += fresh;
      areaSum  += t.areaM2;
      if (fresh < 40) stale++;
      if (fresh < lowest) lowest = fresh;
    }

    return {
      ownedCount:     count,
      staleCount:     stale,
      avgFreshness:   Math.round(freshSum / count),
      totalAreaM2:    Math.round(areaSum),
      territoryScore: computeTerritoryScore(owned),
      lowestFreshness: lowest,
    };
  }, [territories, player]);

  const netCaloriesToday = useMemo(() => {
    const today = new Date().toDateString();
    const burned = recentRuns
      .filter(r => new Date(r.startTime).toDateString() === today)
      .reduce((sum, r) => sum + estimateRunCalories(r.distanceMeters, weightKg), 0);
    return burned - caloriesConsumed;
  }, [recentRuns, caloriesConsumed, weightKg]);

  return {
    player,
    loading,
    loadError,
    reloadPlayer,
    loginBonusCoins,
    dismissLoginBonus,
    pacePct,
    weeklyCapLimit,
    territories,
    missions,
    recentRuns,
    weeklyKm,
    runDays,
    dayKm,
    avatarUrl,
    lowestFreshness,
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
    claimMission,
    claimingId,
  };
}
