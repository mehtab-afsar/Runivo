// habit_tracking: a four-part habit analysis (streak, consistency, day pattern,
// one focus) posted into the coach chat as an assistant message.
import { complete, logUsage, replyText } from '../anthropicClient.ts';
import type { AnthropicClient } from '../anthropicClient.ts';
import { PERSONA_HABIT, withGuardrails } from '../prompts.ts';
import type { Db, UserContext } from '../types.ts';

export async function handleHabitTracking(
  anthropic: AnthropicClient,
  supabase: Db,
  userId: string,
  ctx: UserContext,
): Promise<string> {
  const pc      = ctx.planCompliance;
  const streak  = pc?.streakDays ?? 0;
  const history = pc?.consistencyLast8Weeks ?? [];
  const avg8w   = pc?.avgConsistencyLast8Weeks;

  // Recent run day pattern (last 28 days)
  const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const recentRuns = ctx.runs90d.filter(r => r.started_at >= twentyEightDaysAgo);
  const dayNames   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayCounts: Record<string, number> = {};
  for (const r of recentRuns) {
    const name = dayNames[new Date(r.started_at).getDay()];
    dayCounts[name] = (dayCounts[name] ?? 0) + 1;
  }
  const dayPattern = dayNames
    .map(d => `${d}:${dayCounts[d] ?? 0}`)
    .join(' ');

  const runLines = recentRuns.slice(0, 14).map(r => {
    const d = new Date(r.started_at);
    return `${dayNames[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}: ${((r.distance_m ?? 0) / 1000).toFixed(1)}km`;
  }).join(', ');

  const planSection = pc
    ? `TRAINING PLAN: "${pc.goal}" (Week ${pc.weekCurrent}/${pc.weeksTotal})
This week: ${pc.sessionsCompletedThisWeek}/${pc.sessionsPlannedThisWeek} sessions completed${pc.sessionsMissedThisWeek > 0 ? `, ${pc.sessionsMissedThisWeek} missed` : ', on track'}
Consistency last 8 weeks (oldest→newest): ${history.length > 0 ? history.join('%, ') + '%' : 'no history yet'}
8-week average: ${avg8w !== null ? avg8w + '%' : 'N/A'}`
    : 'No active training plan — running without a curriculum.';

  const content = `You are Pace, the Runivo running coach. Give ${ctx.runnerRank}-ranked runner a habit analysis.

STREAK: ${streak} day${streak !== 1 ? 's' : ''} current run streak

${planSection}

DAY PATTERN (last 28 days, runs per day):
${dayPattern}

RECENT RUNS:
${runLines || 'No recent runs.'}

Write a habit analysis in EXACTLY these 4 sections. Label each section clearly.

1. STREAK — Comment on the ${streak}-day streak specifically. Is ${streak} days impressive for their level? Compare to typical runners.
2. CONSISTENCY — Interpret the plan compliance data. What does the trend say — building, plateauing, declining?
3. PATTERN — Which days do they actually run vs avoid? Name the specific days. Is there a gap that hurts progress?
4. ONE FOCUS — One specific, actionable habit change. Not generic. Reference their actual data.

Be direct. Use real numbers. Under 220 words total. Conversational, not clinical.`;

  const response = await complete(anthropic, {
    maxTokens: 400,
    system:    withGuardrails(PERSONA_HABIT),
    messages:  [{ role: 'user', content }],
  });

  // Logged under its own feature so it counts against habit_tracking's spend,
  // not the tighter chat-specific daily cap.
  await logUsage(supabase, userId, 'habit_tracking', response.usage);

  const reply = replyText(response);

  await supabase.from('coach_messages').insert({
    user_id:    userId,
    role:       'assistant',
    content:    reply,
    created_at: new Date().toISOString(),
  });

  return reply;
}
