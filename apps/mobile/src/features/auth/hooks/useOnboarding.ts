import { useState, useCallback } from 'react';
import { computeWeeklyGoal } from '@shared/services/profile';
import { saveOnboardingData } from '../services/onboardingService';
import type { OnboardingData, OnboardingStep } from '../types';
import { DIST_CHIPS } from '../types';

const DEFAULT_DATA: OnboardingData = {
  age: 25, gender: '',
  heightCm: 170, weightKg: 70,
  experienceLevel: 'casual', primaryGoal: 'get_fit',
  weeklyFrequency: 3, preferredDistance: '5k',
  distanceUnit: 'km', notificationsEnabled: true, plan: 'free',
};

export interface OnboardingState {
  step: OnboardingStep;
  data: OnboardingData;
  selectedDays: number[];
  loading: boolean;
  error: string;
  weeklyKmDisplay: number;
  weeklyGoalKm: number;
  distKm: number;
  update: <K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) => void;
  toggleDay: (i: number) => void;
  canContinue: () => boolean;
  goNext: () => void;
  goBack: () => void;
  setStep: (s: OnboardingStep) => void;
  submit: () => Promise<void>;
}

export function useOnboarding(onComplete: () => void): OnboardingState {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA);
  const [selectedDays, setSelectedDays] = useState([1, 3, 5]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const distKm = DIST_CHIPS.find(d => d.key === data.preferredDistance)?.km ?? 5;
  const weeklyKmDisplay = selectedDays.length * distKm;
  const weeklyGoalKm = computeWeeklyGoal(data.weeklyFrequency, data.preferredDistance);

  const update = useCallback(<K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) => {
    setData(prev => ({ ...prev, [key]: val }));
  }, []);

  const toggleDay = useCallback((i: number) => {
    setSelectedDays(prev => {
      const next = prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i];
      const clamped = next.length === 0 ? [i] : next;
      setData(d => ({ ...d, weeklyFrequency: clamped.length }));
      return clamped;
    });
  }, []);

  const canContinue = useCallback(() => {
    if (step === 2) return data.gender !== '';
    return true;
  }, [step, data.gender]);

  const goNext = useCallback(() => {
    if (step < 7) setStep((step + 1) as OnboardingStep);
  }, [step]);

  const goBack = useCallback(() => {
    if (step > 1) setStep((step - 1) as OnboardingStep);
  }, [step]);

  // canContinue overrides: step 2 requires gender selection
  // step 5 (PlanSelection) is always continuable — the step manages its own CTA

  const submit = useCallback(async () => {
    setLoading(true); setError('');
    try {
      await saveOnboardingData(data, weeklyGoalKm);
      onComplete();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [data, weeklyGoalKm, onComplete]);

  return {
    step, data, selectedDays, loading, error,
    weeklyKmDisplay, weeklyGoalKm, distKm,
    update, toggleDay, canContinue, goNext, goBack,
    setStep: (s) => setStep(s),
    submit,
  };
}
