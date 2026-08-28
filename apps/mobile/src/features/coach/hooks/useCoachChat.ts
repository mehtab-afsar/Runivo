import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@shared/services/supabase';
import {
  sendMessage as apiSendMessage,
  loadMessageHistory,
  requestTrainingPlan,
  requestHabitTracking,
  requestNutritionAnalysis,
  requestWeeklyBrief,
  fetchCachedTrainingPlan,
  getQuickPrompts,
  type CoachMessage,
  type TrainingPlan,
  type WeeklyBriefPayload,
  type QuickPrompt,
} from '../services/coachService';

export function useCoachChat() {
  const [messages, setMessages]         = useState<CoachMessage[]>([]);
  const [sending, setSending]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [inputText, setInputText]       = useState('');
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null);
  const [planLoading, setPlanLoading]   = useState(false);
  const [planOpen, setPlanOpen]         = useState(false);
  const [goalInput, setGoalInput]       = useState('');
  const [brief, setBrief]               = useState<WeeklyBriefPayload | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>([]);
  const lastSentMsgRef = useRef<string>('');
  // Replies that arrived live this session (vs. loaded from history on mount) —
  // MessageBubble uses this to decide which messages get the reveal animation,
  // so reopening the chat doesn't replay it for every past message.
  const [liveMessageIds, setLiveMessageIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const history = await loadMessageHistory(user.id);
      if (history.length > 0) setMessages(history);

      const cached = await fetchCachedTrainingPlan(user.id);
      if (cached) setTrainingPlan(cached);
    }).catch(() => {});
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? inputText).trim();
    if (!msg || sending) return;
    lastSentMsgRef.current = msg;
    setInputText('');
    setSending(true);
    setError(null);

    const optimistic: CoachMessage = {
      id: `opt-${Date.now()}`, role: 'user', content: msg, created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const { content, type } = await apiSendMessage(msg, session.access_token);
      const aiMsg: CoachMessage = {
        id: `opt-reply-${Date.now()}`, role: 'assistant', content, type, created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setLiveMessageIds(prev => new Set(prev).add(aiMsg.id));
    } catch (e: unknown) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setError((e as Error)?.message ?? 'Failed to send');
    } finally {
      setSending(false);
    }
  }, [inputText, sending]);

  const generatePlan = useCallback(async (): Promise<boolean> => {
    if (!goalInput.trim() || planLoading) return false;
    setPlanLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const plan = await requestTrainingPlan(goalInput.trim(), session.access_token);
      setTrainingPlan(plan);
      return true;
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to generate plan');
      return false;
    } finally {
      setPlanLoading(false);
    }
  }, [goalInput, planLoading]);

  const requestHabitAnalysis = useCallback(async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const { content } = await requestHabitTracking(session.access_token);
      const aiMsg: CoachMessage = {
        id: `opt-habit-${Date.now()}`, role: 'assistant', content, created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setLiveMessageIds(prev => new Set(prev).add(aiMsg.id));
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load habit analysis');
    } finally {
      setSending(false);
    }
  }, [sending]);

  const requestNutritionCoach = useCallback(async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const { content } = await requestNutritionAnalysis(session.access_token);
      const aiMsg: CoachMessage = {
        id: `opt-nutrition-${Date.now()}`, role: 'assistant', content, created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setLiveMessageIds(prev => new Set(prev).add(aiMsg.id));
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load nutrition analysis');
    } finally {
      setSending(false);
    }
  }, [sending]);

  // Pushes a structured result (post_run/weekly_brief payload) straight into the
  // message list as a rendered card — no coach_chat round-trip, no coach_messages
  // insert. Mirrors how post_run/weekly_brief are cache-backed, not chat-log-backed.
  const showCard = useCallback((payload: object, type = 'insight') => {
    const msg: CoachMessage = {
      id: `card-${Date.now()}`, role: 'assistant', content: JSON.stringify(payload), type,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    setLiveMessageIds(prev => new Set(prev).add(msg.id));
  }, []);

  const loadBrief = useCallback(async () => {
    setBriefLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const result = await requestWeeklyBrief(session.access_token);
      setBrief(result);
    } finally {
      setBriefLoading(false);
    }
  }, []);

  const loadQuickPrompts = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const prompts = await getQuickPrompts(session.access_token);
      setQuickPrompts(prompts);
    } catch { /* keep whatever's already loaded (or empty, falls back to static) */ }
  }, []);

  const togglePlanOpen = useCallback(() => setPlanOpen(o => !o), []);

  const retryLastMessage = useCallback(() => {
    if (lastSentMsgRef.current) sendMessage(lastSentMsgRef.current);
  }, [sendMessage]);

  return {
    messages,
    liveMessageIds,
    sending,
    error,
    inputText,
    trainingPlan,
    planLoading,
    planOpen,
    goalInput,
    brief,
    briefLoading,
    quickPrompts,
    sendMessage,
    retryLastMessage,
    generatePlan,
    requestHabitAnalysis,
    requestNutritionCoach,
    showCard,
    loadBrief,
    loadQuickPrompts,
    setInputText,
    setGoalInput,
    togglePlanOpen,
  };
}
