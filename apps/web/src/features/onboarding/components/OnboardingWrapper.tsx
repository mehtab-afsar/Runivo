import { useState, useEffect, ReactNode } from 'react';
import { LandingPage }    from '@features/landing/pages/LandingPage';
import { LoginPage }      from '@features/landing/pages/LoginPage';
import { SignUpPage }     from '@features/landing/pages/SignUpPage';
import { OnboardingFlow } from '@features/onboarding/pages/OnboardingFlow';
import { LoadingScreen }  from '@shared/ui/LoadingScreen';
import { supabase, supabaseConfigured } from '@shared/services/supabase';
import { initialSync } from '@shared/services/sync';
import { getSettings } from '@shared/services/store';

interface OnboardingWrapperProps {
  children: ReactNode;
}

type AuthView = 'landing' | 'login' | 'signup' | 'onboarding';

// Persist invite ref from URL so it survives page reloads / auth redirects.
function captureInviteRef() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    sessionStorage.setItem('runivo-invite-ref', ref);
    const url = new URL(window.location.href);
    url.searchParams.delete('ref');
    window.history.replaceState({}, '', url.toString());
  }
}

captureInviteRef();

export function OnboardingWrapper({ children }: OnboardingWrapperProps) {
  const [ready,    setReady]    = useState(false);
  const [complete, setComplete] = useState(false);
  const [view,     setView]     = useState<AuthView>('landing');

  useEffect(() => {
    let cancelled = false;

    if (import.meta.env.VITE_E2E_TEST_MODE === 'true') {
      setComplete(true);
      setReady(true);
      return;
    }

    if (!supabaseConfigured) {
      const onboarded = localStorage.getItem('runivo-onboarding-complete') === 'true';
      setComplete(onboarded);
      setReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      const onboarded  = localStorage.getItem('runivo-onboarding-complete') === 'true';
      const isComplete = !!session && onboarded;
      setComplete(isComplete);
      setReady(true);
      if (isComplete) initialSync().catch(() => {});
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (!session) {
        setComplete(false);
      } else if (event === 'SIGNED_IN') {
        initialSync().catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!complete) {
      document.documentElement.classList.remove('dark');
    } else {
      getSettings().then(s => {
        if (s.darkMode) document.documentElement.classList.add('dark');
        else            document.documentElement.classList.remove('dark');
      });
    }
  }, [ready, complete]);

  const done = () => setComplete(true);

  if (!ready)    return <LoadingScreen />;
  if (!complete) {
    if (view === 'onboarding') return <OnboardingFlow onComplete={done} skipAuth initialView="onboarding" initialStep={2} />;
    if (view === 'login')      return <LoginPage  onComplete={done} onBack={() => setView('landing')} onSignUp={() => setView('signup')} />;
    if (view === 'signup')     return <SignUpPage  onComplete={() => setView('onboarding')} onBack={() => setView('landing')} onSignIn={() => setView('login')} />;
    return <LandingPage onSignIn={() => setView('login')} onCreateAccount={() => setView('signup')} />;
  }
  return <>{children}</>;
}
