import { useState, ReactNode } from 'react';
import { OnboardingFlow } from './OnboardingFlow';

interface OnboardingWrapperProps {
  children: ReactNode;
}

export function OnboardingWrapper({ children }: OnboardingWrapperProps) {
  const [complete, setComplete] = useState(() => {
    return localStorage.getItem('runivo-onboarding-complete') === 'true';
  });

  if (!complete) {
    return <OnboardingFlow onComplete={() => setComplete(true)} />;
  }

  return <>{children}</>;
}
