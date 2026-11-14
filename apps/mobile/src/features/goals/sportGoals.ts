/** P3: goals per sport — progress from local activities. */
import type { StoredRun, StoredSettings } from '@shared/services/store';
import { sportGroup } from '@features/profile/utils/profileStats';

export type SportGoal = NonNullable<StoredSettings['sportGoals']>[number];

export function periodStart(period: 'week' | 'month', now = Date.now()): number {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  if (period === 'month') { d.setDate(1); return d.getTime(); }
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function goalProgress(goal: SportGoal, runs: StoredRun[], now = Date.now()): number {
  const from = periodStart(goal.period, now);
  const mine = runs.filter(r => !r.excluded && r.startTime >= from && (goal.sport === 'all' || sportGroup(r.activityType) === goal.sport));
  return goal.metric === 'km'
    ? mine.reduce((n, r) => n + r.distanceMeters / 1000, 0)
    : mine.reduce((n, r) => n + r.durationSec / 3600, 0);
}

export const SPORT_NAME: Record<SportGoal['sport'], string> = { all: 'All sports', run: 'Run', walk: 'Walk', ride: 'Ride' };
export function goalLabel(g: SportGoal): string {
  return `${SPORT_NAME[g.sport]} · ${g.target} ${g.metric === 'km' ? 'km' : 'h'} a ${g.period}`;
}
