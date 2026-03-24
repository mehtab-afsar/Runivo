import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@shared/services/supabase';
import {
  sendMessage as apiSendMessage,
  loadMessageHistory,
  requestTrainingPlan,
  fetchCachedTrainingPlan,
  type CoachMessage,
  type TrainingPlan,
} from '../services/intelligenceService';

export function useCoachChat() {
  const [messages, setMessages]         = useState<CoachMessage[]>([]);
  const [sending, setSending]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [inputText, setInputText]       = useState('');
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null);
  const [planLoading, setPlanLoading]   = useState(false);
  const [planOpen, setPlanOpen]         = useState(false);
  const [goalInput, setGoalInput]       = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }: { data: { user: { id: string } | null } }) => {
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
      const reply = await apiSendMessage(msg, session.access_token);
      setMessages(prev => [...prev, {
        id: `opt-reply-${Date.now()}`, role: 'assistant', content: reply, created_at: new Date().toISOString(),
      }]);
    } catch (e: unknown) {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }, [inputText, sending]);

  const generatePlan = useCallback(async () => {
    if (!goalInput.trim() || planLoading) return;
    setPlanLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const plan = await requestTrainingPlan(goalInput.trim(), session.access_token);
      setTrainingPlan(plan);
      setPlanOpen(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate plan');
    } finally {
      setPlanLoading(false);
    }
  }, [goalInput, planLoading]);

  return {
    messages, sending, error, inputText, trainingPlan,
    planLoading, planOpen, goalInput,
    sendMessage, generatePlan,
    setInputText, setGoalInput,
    togglePlanOpen: () => setPlanOpen(o => !o),
  };
}
