import { useState, useEffect, useCallback } from 'react';
import type { LeaderboardEntry, LeaderboardTab, LeaderboardTimeFrame, LeaderboardScope } from '../types';
import { fetchLeaderboard } from '../services/leaderboardService';
import { supabase } from '@shared/services/supabase';

export interface LeaderboardState {
  entries: LeaderboardEntry[];
  loading: boolean;
  tab: LeaderboardTab;
  timeFrame: LeaderboardTimeFrame;
  scope: LeaderboardScope;
  unit: string;
  currentUserId: string | undefined;
  setTab: (t: LeaderboardTab) => void;
  setTimeFrame: (tf: LeaderboardTimeFrame) => void;
  setScope: (s: LeaderboardScope) => void;
}

export function useLeaderboard(): LeaderboardState {
  const [tab, setTab] = useState<LeaderboardTab>('distance');
  const [timeFrame, setTimeFrame] = useState<LeaderboardTimeFrame>('week');
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLeaderboard(tab, timeFrame, scope);
      setEntries(data);
    } catch { /* offline */ } finally {
      setLoading(false);
    }
  }, [tab, timeFrame, scope]);

  useEffect(() => { load(); }, [load]);

  const unit = tab === 'distance' ? 'km' : tab === 'xp' ? 'XP' : '⚡';

  return { entries, loading, tab, timeFrame, scope, unit, currentUserId, setTab, setTimeFrame, setScope };
}
