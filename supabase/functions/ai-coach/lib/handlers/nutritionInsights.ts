// nutrition_insights: 3-4 cards on how the last 14 days of food lined up with
// the runner's training. Cached against the latest run and log date.
import { readCache, writeCache } from '../aiCache.ts';
import { complete, logUsage, parseJsonReply, replyText } from '../anthropicClient.ts';
import type { AnthropicClient } from '../anthropicClient.ts';
import { contextHash } from '../format.ts';
import { NUTRITION_CARDS_JSON_SHAPE, PERSONA_NUTRITION, withGuardrails } from '../prompts.ts';
import type { Db, NutritionInsightsPayload, UserContext } from '../types.ts';

export async function handleNutritionInsights(
  anthropic: AnthropicClient,
  supabase: Db,
  userId: string,
  ctx: UserContext,
): Promise<NutritionInsightsPayload> {
  if (!ctx.nutrition) {
    return { cards: [], generatedAt: new Date().toISOString() };
  }

  const n          = ctx.nutrition;
  const lastRunId  = ctx.runs90d[0]?.id ?? null;
  const lastLogDate = n.dailyLogs[n.dailyLogs.length - 1]?.date ?? null;
  const hash       = await contextHash({
    lastRunId, lastLogDate,
    avgProtein: n.recentAvgProteinG, daysHit: n.daysHitKcalTarget,
  });

  const cached = await readCache(supabase, userId, 'nutrition_insights');
  if (cached?.context_hash === hash) return cached.payload as NutritionInsightsPayload;

  // Build day-by-day run+nutrition table for Claude
  const runDates = new Set(ctx.runs90d.map(r => r.started_at.split('T')[0]));
  const logTable = n.dailyLogs.slice(-14).map(d => {
    const ran = runDates.has(d.date);
    return `${d.date}: ${ran ? 'RUN' : 'rest'} | ${Math.round(d.kcal)} kcal | ${Math.round(d.proteinG)}g protein | ${Math.round(d.carbsG)}g carbs`;
  }).join('\n');

  const response = await complete(anthropic, {
    maxTokens: 512,
    system:    withGuardrails(PERSONA_NUTRITION),
    messages: [{
      role:    'user',
      content: `Analyse this runner's last 14 days of nutrition and training data and generate 3-4 insight cards.

Protein goal: ${n.proteinGoalG}g/day. Calorie goal: ${n.dailyGoalKcal} kcal/day.
Days/nutrition for last 14 days:
${logTable}

Generate 3-4 cards that reveal patterns. Look for:
- Run-day vs rest-day nutrition differences
- Pre-run fuelling patterns (did they eat the day before big runs?)
- Protein consistency and its correlation with run performance
- Calorie deficit/surplus patterns

Respond ONLY with valid JSON (no markdown):
${NUTRITION_CARDS_JSON_SHAPE}

Be specific: reference actual grams, days, and patterns you can see in the data. Do not give generic nutrition advice.`,
    }],
  });

  await logUsage(supabase, userId, 'nutrition_insights', response.usage);

  let payload: NutritionInsightsPayload;
  try {
    const parsed = parseJsonReply(replyText(response)) as { cards?: NutritionInsightsPayload['cards'] };
    payload = { cards: parsed.cards ?? [], generatedAt: new Date().toISOString() };
  } catch {
    payload = {
      cards: [{
        title: 'Log more data',
        body:  'Keep logging meals for a week and I\'ll find patterns in your nutrition and running.',
        icon:  '📊',
      }],
      generatedAt: new Date().toISOString(),
    };
  }

  await writeCache(supabase, userId, 'nutrition_insights', payload, hash);

  return payload;
}
