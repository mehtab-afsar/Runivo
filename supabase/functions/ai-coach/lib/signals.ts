// ─── Coaching priority engine ───────────────────────────────────────────────
// The single place that decides "what actually matters most for this runner
// right now" from their full context. Two consumers: the quick-prompt handler
// and the coach-chat system prompt, so an open-ended "what should I focus on"
// question and the quick-prompt suggestions agree with each other instead of
// being two independent guesses.
import type { UserContext } from './types.ts';

export type SignalPriority = 'high' | 'medium' | 'low';

export interface CoachSignal {
  key:        string;
  priority:   SignalPriority;
  headline:   string;
  detail:     string;
  /** A first-person question a runner might ask about this signal — reused
   *  as-is for quick-prompt suggestions. */
  promptSeed: string;
}

const PRIORITY_WEIGHT: Record<SignalPriority, number> = { high: 3, medium: 2, low: 1 };

export function rankSignals(ctx: UserContext): CoachSignal[] {
  const signals: CoachSignal[] = [];

  // Inactivity — the highest-leverage moment to re-engage, so it outranks
  // everything else when it applies at all.
  const lastRun   = ctx.runs90d[0];
  const daysSince = lastRun ? Math.floor((Date.now() - new Date(lastRun.started_at).getTime()) / 86_400_000) : 999;
  if (daysSince >= 4) {
    signals.push({
      key: 'inactivity', priority: 'high',
      headline: `${daysSince} days since your last run`,
      detail:   `Longest gap recently — worth a deliberate, easy comeback run rather than jumping back in at full effort.`,
      promptSeed: `It's been ${daysSince} days since my last run. Help me plan a good comeback run based on my fitness.`,
    });
  }

  // Plan adherence — missed sessions this week, only meaningful if a plan exists.
  if (ctx.planCompliance && ctx.planCompliance.sessionsMissedThisWeek > 0) {
    signals.push({
      key: 'plan_behind', priority: 'high',
      headline: `${ctx.planCompliance.sessionsMissedThisWeek} planned session${ctx.planCompliance.sessionsMissedThisWeek > 1 ? 's' : ''} missed this week`,
      detail:   `Week ${ctx.planCompliance.weekCurrent}/${ctx.planCompliance.weeksTotal} of "${ctx.planCompliance.goal}" — ${ctx.planCompliance.sessionsCompletedThisWeek}/${ctx.planCompliance.sessionsPlannedThisWeek} done.`,
      promptSeed: `I've missed ${ctx.planCompliance.sessionsMissedThisWeek} planned sessions this week. Should I adapt the rest of the week or just pick back up?`,
    });
  }

  // Pace trend — declining is the one that needs attention; improving is worth
  // reinforcing but isn't urgent.
  if (ctx.trend === 'declining' && ctx.runs90d.length >= 4) {
    signals.push({
      key: 'declining_trend', priority: 'high',
      headline: 'Pace has been declining',
      detail:   `Last 4 weeks are slower than the 4 before that — could be fatigue, heat, or just a rough patch.`,
      promptSeed: 'My pace has been declining recently. Based on my data, what could be causing it and how do I fix it?',
    });
  }

  // Territory decay — competitive/game-layer urgency, medium by default,
  // escalates to high once a meaningful share of ground is actually stale.
  if (ctx.staleZoneCount > 0) {
    signals.push({
      key: 'stale_territory', priority: ctx.staleZoneCount >= 3 ? 'high' : 'medium',
      headline: `${ctx.staleZoneCount} zone${ctx.staleZoneCount > 1 ? 's' : ''} going stale`,
      detail:   `Average freshness ${ctx.avgFreshness}% — rivals can steal these now.`,
      promptSeed: `I have ${ctx.staleZoneCount} stale zones. What's the best route to defend them this week?`,
    });
  }

  // Upcoming race — high if it's genuinely close, otherwise not urgent.
  if (ctx.nutrition?.daysUntilEvent !== null && ctx.nutrition?.daysUntilEvent !== undefined) {
    const d = ctx.nutrition.daysUntilEvent;
    signals.push({
      key: 'near_event', priority: d <= 14 ? 'high' : 'medium',
      headline: `${d} day${d !== 1 ? 's' : ''} until your race`,
      detail:   d <= 14 ? 'Taper and fueling matter more than extra volume from here.' : 'Still time to build — worth checking the plan is on track to peak correctly.',
      promptSeed: `I have a race in ${d} days. What should I focus on between now and then?`,
    });
  }

  // Weekly volume — meaningfully behind pace vs. this runner's own recent
  // average, not an absolute threshold. Suppressed by inactivity above (same
  // underlying problem, no need to say it twice).
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const thisWeekKm   = ctx.runs90d.filter(r => r.started_at >= sevenDaysAgo).reduce((s, r) => s + (r.distance_m ?? 0) / 1000, 0);
  const weeklyGoal   = ctx.weeklyKm * 1.1;
  if (daysSince < 4 && weeklyGoal > 0 && thisWeekKm < weeklyGoal * 0.5) {
    signals.push({
      key: 'behind_weekly_volume', priority: 'medium',
      headline: `${thisWeekKm.toFixed(1)} km this week, behind your own pace`,
      detail:   `Typical week is ~${ctx.weeklyKm.toFixed(1)} km — this week's under half that so far.`,
      promptSeed: `I'm only at ${thisWeekKm.toFixed(1)} km this week. Help me catch up to my weekly goal without overtraining.`,
    });
  }

  // Nutrition — protein consistency, medium (not acute unless it's persistent).
  if (ctx.nutrition && ctx.nutrition.daysUnderProtein80g >= 3) {
    signals.push({
      key: 'low_protein', priority: 'medium',
      headline: `Protein under 80g on ${ctx.nutrition.daysUnderProtein80g} of the last 7 days`,
      detail:   `Recent avg: ${ctx.nutrition.recentAvgProteinG}g vs a ${ctx.nutrition.proteinGoalG}g goal.`,
      promptSeed: `I've been under 80g protein for ${ctx.nutrition.daysUnderProtein80g} days this week. How should I adjust my diet to support my training?`,
    });
  }

  // Gear — low priority, informational rather than urgent.
  const wornShoe = ctx.shoes.find(s => s.pctWorn >= 85 && s.isDefault);
  if (wornShoe) {
    signals.push({
      key: 'shoe_worn', priority: 'low',
      headline: `${wornShoe.name} at ${wornShoe.pctWorn}% worn`,
      detail:   `${wornShoe.totalKm}/${wornShoe.maxKm} km on your default pair.`,
      promptSeed: `My main running shoes (${wornShoe.name}) are at ${wornShoe.pctWorn}% worn. Should I replace them now and what should I look for?`,
    });
  }

  // Positive reinforcement signals — always low priority (never the lead, but
  // worth surfacing when nothing more pressing is going on).
  if (ctx.trend === 'improving' && ctx.runs90d.length >= 4) {
    signals.push({
      key: 'improving_trend', priority: 'low',
      headline: "Pace has been improving",
      detail:   'Last 4 weeks are faster than the 4 before — worth building on with a clear next goal.',
      promptSeed: "My pace has been improving lately. Based on my current fitness, what should my next goal be?",
    });
  }

  return signals.sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
}
