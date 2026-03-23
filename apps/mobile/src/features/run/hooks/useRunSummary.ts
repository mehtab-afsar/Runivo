import { useState, useEffect, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  computeSplits,
  computeRunStats,
  fetchShoesForSummary,
  assignShoeToRun,
  syncRunToHealth,
} from '../services/runSummaryService';
import type { RunStats, Split } from '../services/runSummaryService';
import type { StoredShoe } from '@shared/services/store';

export interface PassedRunData {
  distance: number;
  duration: number;
  pace: number;
  territoriesClaimed: number;
  route?: { lat: number; lng: number }[];
  actionType?: string;
  success?: boolean;
  xpEarned?: number;
  coinsEarned?: number;
  bonusCoins?: number;
  enemyCaptured?: number;
  leveledUp?: boolean;
  preRunLevel?: number;
  newLevel?: number;
  newStreak?: number;
  completedMissions?: { id: string; title: string }[];
  startTime?: number;
}

interface UseRunSummaryResult {
  runData: PassedRunData;
  splits: Split[];
  stats: RunStats;
  runShoe: StoredShoe | null;
  allShoes: StoredShoe[];
  showShoeDrawer: boolean;
  setShowShoeDrawer: (v: boolean) => void;
  selectShoe: (shoe: StoredShoe) => Promise<void>;
}

const EMPTY_RUN: PassedRunData = {
  distance: 0, duration: 0, pace: 0, territoriesClaimed: 0,
  route: [], actionType: 'claim', success: false,
};

export function useRunSummary(
  runId: string,
  passedRunData?: PassedRunData,
): UseRunSummaryResult {
  const runData = passedRunData ?? EMPTY_RUN;

  const [runShoe, setRunShoe]   = useState<StoredShoe | null>(null);
  const [allShoes, setAllShoes] = useState<StoredShoe[]>([]);
  const [showShoeDrawer, setShowShoeDrawer] = useState(false);

  useEffect(() => {
    Haptics.notificationAsync(
      runData.success
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    fetchShoesForSummary().then(({ defaultShoe, allShoes: all }) => {
      setRunShoe(defaultShoe);
      setAllShoes(all);
    });
    syncRunToHealth(runData);
  }, []);

  const splits = useMemo(() => {
    const coords = (runData.route ?? []).map(p => ({ lat: p.lat, lng: p.lng }));
    return computeSplits(coords, runData.duration);
  }, [runData.route, runData.duration]);

  const stats = useMemo(() =>
    computeRunStats({
      distance:           runData.distance,
      duration:           runData.duration,
      pace:               runData.pace,
      territoriesClaimed: runData.territoriesClaimed,
      xpEarned:           runData.xpEarned,
      coinsEarned:        runData.coinsEarned,
    }),
  [runData]);

  const selectShoe = useCallback(async (shoe: StoredShoe) => {
    setRunShoe(shoe);
    setShowShoeDrawer(false);
    if (runId) await assignShoeToRun(runId, shoe.id);
  }, [runId]);

  return { runData, splits, stats, runShoe, allShoes, showShoeDrawer, setShowShoeDrawer, selectShoe };
}
