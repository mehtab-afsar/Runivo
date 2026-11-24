// Turns a UserContext into the text blocks the prompts interpolate. Pure string
// formatting: nothing here fetches data or calls the model.
import { rankSignals } from './signals.ts';
import type { NutritionContext, NutritionDayLog, PlanCompliance, RunRecord, UserContext } from './types.ts';

/** One line on who the runner is, from onboarding. Read by every prompt. */
export function runnerProfileLine(ctx: UserContext): string {
  const r = ctx.runner;
  const parts: string[] = [];
  if (r.goal) parts.push(`Goal: ${r.goal}`);
  if (r.experience) parts.push(`level: ${r.experience}`);
  if (r.weeklyRuns) parts.push(`${r.weeklyRuns} runs/week`);
  if (r.usualDistanceKm) parts.push(`usual run ${r.usualDistanceKm} km`);
  if (r.declaredWeeklyKm) parts.push(`weekly target ${r.declaredWeeklyKm} km`);
  if (r.recent5kSeconds) {
    const m = Math.floor(r.recent5kSeconds / 60), sec = String(r.recent5kSeconds % 60).padStart(2, '0');
    parts.push(`recent 5K ${m}:${sec}`);
  }
  if (r.ageRange) parts.push(`age ${r.ageRange}`);
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (r.raceDistance && r.raceDate) {
    const goal = r.raceGoalSeconds ? `, goal ${Math.floor(r.raceGoalSeconds / 3600)}:${String(Math.floor((r.raceGoalSeconds % 3600) / 60)).padStart(2, '0')}:${String(r.raceGoalSeconds % 60).padStart(2, '0')}` : '';
    parts.push(`racing a ${r.raceDistance} on ${r.raceDate}${goal}`);
  }
  if (r.runDays?.length) parts.push(`runs on ${r.runDays.map(d => DAYS[d] ?? '?').join('/')}${r.longRunDay != null ? `, long run ${DAYS[r.longRunDay]}` : ''}`);
  if (r.usualRunTime) parts.push(`usually runs ${r.usualRunTime}`);
  if (r.weekdayMinutes) parts.push(`about ${r.weekdayMinutes} min on weekdays`);
  let line = `RUNNER: ${parts.length ? parts.join(', ') : 'no onboarding answers yet'}. Coach in a ${r.tone} tone.`;
  if (r.niggles.length || r.returningFromBreak) {
    line += `\nBODY: ${[r.niggles.length ? `reported niggles: ${r.niggles.join(', ')}` : '', r.returningFromBreak ? 'coming back from an injury or a break' : ''].filter(Boolean).join('; ')}. Keep load conservative, space hard days, avoid loading these areas (for a sore knee or shin: fewer downhills and hard surfaces). Never encourage running through pain; suggest rest and a physio if pain persists.`;
  }
  // New runners have little history here; use the imported baseline instead.
  if (ctx.runs90d.length < 5 && r.healthBaseline) {
    line += `\nIMPORTED 90-DAY BASELINE (health app, consented): ${JSON.stringify(r.healthBaseline).slice(0, 600)}`;
  }
  return line;
}

// ─── Weekly brief blocks ──────────────────────────────────────────────────────

/** Nutrition lines for the weekly brief (run-day vs rest-day protein included). */
export function formatBriefNutrition(n: NutritionContext, runList: RunRecord[]): string {
  // Compute run-day vs rest-day protein averages
  const runDates = new Set(runList.map(r => r.started_at.split('T')[0]));
  const runDayLogs  = n.dailyLogs.filter(d => runDates.has(d.date));
  const restDayLogs = n.dailyLogs.filter(d => !runDates.has(d.date));
  const avg = (arr: NutritionDayLog[], key: keyof NutritionDayLog) =>
    arr.length > 0 ? Math.round(arr.reduce((s, d) => s + (d[key] as number), 0) / arr.length) : 0;
  const runDayProtein  = avg(runDayLogs,  'proteinG');
  const restDayProtein = avg(restDayLogs, 'proteinG');

  const avgDeficit  = n.dailyGoalKcal - n.recentAvgKcal;
  const deficitLine = avgDeficit >= 0
    ? `Avg daily deficit: ${avgDeficit} kcal`
    : `Avg daily surplus: ${Math.abs(avgDeficit)} kcal`;

  return `
Nutrition last 7 days:
- Hit calorie target (±10%): ${n.daysHitKcalTarget}/7 days
- ${deficitLine} (goal: ${n.dailyGoalKcal} kcal/day, avg consumed: ${n.recentAvgKcal} kcal/day)
- Average protein: ${n.recentAvgProteinG}g vs ${n.proteinGoalG}g target
- Days under 80g protein: ${n.daysUnderProtein80g}
- Run-day protein avg: ${runDayProtein}g | Rest-day protein avg: ${restDayProtein}g
`;
}

/** Training-plan lines for the weekly brief; empty when the runner has no plan. */
export function formatBriefPlan(pc: PlanCompliance | null): string {
  return pc ? `
Training plan: ${pc.goal}, week ${pc.weekCurrent} of ${pc.weeksTotal}.${pc.race ? ` ${pc.race}.` : ''}
${pc.lastWeek ? `- Last week: ${pc.lastWeek.done} of ${pc.lastWeek.planned} sessions done` : '- First week of the plan'}
- This week so far: ${pc.sessionsCompletedThisWeek} of ${pc.sessionsPlannedThisWeek} done, ${pc.sessionsMissedThisWeek} missed, ${pc.kmActualThisWeek} km run
${pc.upcoming.length ? `- Coming up:\n  ${pc.upcoming.join('\n  ')}` : ''}
One insight must be about the plan: how last week went and what matters most in the sessions coming up. The app may offer to ease this week if sessions were missed; never invent extra sessions.
` : '';
}

