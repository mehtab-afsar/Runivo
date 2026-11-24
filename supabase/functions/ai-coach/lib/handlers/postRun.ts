// post_run: praise, analysis and one suggestion for a run that just finished,
// plus a recovery prescription when the runner logs nutrition.
import { readCache, writeCache } from '../aiCache.ts';
import { complete, logUsage, parseJsonReply, replyText } from '../anthropicClient.ts';
import type { AnthropicClient } from '../anthropicClient.ts';
import { runnerProfileLine } from '../contextFormat.ts';
import { contextHash, fmtDist, fmtDuration, fmtPaceSec, paceSecPerKm, todayISODate } from '../format.ts';
import { jsonResponse } from '../http.ts';
import { PERSONA_POST_RUN, postRunJsonShape, withGuardrails } from '../prompts.ts';
import type { Db, PostRunPayload, UserContext } from '../types.ts';

export async function handlePostRun(
  anthropic: AnthropicClient,
  supabase: Db,
  userId: string,
  runId: string,
  ctx: UserContext,
): Promise<PostRunPayload | null> {
  // IDOR fix: scope to the caller's own run. The client is service-role (bypasses
  // RLS), so without this owner filter any authenticated caller could request AI
  // analysis of any run by id.
  const { data: run } = await supabase
    .from('runs')
    .select('distance_m, duration_sec, avg_pace, started_at')
    .eq('id', runId)
    .eq('user_id', userId)
    .single();

  // Usually the run is still uploading (the summary screen asks right after it ends).
  if (!run) throw jsonResponse(404, { error: 'run_not_synced' });
  if ((run.distance_m ?? 0) < 500) return null;

  const input = { runId, distanceM: run.distance_m, durationSec: run.duration_sec };
  const hash  = await contextHash(input);

  const cached = await readCache(supabase, userId, 'post_run');
  if (cached?.context_hash === hash) return cached.payload as PostRunPayload;

  // Recent avg pace from ctx (last 4 weeks, excluding this run)
  const fourWeeksAgo  = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const recentOther   = ctx.runs90d.filter(r => r.id !== runId && r.started_at >= fourWeeksAgo);
  const mid           = Math.floor(recentOther.length / 2);
  const avgRecentPace = recentOther[mid]?.avg_pace ?? '–';

  // PR detection
  const historicFastest = ctx.runs90d
    .filter(r => r.id !== runId && (r.distance_m ?? 0) > 0 && (r.duration_sec ?? 0) > 0)
    .reduce((best, r) => Math.min(best, paceSecPerKm(r)), Infinity);
  const thisRunPace = run.duration_sec / (run.distance_m / 1000);
  const isPR        = historicFastest < Infinity && thisRunPace < historicFastest;

  // Pace zone
  let zoneName: string;
  if      (thisRunPace >= 390) zoneName = 'Easy';
  else if (thisRunPace >= 330) zoneName = 'Moderate';
  else if (thisRunPace >= 285) zoneName = 'Tempo';
  else                         zoneName = 'Hard';

  // Today's nutrition context (for recovery prescription)
  const todayStr     = todayISODate();
  const todayLog     = ctx.nutrition?.dailyLogs.find(d => d.date === todayStr) ?? null;
  const todayKcal    = todayLog?.kcal    ?? 0;
  const todayProtein = todayLog?.proteinG ?? 0;
  const targetKcal   = ctx.nutrition?.dailyGoalKcal ?? 0;
  const targetProtein = ctx.nutrition?.proteinGoalG  ?? 0;
  // Deno edge function can't import packages/shared — keep this constant in
  // sync with estimateRunCalories() in packages/shared/src/services/nutrition.ts.
  const caloriesBurned = Math.round((run.distance_m / 1000) * (ctx.nutrition?.weightKg ?? 70) * 1.036);
  const remaining    = Math.max(0, targetKcal - todayKcal + caloriesBurned);

  let recoveryInstruction = '';
  if (ctx.nutrition && targetKcal > 0) {
    recoveryInstruction = `
Today's nutrition: ${todayKcal} kcal consumed, ${todayProtein}g protein logged.
Run burned: ~${caloriesBurned} kcal. Remaining budget incl. burn: ${remaining} kcal.
Protein target: ${targetProtein}g. Protein still needed: ${Math.max(0, Math.round(targetProtein - todayProtein))}g.
${ctx.nutrition.daysUnderProtein80g >= 3 ? `Note: protein has been low ${ctx.nutrition.daysUnderProtein80g} of the last 7 days.` : ''}

Add a "recovery" field: a specific 2-sentence recovery prescription. Sentence 1: what to eat in the next 2 hours (be concrete — specific foods) and why. Sentence 2: reference today's logged nutrition numbers.`;
  }

  const distKm = fmtDist(run.distance_m);
  const dur    = fmtDuration(run.duration_sec);
  const pace   = run.avg_pace ?? fmtPaceSec(thisRunPace);

  const response = await complete(anthropic, {
    maxTokens: 192,
    system:    withGuardrails(PERSONA_POST_RUN),
    messages: [{
      role:    'user',
      content: `Post-run feedback.
This run: ${distKm} in ${dur}, pace ${pace}/km. Effort zone: ${zoneName}.
Recent avg pace (last 4 weeks): ${avgRecentPace}/km.
${runnerProfileLine(ctx)}
${isPR ? '★ THIS IS A NEW PERSONAL RECORD (fastest pace in last 90 days).' : ''}
${recoveryInstruction}

Respond ONLY with valid JSON (no markdown):
${postRunJsonShape(!!ctx.nutrition && targetKcal > 0)}

${isPR ? 'Acknowledge the PR in the praise.' : ''}`,
    }],
  });

  await logUsage(supabase, userId, 'post_run', response.usage);

  let payload: PostRunPayload;
  try {
    payload = parseJsonReply(replyText(response)) as PostRunPayload;
  } catch {
    payload = {
      praise:     `${isPR ? 'New personal record! ' : ''}Great effort on that ${distKm} run!`,
      analysis:   `You ran ${pace}/km — ${zoneName.toLowerCase()} effort zone.`,
      suggestion: 'Stay hydrated and aim for 7–8 hours of sleep tonight.',
    };
  }

  await writeCache(supabase, userId, 'post_run', payload, hash);

  return payload;
}
