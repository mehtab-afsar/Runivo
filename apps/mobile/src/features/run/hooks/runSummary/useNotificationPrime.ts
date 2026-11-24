import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_PRIME_KEY = 'runivo:notifPrimeSeen';

/**
 * Ask for notification permission here — once, contextually, tied to a real
 * run — instead of a blank ask during onboarding setup. Delayed so it never
 * stacks on top of the award-unlock celebration sheet.
 */
export function useNotificationPrime(unlocksAward: boolean) {
  const [showNotifPrime, setShowNotifPrime] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Not on a run that unlocks an award: that celebration sheet owns the moment, and two
    // stacked Modals can fail to present on iOS. The prime waits for the next run (the
    // "seen" flag is only set once it has actually been shown).
    if (unlocksAward) return;
    AsyncStorage.getItem(NOTIF_PRIME_KEY).then(seen => {
      if (seen || cancelled) return;
      timer = setTimeout(() => setShowNotifPrime(true), 3500);
    }).catch(() => {});
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  const dismissNotifPrime = () => {
    setShowNotifPrime(false);
    AsyncStorage.setItem(NOTIF_PRIME_KEY, '1').catch(() => {});
  };
  return { showNotifPrime, dismissNotifPrime };
}
