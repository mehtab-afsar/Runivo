// weekly_brief: the headline, three insights and a tip for the week. Cached
// against a hash of the inputs that matter, so repeat opens cost nothing.
import { readCache, writeCache } from '../aiCache.ts';
import { complete, logUsage, parseJsonReply, replyText } from '../anthropicClient.ts';
import type { AnthropicClient } from '../anthropicClient.ts';
import { formatBriefNutrition, formatBriefPlan, formatBriefPrLine, formatBriefRaceLine, runnerProfileLine } from '../contextFormat.ts';
import { contextHash } from '../format.ts';
import { PERSONA_WEEKLY_BRIEF, WEEKLY_BRIEF_NUTRITION_INSTRUCTION, weeklyBriefJsonShape, withGuardrails } from '../prompts.ts';
import type { Db, UserContext, WeeklyBriefPayload } from '../types.ts';

export async function handleWeeklyBrief(
  anthropic: AnthropicClient,
  supabase: Db,
  userId: string,
  ctx: UserContext,
): Promise<WeeklyBriefPayload> {
  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString();
  const runList   = ctx.runs90d.filter(r => r.started_at >= eightWeeksAgo);
  const totalKm   = runList.reduce((s, r) => s + (r.distance_m ?? 0) / 1000, 0);
  const totalRuns = runList.length;
  const avgPace   = runList[Math.floor(runList.length / 2)]?.avg_pace ?? '–';
  const lastRunId = runList[0]?.id ?? null;

  // True cold start — nothing to analyse yet. Return an honest empty state
  // instead of asking Claude to manufacture encouragement from zero data;
  // skip the cache write since there's nothing meaningful to cache.
  if (totalRuns === 0) {
    return {
      headline: 'No runs yet — let\'s fix that.',
      insights: [],
      tip:      'Log your first run and I\'ll have real numbers to work with.',
    };
  }

  const hashInput = {
    lastRunId,
    totalRuns,
    totalKm: totalKm.toFixed(1),
    trend:   ctx.trend,
    paceZones: ctx.paceZones,
    fastestPace: ctx.prs.fastestPace,
    // bust if nutrition changes significantly
    daysHitKcal:      ctx.nutrition?.daysHitKcalTarget ?? null,
    avgProtein:       ctx.nutrition?.recentAvgProteinG ?? null,
    paceWeeklyEarned: ctx.paceWeeklyEarned,
    staleZoneCount:   ctx.staleZoneCount,
    territoryScore:   ctx.territoryScore,
    planWeek:         ctx.planCompliance?.weekCurrent ?? null,
    planDone:         ctx.planCompliance?.sessionsCompletedThisWeek ?? null,
    planLastWeek:     ctx.planCompliance?.lastWeek ?? null,
  };
  const hash = await contextHash(hashInput);

  const cached = await readCache(supabase, userId, 'weekly_brief');
  if (cached?.context_hash === hash) return cached.payload as WeeklyBriefPayload;

  const nutritionBlock = ctx.nutrition ? formatBriefNutrition(ctx.nutrition, runList) : '';
  const nutritionJsonInstruction = ctx.nutrition ? WEEKLY_BRIEF_NUTRITION_INSTRUCTION : '';
  const planBlock = formatBriefPlan(ctx.planCompliance);
  const prLine    = formatBriefPrLine(ctx);
  const raceLine  = formatBriefRaceLine(ctx);

  const response = await complete(anthropic, {
    maxTokens: 384,
    system:    withGuardrails(PERSONA_WEEKLY_BRIEF),
    messages: [{
      role:    'user',
      content: `Runner data — last 8 weeks:
Total: ${totalKm.toFixed(1)} km across ${totalRuns} runs. Weekly avg: ${ctx.weeklyKm} km/wk.
${runnerProfileLine(ctx)}
Avg pace: ${avgPace}/km. Trend: ${ctx.trend}.
Pace zones: ${ctx.paceZones.easy}% easy / ${ctx.paceZones.moderate}% moderate / ${ctx.paceZones.tempo}% tempo / ${ctx.paceZones.hard}% hard.
${prLine}
${raceLine}
${planBlock}${nutritionBlock}
Territory status:
- PACE earned this week: ${ctx.paceWeeklyEarned} / ${ctx.paceWeeklyCapLimit}
- Territory Score: ${ctx.territoryScore} TS
- Stale zones: ${ctx.staleZoneCount} (easy to steal by rivals)
- Average freshness: ${ctx.avgFreshness}%

Respond ONLY with valid JSON (no markdown fences):
${weeklyBriefJsonShape(!!ctx.nutrition)}

Be specific to their numbers. Reference actual paces and distances.
${nutritionJsonInstruction}`,
    }],
  });

  await logUsage(supabase, userId, 'weekly_brief', response.usage);

  let payload: WeeklyBriefPayload;
  try {
    payload = parseJsonReply(replyText(response)) as WeeklyBriefPayload;
  } catch {
    payload = {
      headline:  `${totalKm.toFixed(0)} km banked — keep building.`,
      insights:  [`${totalRuns} runs completed.`, `Avg pace: ${avgPace}/km.`, `Trend: ${ctx.trend}.`],
      tip:       'Add one tempo run this week to push your pace forward.',
    };
  }

  await writeCache(supabase, userId, 'weekly_brief', payload, hash);

  return payload;
}
