import { useState, useEffect, useMemo, useCallback } from 'react';
import * as Haptics from '@theme/hapticsGated';
import {
  computeSplits,
  computeRunStats,
  fetchShoesForSummary,
  assignShoeToRun,
  syncRunToHealth,
  fetchRunById,
} from '../services/runSummaryService';
import type { RunStats, Split } from '../services/runSummaryService';
import type { StoredShoe } from '@shared/services/store';
import type { TerritoryPolygon, RunnerRank } from '@shared/types/game';
import { getRuns } from '@shared/services/store';

export interface PassedRunData {
  distance: number;
  duration: number;
  pace: number;
  territoriesClaimed: number;
  route?: { lat: number; lng: number; timestamp?: number }[];
  actionType?: string;
  success?: boolean;
  bonusCoins?: number;
  enemyCaptured?: number;
  preRunLevel?: number;
  newLevel?: number;
  newStreak?: number;
  completedMissions?: { id: string; title: string }[];
  startTime?: number;
  elevationGainM?: number;
  // PACE economy (new)
  paceEarned?: number;
  paceBreakdown?: {
    fromDistance: number;
    fromNewZones: number;
    fromStolenZones: number;
    fromStreak: number;
  };
  cappedAt?: number;
  territory?: TerritoryPolygon | null;
  runnerRank?: RunnerRank;
  paceTotalEarned?: number;
  runnerRankPaceToNext?: number;
  rivalZonesStolen?: number;
  newAwards?: string[];
}

interface UseRunSummaryResult {
  runData: PassedRunData;
  splits: Split[];
  stats: RunStats;
  runShoe: StoredShoe | null;
  allShoes: StoredShoe[];
  shoeTotalKm: number;
  showShoeDrawer: boolean;
  setShowShoeDrawer: (v: boolean) => void;
  selectShoe: (shoe: StoredShoe) => Promise<void>;
  /** The run couldn't be loaded (not on the phone, server unreachable). */
  loadError: boolean;
  retryLoad: () => void;
  loading: boolean;
}

const EMPTY_RUN: PassedRunData = {
  distance: 0, duration: 0, pace: 0, territoriesClaimed: 0,
  route: [], actionType: 'claim', success: false,
};

function paceFromAvgPaceStr(avgPace: string): number {
  const [m, s] = avgPace.split(':').map(Number);
  return (m + (s || 0) / 60) || 0;
}

export function useRunSummary(
  runId: string,
  passedRunData?: PassedRunData,
  activityType?: string,
): UseRunSummaryResult {
  // History/Dashboard/Profile navigate here with only { runId } (no runData) — the
  // run already finished and synced in a previous session, so there's nothing to
  // pass. Previously this fell back to EMPTY_RUN (0.00 km, "claim Failed" heading)
  // for every historical run; fetch the saved run instead when nothing was passed.
  const [fetchedRunData, setFetchedRunData] = useState<PassedRunData | null>(null);
  const [loading, setLoading] = useState(!passedRunData);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retryLoad = useCallback(() => { setLoadError(false); setLoading(true); setAttempt(a => a + 1); }, []);

  useEffect(() => {
    if (passedRunData) { setLoading(false); return; }
    let cancelled = false;
    fetchRunById(runId).then(run => {
      if (cancelled) return;
      if (!run) setLoadError(true);
      if (run) {
        setFetchedRunData({
          distance:           run.distanceMeters / 1000,
          duration:           run.durationSec,
          pace:               paceFromAvgPaceStr(run.avgPace),
          territoriesClaimed: run.territoriesClaimed?.length ?? 0,
          route:              run.gpsPoints?.map(p => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp })),
          actionType:         'claim',
          success:            true,
          startTime:          run.startTime,
          elevationGainM:     run.elevationGainM,
          rivalZonesStolen:   run.rivalZonesStolen ?? 0,
        });
      }
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setLoadError(true);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [runId, passedRunData, attempt]);

  const runData = passedRunData ?? fetchedRunData ?? EMPTY_RUN;

  const [runShoe, setRunShoe]   = useState<StoredShoe | null>(null);
  const [allShoes, setAllShoes] = useState<StoredShoe[]>([]);
  const [shoeTotalKm, setShoeTotalKm] = useState(0);
  const [showShoeDrawer, setShowShoeDrawer] = useState(false);

  useEffect(() => {
    if (loading || loadError) return;
    Haptics.notificationAsync(
      runData.success
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    fetchShoesForSummary().then(async ({ defaultShoe, allShoes: all }) => {
      setAllShoes(all);
      // P5: the shoe this run was in. A run that just finished takes the default.
      const allRuns = await getRuns(500);
      const thisRun = runId ? allRuns.find(r => r.id === runId) : undefined;
      let shoe = thisRun?.shoeId ? all.find(s => s.id === thisRun.shoeId) ?? null : null;
      if (!shoe && passedRunData && defaultShoe && runId) {
        shoe = defaultShoe;
        await assignShoeToRun(runId, defaultShoe.id).catch(() => {});
      }
      setRunShoe(shoe);
      if (shoe) {
        const km = allRuns
          .filter(r => r.shoeId === shoe!.id || (r.id === runId && !r.shoeId))
          .reduce((s, r) => s + r.distanceMeters / 1000, 0);
        setShoeTotalKm(km);
      }
    }).catch(() => {});
    // Don't re-sync a historical run to HealthKit — only for a run that just finished.
    if (passedRunData) syncRunToHealth(runData, activityType);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const splits = useMemo(() => {
    const coords = (runData.route ?? []).map(p => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp }));
    return computeSplits(coords, runData.duration);
  }, [runData.route, runData.duration]);

  const stats = useMemo(() =>
    computeRunStats({
      distance:           runData.distance,
      duration:           runData.duration,
      pace:               runData.pace,
      territoriesClaimed: runData.territoriesClaimed,
    }),
  [runData]);

  const selectShoe = useCallback(async (shoe: StoredShoe) => {
    setRunShoe(shoe);
    setShowShoeDrawer(false);
    if (runId) await assignShoeToRun(runId, shoe.id);
    const allRuns = await getRuns(500);
    setShoeTotalKm(allRuns.filter(r => r.shoeId === shoe.id).reduce((s, r) => s + r.distanceMeters / 1000, 0));
  }, [runId]);

  return { runData, splits, stats, runShoe, allShoes, shoeTotalKm, showShoeDrawer, setShowShoeDrawer, selectShoe, loading, loadError, retryLoad };
}
