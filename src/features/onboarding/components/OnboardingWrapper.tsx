import { useState, useEffect, ReactNode } from 'react';
import { OnboardingFlow } from '../pages/OnboardingFlow';
import { LoadingScreen } from '@shared/ui/LoadingScreen';
import { supabase } from '@shared/services/supabase';
import { initialSync } from '@shared/services/sync';

interface OnboardingWrapperProps {
  children: ReactNode;
}

export function OnboardingWrapper({ children }: OnboardingWrapperProps) {
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    // E2E test bypass — skip real auth when running under Playwright
    if (import.meta.env.VITE_E2E_TEST_MODE === 'true') {
      setComplete(true);
      setReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const onboarded = localStorage.getItem('runivo-onboarding-complete') === 'true';
      const isComplete = !!session && onboarded;
      setComplete(isComplete);
      setReady(true);
      // Pull profile + runs + territories from Supabase on every authenticated boot
      if (isComplete) initialSync().catch(() => {});
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        setComplete(false);
      } else if (event === 'SIGNED_IN') {
        // Re-sync when user signs in (e.g. after token refresh or new login)
        initialSync().catch(() => {});
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return <LoadingScreen />;
  if (!complete) return <OnboardingFlow onComplete={() => setComplete(true)} />;
  return <>{children}</>;
}
