import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@shared/services/supabase';
import type { TrainingPlan, PlannedSession } from '@shared/types/game';

export type SessionStatus = 'planned' | 'completed' | 'missed';

export interface SessionWithStatus extends PlannedSession {
  status:      SessionStatus;
  sessionDate: string; // YYYY-MM-DD
}

export function usePlanScreen() {
  const [plan, setPlan]       = useState<TrainingPlan | null>(null);
  const [sessions, setSessions] = useState<SessionWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setPlan(null); setSessions([]); return; }

      const { data: planRow } = await supabase
        .from('training_plans')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!planRow) { setPlan(null); setSessions([]); return; }

      // Auto-advance week_current based on calendar weeks elapsed since plan creation.
      // Monday of the plan-creation week = week 1. Each subsequent Monday = next week.
      const planCreatedAt  = new Date(planRow.created_at);
      const createdDay     = planCreatedAt.getDay(); // 0=Sun
      const toMonday       = createdDay === 0 ? -6 : 1 - createdDay;
      const planStartMonday = new Date(planCreatedAt);
      planStartMonday.setDate(planCreatedAt.getDate() + toMonday);
      planStartMonday.setHours(0, 0, 0, 0);

      const msPerWeek    = 7 * 24 * 60 * 60 * 1000;
      const weeksElapsed = Math.floor((Date.now() - planStartMonday.getTime()) / msPerWeek);
      const correctWeek  = Math.min(planRow.weeks_total, weeksElapsed + 1);

      if (correctWeek > planRow.week_current) {
        await supabase
          .from('training_plans')
          .update({ week_current: correctWeek, updated_at: new Date().toISOString() })
          .eq('id', planRow.id);
        planRow.week_current = correctWeek;
      }

      // Mark plan complete when all weeks are done and it's past the final Sunday
      if (planRow.week_current >= planRow.weeks_total && weeksElapsed >= planRow.weeks_total) {
        await supabase
          .from('training_plans')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', planRow.id);
        setPlan(null);
        setSessions([]);
        return;
      }

      const tp: TrainingPlan = {
        id:          planRow.id,
        userId:      planRow.user_id,
        goal:        planRow.goal,
        goalRaceDate: planRow.goal_race_date ?? undefined,
        weeksTotal:  planRow.weeks_total,
        weekCurrent: planRow.week_current,
        status:      planRow.status,
        planData:    planRow.plan_data,
        createdAt:   planRow.created_at,
        updatedAt:   planRow.updated_at,
      };
      setPlan(tp);

      const weekIdx     = tp.weekCurrent - 1;
      const currentWeek = tp.planData.weeks[weekIdx];
      if (!currentWeek) { setSessions([]); return; }

      // Mon of the current week
      const today      = new Date();
      const dayOfWeek  = today.getDay();
      const diff       = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday     = new Date(today);
      monday.setDate(today.getDate() + diff);
      monday.setHours(0, 0, 0, 0);

      // Runs this week to detect completed sessions + compute km_actual
      const { data: runs } = await supabase
        .from('runs')
        .select('started_at, distance_m')
        .eq('user_id', session.user.id)
        .gte('started_at', monday.toISOString());

      const runDates = new Set(
        (runs ?? []).map(r => new Date(r.started_at).toLocaleDateString('en-CA'))
      );
      const todayStr = today.toLocaleDateString('en-CA');

      const DAY_MAP: Record<string, number> = {
        Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
      };

      const withStatus: SessionWithStatus[] = currentWeek.sessions.map(s => {
        const offset      = DAY_MAP[s.day] ?? 0;
        const sessionDate = new Date(monday);
        sessionDate.setDate(monday.getDate() + offset);
        const sessionDateStr = sessionDate.toLocaleDateString('en-CA');

        let status: SessionStatus = 'planned';
        if (s.type === 'Rest') {
          status = sessionDateStr <= todayStr ? 'completed' : 'planned';
        } else if (runDates.has(sessionDateStr)) {
          status = 'completed';
        } else if (sessionDateStr < todayStr) {
          status = 'missed';
        }

        return { ...s, status, sessionDate: sessionDateStr };
      });

      setSessions(withStatus);

      // Persist this week's consistency score to DB (fire-and-forget, enables trend history)
      const runSessions    = withStatus.filter(s => s.type !== 'Rest');
      const completedCount = withStatus.filter(s => s.status === 'completed' && s.type !== 'Rest').length;
      const missedCount    = withStatus.filter(s => s.status === 'missed').length;
      const score          = runSessions.length > 0
        ? Math.round((completedCount / runSessions.length) * 100)
        : 100;
      const kmActual = (runs ?? []).reduce((s, r) => s + (r.distance_m ?? 0) / 1000, 0);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('streak_days')
        .eq('id', session.user.id)
        .maybeSingle();

      Promise.resolve(supabase.from('weekly_consistency').upsert({
        user_id:            session.user.id,
        week_start:         monday.toLocaleDateString('en-CA'),
        plan_id:            tp.id,
        sessions_planned:   runSessions.length,
        sessions_completed: completedCount,
        sessions_missed:    missedCount,
        km_actual:          parseFloat(kmActual.toFixed(2)),
        consistency_score:  score,
        streak_days_eow:    profileData?.streak_days ?? 0,
      }, { onConflict: 'user_id,week_start' })).then(() => {}).catch(() => {});

    } catch {
      // silently fail — plan UI is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { plan, sessions, loading, reload: load };
}
