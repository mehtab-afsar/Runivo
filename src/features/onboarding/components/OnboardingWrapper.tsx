import { useState, useEffect, ReactNode } from 'react';
import { OnboardingFlow } from '../pages/OnboardingFlow';
import { LoadingScreen } from '@shared/ui/LoadingScreen';
import { supabase } from '@shared/services/supabase';
import { initialSync } from '@shared/services/sync';

interface OnboardingWrapperProps {
  children: ReactNode;
}

// Persist invite ref from URL so it survives page reloads / auth redirects.
// Called at MODULE LEVEL (not in useEffect) so it runs synchronously before
// React Router processes routes and clears the ?ref= query param via <Navigate>.
function captureInviteRef() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    sessionStorage.setItem('runivo-invite-ref', ref);
    // Clean the URL without triggering a reload
    const url = new URL(window.location.href);
    url.searchParams.delete('ref');
    window.history.replaceState({}, '', url.toString());
  }
}

// Run immediately when this module is first imported — before any component mounts
captureInviteRef();

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
