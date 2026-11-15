import { useState, useEffect, useCallback } from 'react';
import { StoredRun } from '@shared/services/store';
import { fetchRunHistory } from '../services/historyService';

export interface RunHistoryState {
  runs: StoredRun[];
  loading: boolean;
  refreshing: boolean;
  /** The last load failed (offline / server). Cleared on the next success. */
  error: boolean;
  totalKm: number;
  avgKm: number;
  refresh: () => void;
}

export function useRunHistory(): RunHistoryState {
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await fetchRunHistory();
      setRuns(data);
      setError(false);
    } catch { setError(true); } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  const totalKm = runs.reduce((acc, r) => acc + r.distanceMeters / 1000, 0);
  const avgKm = totalKm / Math.max(runs.length, 1);

  return { runs, loading, refreshing, error, totalKm, avgKm, refresh };
}
