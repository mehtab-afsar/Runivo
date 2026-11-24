// quick_prompts: up to four suggested questions for the chat, taken from the
// ranked coaching signals (the same ranking coach_chat reasons from) and
// topped up with evergreen prompts. No model call.
import { rankSignals } from '../signals.ts';
import type { QuickPrompt, UserContext } from '../types.ts';

const FALLBACK_PROMPTS: QuickPrompt[] = [
  { label: "What's my next session?",        message: 'What should my next run be, based on my plan and how my last runs went?' },
  { label: 'Analyse my last run',            message: 'Analyse my most recent run and tell me what it reveals about my current fitness.' },
  { label: 'How to improve my pace?',        message: 'Based on my recent runs, what is the most effective way for me to improve my pace?' },
  { label: 'What to eat before a long run?', message: 'What should I eat the day before and morning of a long run, based on my nutrition goals?' },
];

export function handleQuickPrompts(ctx: UserContext): QuickPrompt[] {
  const prompts = rankSignals(ctx)
    .slice(0, 4)
    .map(s => ({ label: `${s.headline} →`, message: s.promptSeed }));

  for (const fb of FALLBACK_PROMPTS) {
    if (prompts.length >= 4) break;
    if (!prompts.some(p => p.message === fb.message)) prompts.push(fb);
  }

  return prompts.slice(0, 4);
}
