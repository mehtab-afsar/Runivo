import { useState, useEffect, useMemo } from 'react';
import type { StoredRun } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import { requestPaceIntelligence } from '../../coach/services/coachService';
import type { PaceInsightCard } from '../../coach/services/coachService';
import type { PersonalRecord } from './useProfile';

export type { PaceInsightCard };

function isoWeekStart(d: Date): string {
  const day = new Date(d);
  const dow = day.getDay() === 0 ? 6 : day.getDay() - 1;
  day.setDate(day.getDate() - dow);
  day.setHours(0, 0, 0, 0);
  return day.toISOString().slice(0, 10);
}

export function computeWeeklyKm(runs: StoredRun[], weeks: number): number[] {
  const map: Record<string, number> = {};
  for (const r of runs) {
    const key = isoWeekStart(new Date(r.startTime));
    map[key] = (map[key] ?? 0) + r.distanceMeters / 1000;
  }
  const result: number[] = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    const key = isoWeekStart(d);
    result.push(map[key] ?? 0);
  }
  return result;
}

export function computeTrendLabel(weeklyKm: number[]): string {
  if (weeklyKm.length < 4) return 'Not enough data yet';
  const recentSlice = weeklyKm.slice(-4);
  const prevSlice = weeklyKm.slice(-8, -4);
  const recentAvg = recentSlice.reduce((s, v) => s + v, 0) / recentSlice.length;
  const prevAvg = prevSlice.length > 0
    ? prevSlice.reduce((s, v) => s + v, 0) / prevSlice.length
    : 0;
  if (prevAvg === 0) return `Building · ${recentAvg.toFixed(1)} km/wk avg`;
  const pct = ((recentAvg - prevAvg) / prevAvg) * 100;
  if (pct > 10) return `Building ↑ · +${Math.round(pct)}% vs last month`;
  if (pct < -10) return `Tapering ↓ · ${Math.round(Math.abs(pct))}% below last month`;
  return `Consistent · ${recentAvg.toFixed(1)} km/wk avg`;
}

function fmtPaceSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function computePersonalRecordsLocal(runs: StoredRun[]): PersonalRecord[] {
  if (runs.length === 0) return [];
  let longestKm = 0;
  let fastestPaceSec = Infinity;
  let best5kPaceSec = Infinity;
  let mostZones = 0;

  for (const r of runs) {
    const km = r.distanceMeters / 1000;
    if (km > longestKm) longestKm = km;
    if (km > 0 && r.durationSec > 0) {
      const paceSec = r.durationSec / km;
      if (paceSec < fastestPaceSec) fastestPaceSec = paceSec;
      if (km >= 4.8 && paceSec < best5kPaceSec) best5kPaceSec = paceSec;
    }
    if (r.territoriesClaimed.length > mostZones) mostZones = r.territoriesClaimed.length;
  }

  return [
    { label: 'Longest run', value: longestKm > 0 ? `${longestKm.toFixed(1)} km` : '—' },
    { label: 'Best pace', value: fastestPaceSec < Infinity ? `${fmtPaceSec(fastestPaceSec)}/km` : '—' },
    { label: 'Best 5K pace', value: best5kPaceSec < Infinity ? `${fmtPaceSec(best5kPaceSec)}/km` : '—' },
    { label: 'Most zones', value: mostZones > 0 ? String(mostZones) : '—' },
  ];
}

export interface WeeklyConsistency {
  week_start:         string;
  consistency_score:  number;
  sessions_completed: number;
  sessions_planned:   number;
  km_actual:          number;
  streak_days_eow:    number;
}

export function useIntelligence(runs: StoredRun[]) {
  const [insights, setInsights] = useState<PaceInsightCard[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [consistencyHistory, setConsistencyHistory] = useState<WeeklyConsistency[]>([]);

  useEffect(() => {
    (async () => {
      setInsightsLoading(true);
      const session = await supabase.auth.getSession();
      if (!session.data.session) { setInsightsLoading(false); return; }

      const [insightResult] = await Promise.allSettled([
        requestPaceIntelligence(session.data.session.access_token),
        supabase
          .rpc('get_consistency_history', {
            p_user_id: session.data.session.user.id,
            p_weeks: 8,
          })
          .then(({ data }) => { setConsistencyHistory((data ?? []) as WeeklyConsistency[]); }),
      ]);

      if (insightResult.status === 'fulfilled') {
        setInsights(insightResult.value?.insights ?? []);
      }
      setInsightsLoading(false);
    })();
  }, []);

  const personalRecords = useMemo(() => computePersonalRecordsLocal(runs), [runs]);
  const weeklyKm = useMemo(() => computeWeeklyKm(runs, 8), [runs]);
  const trendLabel = useMemo(() => computeTrendLabel(weeklyKm), [weeklyKm]);

  return { insights, insightsLoading, personalRecords, weeklyKm, trendLabel, consistencyHistory };
}
