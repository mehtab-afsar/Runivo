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

export async function sendMessage(
  message: string,
  sessionToken: string,
): Promise<{ content: string; type?: string }> {
  const { data, error } = await supabase.functions.invoke('ai-coach', {
    body:    { feature: 'coach_chat', message },
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (error) throw error;
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
    if (error || !data) return null;
    const inner = (data as Record<string, unknown>).data ?? data;
    return inner as WeeklyBriefPayload;
  } catch {
    return null;
  }
}

export async function requestPostRunAnalysis(runId: string, sessionToken: string): Promise<PostRunPayload | null> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-coach', {
      body:    { feature: 'post_run', runId },
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (error || !data) return null;
    const inner = (data as Record<string, unknown>).data ?? data;
    return inner as PostRunPayload | null;
  } catch {
    return null;
  }
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
    { label: 'Build me a 5K training plan',           message: 'Build me a 5K training plan' },
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
