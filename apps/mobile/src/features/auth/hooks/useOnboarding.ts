import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseFiveKTime, validateUsername, startingWeeklyTargetKm } from '@shared/engine/onboarding';
import { track } from '@shared/services/analytics';
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
  const STEPS = stepsFor(variant);

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
      case 'identity': return validateUsername(data.username).ok;
      default:         return true;
    }
  }, [step.key, data.goal, data.fiveKInput, data.username]);

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