export function formatBriefPrLine(ctx: UserContext): string {
  return ctx.prs.fastestPace
    ? `Fastest pace (90 days): ${ctx.prs.fastestPace}/km. Longest run: ${ctx.prs.longestRun} km.` : '';
}

export function formatBriefRaceLine(ctx: UserContext): string {
  return ctx.racePredictions
    ? `Predicted race times: 5K ${ctx.racePredictions.fiveK} | 10K ${ctx.racePredictions.tenK} | Half ${ctx.racePredictions.half}.` : '';
}

// ─── Coach chat blocks ────────────────────────────────────────────────────────

/** The last 20 runs, one line each, with heart rate / cadence / elevation / calories when logged. */
export function formatRecentRunLines(runs90d: RunRecord[]): string {
  return runs90d.slice(0, 20).map(r => {
    const d    = new Date(r.started_at);
    const date = `${d.getMonth() + 1}/${d.getDate()}`;
    const km   = ((r.distance_m ?? 0) / 1000).toFixed(1);
    const pace = r.avg_pace ?? '–';
    const min  = Math.round((r.duration_sec ?? 0) / 60);
    const extras: string[] = [];
    if (r.avg_hr)           extras.push(`HR ${r.avg_hr}bpm`);
    if (r.avg_cadence)      extras.push(`${r.avg_cadence}spm`);
    if (r.elevation_gain_m) extras.push(`↑${Math.round(r.elevation_gain_m)}m`);
    if (r.calories_kcal)    extras.push(`${r.calories_kcal}kcal`);
    const extraStr = extras.length ? ` [${extras.join(', ')}]` : '';
    return `${date}: ${km}km @ ${pace}/km (${min}min)${extraStr}`;
  }).join('\n');
}

export function formatPrLines(ctx: UserContext): string {
  return [
    ctx.prs.fastestPace ? `Fastest pace: ${ctx.prs.fastestPace}/km`  : '',
    ctx.prs.longestRun  ? `Longest run: ${ctx.prs.longestRun} km`     : '',
    ctx.prs.best5kPace  ? `Best 5K pace: ${ctx.prs.best5kPace}/km`   : '',
  ].filter(Boolean).join(' | ');
}

export function formatChatRaceLine(ctx: UserContext): string {
  return ctx.racePredictions
    ? `Race predictions: 5K ${ctx.racePredictions.fiveK} | 10K ${ctx.racePredictions.tenK} | Half ${ctx.racePredictions.half} | Full ${ctx.racePredictions.full}`
    : 'Not enough run data for race predictions yet.';
}

export function formatNutritionLine(ctx: UserContext): string {
  return ctx.nutrition
    ? `Daily goal: ${ctx.nutrition.dailyGoalKcal} kcal | Protein goal: ${ctx.nutrition.proteinGoalG}g | Goal: ${ctx.nutrition.goal} | Recent 7-day avg: ${ctx.nutrition.recentAvgKcal} kcal / ${ctx.nutrition.recentAvgProteinG}g protein | Days hit target: ${ctx.nutrition.daysHitKcalTarget}/7 | Days under 80g protein: ${ctx.nutrition.daysUnderProtein80g}/7`
    : 'No nutrition data logged.';
}

/**
 * The top three ranked signals. The same ranking drives handleQuickPrompts, so
 * the model reasons from an explicit priority order instead of inferring
 * importance from the raw stats on its own.
 */
export function formatSignalsBlock(ctx: UserContext): string {
  const topSignals = rankSignals(ctx).slice(0, 3);
  return topSignals.length > 0
    ? topSignals.map((s, i) => `${i + 1}. [${s.priority.toUpperCase()}] ${s.headline} — ${s.detail}`).join('\n')
    : 'Nothing urgent — this runner is on track. Lead with encouragement and a forward-looking suggestion rather than manufacturing a problem.';
}

/** The "TRAINING PLAN & HABIT" section body. */
export function formatPlanSection(ctx: UserContext): string {
  const pc = ctx.planCompliance;
  if (!pc) return 'No active training plan. Current run streak: 0 days.';
  return `Goal: ${pc.goal} (Week ${pc.weekCurrent}/${pc.weeksTotal})${pc.race ? `
Race: ${pc.race}` : ''}${pc.upcoming.length ? `
Planned next (from their plan in the app):
${pc.upcoming.join('\n')}` : ''}
This week: ${pc.sessionsCompletedThisWeek}/${pc.sessionsPlannedThisWeek} sessions completed, ${pc.kmActualThisWeek} km run${pc.sessionsMissedThisWeek > 0 ? `, ${pc.sessionsMissedThisWeek} missed` : ' — on track'}
Run streak: ${pc.streakDays} day${pc.streakDays !== 1 ? 's' : ''}${pc.avgConsistencyLast8Weeks !== null ? `
Avg consistency last 8 weeks: ${pc.avgConsistencyLast8Weeks}%` : ''}`;
}

/** The "GEAR" section body. */
export function formatGearSection(ctx: UserContext): string {
  return ctx.shoes.length > 0
    ? ctx.shoes.map(s => `${s.isDefault ? '[default] ' : ''}${s.name}: ${s.totalKm}km / ${s.maxKm}km (${s.pctWorn}% worn${s.pctWorn >= 85 ? ', NEAR RETIREMENT' : ''})`).join('\n')
    : 'No shoes tracked yet.';
}
