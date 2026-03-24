import { supabase } from '@shared/services/supabase';

export interface CoachMessage {
  id:         string;
  role:       'user' | 'assistant';
  content:    string;
  created_at: string;
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

export interface NutritionInsightsCard {
  icon: string;
  title: string;
  body: string;
}

export interface NutritionInsights {
  headline: string;
  tip: string;
  insights: string[];
  cards: NutritionInsightsCard[];
  generatedAt: string;
  nutrition: { protein: number; carbs: number; fat: number };
}

export async function sendMessage(message: string, sessionToken: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-coach', {
    body: { feature: 'coach_chat', message },
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (error) throw error;
  return typeof data === 'string' ? data : data?.reply ?? data?.content ?? 'No response';
}

export async function fetchCachedTrainingPlan(userId: string): Promise<TrainingPlan | null> {
  const { data } = await supabase
    .from('ai_cache')
    .select('value')
    .eq('user_id', userId)
    .eq('key', 'training_plan')
    .maybeSingle();
  return data?.value ?? null;
}

export async function requestTrainingPlan(goal: string, sessionToken: string): Promise<TrainingPlan> {
  const { data, error } = await supabase.functions.invoke('ai-coach', {
    body: { feature: 'training_plan', goal },
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (error) throw error;
  return data as TrainingPlan;
}

export async function loadMessageHistory(userId: string): Promise<CoachMessage[]> {
  const { data } = await supabase
    .from('coach_messages')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(50);
  return (data ?? []) as CoachMessage[];
}

export async function getIntelligence(): Promise<null> {
  return null;
}
