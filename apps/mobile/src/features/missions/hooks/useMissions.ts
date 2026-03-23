import { useState, useEffect, useCallback } from 'react';
import type { Mission } from '@shared/services/missions';
import { fetchMissions, claimMissionReward } from '../services/missionService';

export function useMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const m = await fetchMissions();
      setMissions(m);
    } catch {
      // offline — retain existing state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const claimReward = useCallback(async (missionId: string) => {
    const claimed = await claimMissionReward(missionId);
    if (claimed) {
      setMissions(prev => prev.map(m => m.id === missionId ? { ...m, claimed: true } : m));
    }
  }, []);

  return { missions, loading, refreshing, refresh, claimReward };
}
