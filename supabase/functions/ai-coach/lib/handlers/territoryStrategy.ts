// territory_strategy: a three-run plan to defend and expand the runner's ground.
// Not cached and not stored: it is a one-off reply.
import { complete, replyText } from '../anthropicClient.ts';
import type { AnthropicClient } from '../anthropicClient.ts';
import { PERSONA_TERRITORY, withGuardrails } from '../prompts.ts';
import type { UserContext } from '../types.ts';

export async function handleTerritoryStrategy(
  anthropic: AnthropicClient,
  ctx: UserContext,
): Promise<string> {
  const staleDesc = ctx.staleZoneCount > 0
    ? `${ctx.staleZoneCount} stale zone(s) with avg freshness ${ctx.avgFreshness}% — rivals can steal these now.`
    : 'All zones are currently fresh (freshness ≥ 40).';

  const recentRunLines = ctx.runs90d.slice(0, 5)
    .map(r => `- ${((r.distance_m ?? 0) / 1000).toFixed(1)}km at ${r.avg_pace ?? '–'}/km`)
    .join('\n');

  const response = await complete(anthropic, {
    maxTokens: 400,
    system:    withGuardrails(PERSONA_TERRITORY),
    messages: [{
      role:    'user',
      content: `Plan a territory strategy for ${ctx.runnerRank}-ranked runner.

TERRITORY STATUS:
- Score: ${ctx.territoryScore} TS | Largest tier: ${ctx.largestTierHeld}
- Total area: ${Math.round(ctx.totalAreaM2).toLocaleString()} m²
- ${staleDesc}
- PACE this week: ${ctx.paceWeeklyEarned} / ${ctx.paceWeeklyCapLimit}

RECENT RUNS:
${recentRunLines || 'No recent runs.'}

Give a specific 3-run strategy: which zones to prioritize defending, optimal route types (loop for park capture vs corridor for street claiming), and how to balance defense vs expansion given their current fitness. Under 250 words. Be competitive — frame it as protecting their empire.`,
    }],
  });

  return replyText(response);
}
