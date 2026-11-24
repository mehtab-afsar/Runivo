// coach_chat: one free-text turn. Stores both sides of the conversation in
// coach_messages and answers from the last 12 messages plus the runner's data.
import { complete, logUsage, replyText } from '../anthropicClient.ts';
import type { AnthropicClient } from '../anthropicClient.ts';
import { buildCoachSystemPrompt, withGuardrails } from '../prompts.ts';
import type { Db, UserContext } from '../types.ts';

export async function handleCoachChat(
  anthropic: AnthropicClient,
  supabase: Db,
  userId: string,
  userMessage: string,
  ctx: UserContext,
): Promise<string> {
  await supabase.from('coach_messages').insert({ user_id: userId, role: 'user', content: userMessage });

  const { data: history } = await supabase
    .from('coach_messages')
    .select('role, content')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12);

  // Merge same-role neighbours (auto debriefs, failed sends), drop empties, and
  // open with the runner: the Messages API wants alternating turns, user first.
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const m of (history ?? []).reverse() as Array<{ role: 'user' | 'assistant'; content: string }>) {
    if (!m.content?.trim()) continue;
    const last = messages[messages.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${m.content}`;
    else messages.push({ role: m.role, content: m.content });
  }
  while (messages.length && messages[0].role !== 'user') messages.shift();

  const response = await complete(anthropic, {
    maxTokens: 800,
    // withGuardrails appends the shared SAFETY_GUARDRAILS block, so this handler
    // (the one with the most free-text conversation) can't drift from the rules
    // every other handler shares.
    system:    withGuardrails(buildCoachSystemPrompt(ctx)),
    messages,
  });

  await logUsage(supabase, userId, 'coach_chat', response.usage);

  const assistantText = replyText(response);

  await supabase.from('coach_messages').insert({ user_id: userId, role: 'assistant', content: assistantText });

  return assistantText;
}
