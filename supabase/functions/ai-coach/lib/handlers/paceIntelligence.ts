// pace_intelligence: three insight cards (pacing pattern, weekly load, one
// improvement) from the last 30 runs. Cached against the run count and pace summary.
import { readCache, writeCache } from '../aiCache.ts';
import { complete, logUsage, parseJsonReply, replyText } from '../anthropicClient.ts';
import type { AnthropicClient } from '../anthropicClient.ts';
import { runnerProfileLine } from '../contextFormat.ts';
import { contextHash } from '../format.ts';
import { PACE_INSIGHTS_JSON_SHAPE, PERSONA_PACE, withGuardrails } from '../prompts.ts';
import type { Db, PaceIntelligencePayload, UserContext } from '../types.ts';

export async function handlePaceIntelligence(
  anthropic: AnthropicClient,
  supabase: Db,
  userId: string,
  ctx: UserContext,
): Promise<PaceIntelligencePayload> {
  const recentRuns = ctx.runs90d.slice(0, 30);
  const hash = await contextHash({
    runCount: recentRuns.length,
    lastDate: recentRuns[0]?.started_at?.slice(0, 10),
    avgPace: ctx.easyPace,
    weeklyKm: Math.round(ctx.weeklyKm),
    trend: ctx.trend,
    paceEarned: ctx.paceWeeklyEarned,
  });

  const cached = await readCache(supabase, userId, 'pace_intelligence');
  if (cached?.context_hash === hash) return cached.payload as PaceIntelligencePayload;

  const prompt = `You are Pace, the Runivo running coach. Analyze this runner's data and return exactly 3 insight cards as JSON.

RUNNER: ${ctx.totalKm90d.toFixed(1)} km in 90 days, ${recentRuns.length} runs, trend: ${ctx.trend}
EASY PACE: ${ctx.easyPace} /km, TEMPO: ${ctx.tempoPace} /km
WEEKLY AVG (last 8 weeks): ${ctx.weeklyKm.toFixed(1)} km/wk
${runnerProfileLine(ctx)}
BEST: longest ${ctx.prs.longestRun.toFixed(1)} km, fastest pace ${ctx.prs.fastestPace ?? 'N/A'}

Generate 3 insight cards. Each must cite SPECIFIC numbers from the data. Do not be generic.
Required types: (1) PACING pattern, (2) WEEKLY LOAD trend, (3) ONE concrete improvement.

Return ONLY valid JSON:
${PACE_INSIGHTS_JSON_SHAPE}`;

  const response = await complete(anthropic, {
    maxTokens: 400,
    system:    withGuardrails(PERSONA_PACE),
    messages:  [{ role: 'user', content: prompt }],
  });

  await logUsage(supabase, userId, 'pace_intelligence', response.usage);

  let parsed: PaceIntelligencePayload;
  try {
    const raw = parseJsonReply(replyText(response)) as { insights?: PaceIntelligencePayload['insights'] };
    parsed = { insights: raw.insights ?? [], generatedAt: new Date().toISOString() };
  } catch {
    parsed = { insights: [], generatedAt: new Date().toISOString() };
  }

  await writeCache(supabase, userId, 'pace_intelligence', parsed, hash);

  return parsed;
}
