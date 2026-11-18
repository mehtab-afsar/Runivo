import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseFiveKTime, validateUsername, startingWeeklyTargetKm } from '@shared/engine/onboarding';
import { track } from '@shared/services/analytics';
import { supabase } from '@shared/services/supabase';
import { saveOnboardingData, saveIdentity } from '../services/onboardingService';
import { stepsFor, type OnboardingData, type OnboardingStepKey, type OnboardingVariant } from '../types';

const DEFAULT_DATA: OnboardingData = {
  lastKnownLocation: null, country: null,
  goal: null,
  runsPerWeek: 3, usualKm: 5, fiveKInput: '',
  healthConsent: false, healthBaseline: null,
  ageRange: null, gender: null, heightCm: null, weightKg: null,
  username: '', avatarUri: null,
  notificationsEnabled: false,
  distanceUnit: 'km',
  raceDistance: null, raceWeeks: 10, raceGoalInput: '',
  runDays: [1, 3, 5, 6], longRunDay: 6, usualTime: null, weekdayMinutes: 45,
  niggles: [], returning: false,
  paceXTone: null,
};

export interface OnboardingState {
  index: number;
  label: string;
  variant: OnboardingVariant;
  stepKey: OnboardingStepKey;
  total: number;
  optional: boolean;
  data: OnboardingData;
  loading: boolean;
  error: string;
  weeklyTargetKm: number;
  update: <K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) => void;
  canContinue: () => boolean;
  goNext: () => Promise<void>;
  skip: () => void;
  goBack: () => void;
  submit: () => Promise<boolean>;
}

export function useOnboarding(): OnboardingState {
  const [index, setIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // O4: the path variant is picked once per install and kept.
  const [variant, setVariant] = useState<OnboardingVariant>('full');
  useEffect(() => {
    AsyncStorage.getItem('runivo.onboardingVariant').then(v => {
      const pick: OnboardingVariant = v === 'short' || v === 'full' ? v : (Math.random() < 0.5 ? 'short' : 'full');
      if (!v) AsyncStorage.setItem('runivo.onboardingVariant', pick).catch(() => {});
      setVariant(pick);
      track('onboarding_variant', { variant: pick });
    }).catch(() => {});
  }, []);
  const STEPS = stepsFor(variant, data.goal);

  // Draft: answers and step survive the app being killed mid-onboarding (an OS kill at step 7
  // used to send people back to step 1). Keyed by account so another user on this phone never
  // inherits it; dropped once onboarding is submitted.
  const draftKeyRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const key = session?.user.id ? `runivo.onboardingDraft.${session.user.id}` : null;
        draftKeyRef.current = key;
        const raw = key ? await AsyncStorage.getItem(key) : null;
        if (raw && !cancelled) {
          const d = JSON.parse(raw) as { index?: number; data?: Partial<OnboardingData> };
          if (d.data) setData(prev => ({ ...prev, ...d.data }));
          if (typeof d.index === 'number' && d.index > 0) setIndex(d.index);
        }
        // The name picked on the sign-up form: don't ask for it twice. Still editable here.
        const picked = session?.user.user_metadata?.username;
        if (!cancelled && typeof picked === 'string' && validateUsername(picked).ok) {
          setData(prev => (prev.username ? prev : { ...prev, username: picked }));
        }
      } catch { /* a bad or missing draft just means starting fresh */ }
      hydratedRef.current = true;
    })();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!hydratedRef.current || !draftKeyRef.current) return;
    AsyncStorage.setItem(draftKeyRef.current, JSON.stringify({ index, data })).catch(() => {});
  }, [index, data]);

  const step = STEPS[Math.min(index, STEPS.length - 1)];
  const weeklyTargetKm = startingWeeklyTargetKm({
    runsPerWeek: data.runsPerWeek,
    usualKm: data.usualKm,
    goal: data.goal ?? 'get_fit',
    healthAvgWeeklyKm: data.healthConsent ? data.healthBaseline?.avgWeeklyKm : null,
  });

  const update = useCallback(<K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) => {
    setError('');
    setData(prev => ({ ...prev, [key]: val }));
  }, []);

  const canContinue = useCallback(() => {
    switch (step.key) {
      case 'goal':     return data.goal != null;
      case 'running':  return parseFiveKTime(data.fiveKInput).ok;
      case 'week':     return data.runDays.length > 0;
      case 'identity': return validateUsername(data.username).ok;
      default:         return true;
    }
  }, [step.key, data.goal, data.fiveKInput, data.username, data.runDays.length]);

  const advance = useCallback(() => {
    track('onboarding_step_done', { step: step.key, index, variant });
    setIndex(i => Math.min(i + 1, STEPS.length - 1));
  }, [step.key, index, variant, STEPS.length]);

  const goNext = useCallback(async () => {
    if (!canContinue() || loading) return;
    if (step.key === 'identity') {
      setLoading(true); setError('');
      try {
        await saveIdentity(data.username, data.avatarUri);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save your name.');
        return;
      } finally {
        setLoading(false);
      }
    }
    advance();
  }, [canContinue, loading, step.key, data.username, data.avatarUri, advance]);

  const skip = useCallback(() => {
    if (!step.optional) return;
    track('onboarding_step_skipped', { step: step.key, variant });
    if (step.key === 'about') {
      setData(d => ({ ...d, ageRange: null, gender: null, heightCm: null, weightKg: null }));
    }
    if (step.key === 'health') {
      setData(d => ({ ...d, healthConsent: false, healthBaseline: null }));
    }
    if (step.key === 'body') {
      setData(d => ({ ...d, niggles: [], returning: false }));
    }
    setIndex(i => Math.min(i + 1, STEPS.length - 1));
  }, [step, variant, STEPS.length]);

  const goBack = useCallback(() => {
    setError('');
    setIndex(i => Math.max(0, i - 1));
  }, []);

  const submit = useCallback(async () => {
    setLoading(true); setError('');
    try {
      await saveOnboardingData(data, variant);
      if (draftKeyRef.current) AsyncStorage.removeItem(draftKeyRef.current).catch(() => {});
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Setup failed. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [data, variant]);

  return {
    index, label: step.label, variant, stepKey: step.key, total: STEPS.length, optional: step.optional,
    data, loading, error, weeklyTargetKm,
    update, canContinue, goNext, skip, goBack, submit,
  };
}
