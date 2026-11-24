/**
 * "Onboarding just finished" for code outside the navigator (App.tsx starts the
 * home-area watcher for the "near you" lists). The navigator's own needsOnboarding
 * prop is left alone so finishing doesn't reset the screen the runner lands on.
 */
const listeners = new Set<() => void>();

export function onOnboardingComplete(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function notifyOnboardingComplete(): void {
  listeners.forEach(fn => fn());
}
