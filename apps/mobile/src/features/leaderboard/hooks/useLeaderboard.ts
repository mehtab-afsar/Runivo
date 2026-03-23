import { useState, useEffect, useCallback } from 'react';
import type { LeaderboardEntry, LeaderboardTab, LeaderboardTimeFrame } from '../types';
import { fetchLeaderboard } from '../services/leaderboardService';

export interface LeaderboardState {
  entries: LeaderboardEntry[];
  loading: boolean;
  tab: LeaderboardTab;
  timeFrame: LeaderboardTimeFrame;
  unit: string;
  setTab: (t: LeaderboardTab) => void;
  setTimeFrame: (tf: LeaderboardTimeFrame) => void;
}

export function useLeaderboard(): LeaderboardState {
  const [tab, setTab] = useState<LeaderboardTab>('distance');
  const [timeFrame, setTimeFrame] = useState<LeaderboardTimeFrame>('week');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLeaderboard(tab, timeFrame);
      setEntries(data);
    } catch { /* offline */ } finally {
      setLoading(false);
    }
  }, [tab, timeFrame]);

  useEffect(() => { load(); }, [load]);

  const unit = tab === 'distance' ? 'km' : tab === 'xp' ? 'XP' : '⚡';

  return { entries, loading, tab, timeFrame, unit, setTab, setTimeFrame };
}
