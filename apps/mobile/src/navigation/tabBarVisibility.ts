/**
 * Screens can hide the floating tab bar while a bottom sheet is open, so the
 * sheet is not covered by the bar (the bar floats over content, as in the mock).
 */
import { useEffect, useSyncExternalStore } from 'react';

let hiders = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function useHideTabBar(hide: boolean): void {
  useEffect(() => {
    if (!hide) return;
    hiders += 1; emit();
    return () => { hiders -= 1; emit(); };
  }, [hide]);
}

export function useTabBarHiddenByScreen(): boolean {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => hiders > 0,
  );
}
