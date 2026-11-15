/**
 * The runner's real training plan (training_plans, version 2) for PaceX's
 * screen: this week's sessions and today's, from the same store the plan
 * builder and onboarding write.
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchActivePlan, getCachedPlan, localToday, type ActivePlan } from '@features/training/services/planService';
import { weekOf, sessionOn, type PlanWeek, type Session } from '@shared/engine/training';

export function useActivePlan() {
  const [active, setActive] = useState<ActivePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const cached = await getCachedPlan().catch(() => null);
    if (cached) setActive(cached);
    const fresh = await fetchActivePlan().catch(() => null);
    setActive(fresh ?? cached);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const today = localToday();
  const plan = active?.plan ?? null;
  const week: PlanWeek | null = plan ? weekOf(plan, today) : null;
  const todaySession: Session | null = plan ? sessionOn(plan, today) : null;
  return { plan, loading, reload: load, week, weeksTotal: plan?.weeks.length ?? 0, today, todaySession };
}
