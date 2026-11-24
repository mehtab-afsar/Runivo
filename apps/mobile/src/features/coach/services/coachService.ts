import { supabase } from '@shared/services/supabase';

export interface CoachMessage {
  id:              string;
  role:            'user' | 'assistant';
  content:         string;
  type?:           string;
  auto_triggered?: boolean;
  created_at:      string;
}

export interface TrainingWeek {
  week:    number;
  summary: string;
  days:    { day: string; workout: string }[];
}

export interface TrainingPlan {
  goal:  string;
  weeks: TrainingWeek[];
}

export interface QuickPrompt {
  label:   string;
  message: string;
}

export interface WeeklyBriefPayload {
  headline: string;
  insights: string[];
  tip:      string;
  nutrition?: {
    summary:    string;
    connection: string;
    priority:   string;
  };
}

export interface PostRunPayload {
  praise:    string;
  analysis:  string;
  suggestion: string;
  recovery?: string;
}

// Edge function wraps all responses as { data: result }.
// This helper extracts the actual reply and optional type tag.
function parseReply(raw: unknown): { content: string; type?: string } {
  if (typeof raw === 'string') return { content: raw };
  if (typeof raw !== 'object' || raw === null) return { content: 'No response' };
  const r = raw as Record<string, unknown>;
  const inner = r.data;
  if (typeof inner === 'string') return { content: inner };
  if (typeof inner === 'object' && inner !== null) {
    const i = inner as Record<string, unknown>;
    const content = String(i.reply ?? i.content ?? i.text ?? 'No response');
    const type = typeof i.type === 'string' ? i.type : undefined;
    return { content, type };
  }
  const content = String(r.reply ?? r.content ?? r.text ?? 'No response');
  const type = typeof r.type === 'string' ? r.type : undefined;
  return { content, type };
}

/** Why the coach call failed, from the function's status and error body. */
export type CoachFailure = 'consent' | 'plus' | 'limit' | 'unavailable' | 'auth' | 'server' | 'offline';
export class CoachError extends Error {
  constructor(public readonly kind: CoachFailure, message: string, public readonly status?: number) { super(message); }
}

/** supabase-js hides the status inside error.context (a Response); read it. */
async function coachError(error: unknown): Promise<CoachError> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.status === 'number') {
    let code = '';
    try { code = String((await ctx.clone().json())?.error ?? ''); } catch { /* not JSON */ }
    if (__DEV__) console.warn('[pacex] ai-coach failed', ctx.status, code);
    if (code === 'ai_consent_required' || (ctx.status === 403 && !code)) return new CoachError('consent', code || 'ai_consent_required', ctx.status);
    if (ctx.status === 402) return new CoachError('plus', code || 'plus_required', ctx.status);
    if (ctx.status === 429) return new CoachError('limit', code || 'daily_cap', ctx.status);
    if (ctx.status === 401) return new CoachError('auth', code || 'unauthorized', ctx.status);
    if (ctx.status === 404 && !code) return new CoachError('unavailable', 'function_not_deployed', ctx.status);
    if (/^ai_(not_configured|provider_|model_)/.test(code) || code === 'limit_check_failed') {
      return new CoachError('unavailable', code, ctx.status);
    }
    return new CoachError('server', `${ctx.status} ${code}`.trim(), ctx.status);
  }
  return new CoachError('offline', (error as Error)?.message ?? 'network');
}

export async function sendMessage(
  message: string,
  sessionToken: string,
): Promise<{ content: string; type?: string }> {
  const { data, error } = await supabase.functions.invoke('ai-coach', {
    body:    { feature: 'coach_chat', message },
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (error) throw await coachError(error);
  return parseReply(data);
}

export async function fetchCachedTrainingPlan(userId: string): Promise<TrainingPlan | null> {
  const { data } = await supabase
    .from('ai_cache')
    .select('payload')
    .eq('user_id', userId)
    .eq('feature', 'training_plan')
    .maybeSingle();
  return (data?.payload as TrainingPlan | undefined) ?? null;
}

export async function requestWeeklyBrief(sessionToken: string): Promise<WeeklyBriefPayload | null> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-coach', {
      body:    { feature: 'weekly_brief' },
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (error) { await coachError(error); return null; }
    if (!data) return null;
    const inner = (data as Record<string, unknown>).data ?? data;
    return inner as WeeklyBriefPayload;
  } catch {
    return null;
  }
}

export async function requestPostRunAnalysis(runId: string, sessionToken: string): Promise<PostRunPayload | null> {
  const { data, error } = await supabase.functions.invoke('ai-coach', {
    body:    { feature: 'post_run', runId },
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (error) throw await coachError(error);
  const inner = (data as Record<string, unknown> | null)?.data ?? null;
  return inner as PostRunPayload | null;
}

export async function requestNutritionAnalysis(sessionToken: string): Promise<{ content: string }> {
  const { data, error } = await supabase.functions.invoke('ai-coach', {
    body:    { feature: 'nutrition_insights' },
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (error) throw error;
  return parseReply(data);
}

export async function requestHabitTracking(sessionToken: string): Promise<{ content: string }> {
  const { data, error } = await supabase.functions.invoke('ai-coach', {
    body:    { feature: 'habit_tracking' },
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (error) throw error;
  return parseReply(data);
}

export async function getQuickPrompts(sessionToken: string): Promise<QuickPrompt[]> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-coach', {
      body:    { feature: 'quick_prompts' },
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (error) throw error;
    const prompts = (data as Record<string, unknown>)?.data ?? data;
    if (Array.isArray(prompts)) return prompts as QuickPrompt[];
  } catch { /* silently fall back to static prompts */ }
  return [
    { label: 'How can I improve my pace?',            message: 'How can I improve my pace?' },
    { label: 'What should I run next?',               message: 'What should my next run be, based on my plan and my last runs?' },
    { label: 'Analyse my last run',                   message: 'Analyse my most recent run' },
    { label: 'What to eat before a long run?',        message: 'What should I eat before a long run?' },
  ];
}

export async function loadMessageHistory(userId: string): Promise<CoachMessage[]> {
  const { data } = await supabase
    .from('coach_messages')
    .select('id, role, content, auto_triggered, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(50);
  return (data ?? []) as CoachMessage[];
}
