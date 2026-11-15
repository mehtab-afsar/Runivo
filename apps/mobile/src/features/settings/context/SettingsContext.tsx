import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { DEFAULT_SETTINGS, clearAllLocalData, saveSettings } from '@shared/services/store';
import type { StoredSettings } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import { resetAnalytics } from '@shared/services/analytics';
import { unsubscribeFromPush } from '@shared/services/pushNotificationService';
import { loadSettings, persistSettings, signOut as signOutService, runsOnlyOnThisPhone, wipeThisPhone, SERVER_SYNCED_SETTINGS } from '../services/settingsService';
import { useToast } from '@mobile/shared/hooks/useToast';
import { nativeAppleCredential } from '@features/auth/services/socialAuth';
interface SettingsContextValue {
  settings: StoredSettings;
  updateSetting: (patch: Partial<StoredSettings>) => Promise<void>;
  signOut: () => void;
  clearHistory: () => void;
  cycleCountdown: () => void;
  cycleDifficulty: () => void;
  cycleBeatPacerPace: () => void;
  deleteAccount: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoredSettings>(DEFAULT_SETTINGS);

  const { showToast } = useToast();
  // Latest settings, so two quick toggles don't both build on the same stale object.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => { loadSettings().then(setSettings); }, []);

  const updateSetting = useCallback(async (patch: Partial<StoredSettings>) => {
    const prev = settingsRef.current;
    const next = { ...prev, ...patch };
    settingsRef.current = next;
    setSettings(next);
    const { synced } = await persistSettings(next);
    if (synced) return;
    // Only roll back what the server is supposed to know about (privacy, notifications,
    // units…). Phone-only settings stay as set. Without this, a rejected privacy change
    // looked saved while the server kept the old, possibly more exposed, value.
    const keys = (Object.keys(patch) as (keyof StoredSettings)[]).filter(k => SERVER_SYNCED_SETTINGS.has(k));
    if (keys.length === 0) return;
    const reverted = { ...settingsRef.current };
    for (const k of keys) (reverted as Record<string, unknown>)[k] = prev[k];
    settingsRef.current = reverted;
    setSettings(reverted);
    await saveSettings(reverted).catch(() => {});
    showToast({ message: "Couldn't save that change. Check your connection and try again.", type: 'error' });
  }, [showToast]);

  const signOut = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
        const doSignOut = async () => {
          const { ok } = await signOutService();
          if (!ok) {
            Alert.alert('Couldn\'t sign out', 'Please check your connection and try again.');
          }
        };
        // Signing out clears this phone, so upload any runs that haven't reached
        // the server first, and warn before losing the ones that still can't.
        const pending = await runsOnlyOnThisPhone();
        if (pending === 0) { await doSignOut(); return; }
        Alert.alert(
          pending === 1 ? '1 run hasn\'t uploaded' : `${pending} runs haven't uploaded`,
          'They\'re only on this phone and will be lost if you sign out now. Connect to the internet and try again to keep them.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out anyway', style: 'destructive', onPress: () => { void doSignOut(); } },
          ],
        );
      }},
    ]);
  }, []);

  const clearHistory = useCallback(() => {
    Alert.alert('Clear Run History', 'This will remove all local run data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => {
        clearAllLocalData().then(() => {
          Alert.alert('Cleared', 'Local run history has been cleared.');
        }).catch(() => {
          Alert.alert('Error', 'Failed to clear history. Please try again.');
        });
      }},
    ]);
  }, []);

  const cycleCountdown = useCallback(() => {
    const opts: (0 | 3 | 5)[] = [0, 3, 5];
    const idx = opts.indexOf(settings.countdownSeconds);
    updateSetting({ countdownSeconds: opts[(idx + 1) % opts.length] });
  }, [settings.countdownSeconds, updateSetting]);

  const cycleDifficulty = useCallback(() => {
    const opts: ('easy' | 'mixed' | 'hard')[] = ['easy', 'mixed', 'hard'];
    const idx = opts.indexOf(settings.missionDifficulty);
    updateSetting({ missionDifficulty: opts[(idx + 1) % opts.length] });
  }, [settings.missionDifficulty, updateSetting]);

  const cycleBeatPacerPace = useCallback(() => {
    const opts = ['3:30', '4:00', '4:30', '5:00', '5:30', '6:00', '6:30', '7:00'];
    const idx = opts.indexOf(settings.beatPacerPace);
    updateSetting({ beatPacerPace: opts[(idx + 1) % opts.length] });
  }, [settings.beatPacerPace, updateSetting]);

  const performDeletion = useCallback(async () => {
    // Accounts made with Sign in with Apple must have their Apple token revoked
    // (App Store 5.1.1(v)). The authorization code is single use and expires in
    // minutes, so ask Apple for a fresh one now and send it with the request.
    let appleAuthorizationCode: string | undefined;
    const { data: { session } } = await supabase.auth.getSession();
    const usedApple = (session?.user?.app_metadata?.providers as string[] | undefined)?.includes('apple') ?? false;
    if (usedApple && Platform.OS === 'ios') {
      try {
        const cred = await nativeAppleCredential();
        if (!cred) return; // they backed out of the Apple sheet: do not delete yet
        appleAuthorizationCode = cred.authorizationCode ?? undefined;
      } catch {
        // Apple unreachable: still honour the deletion; the server logs the missing revoke.
      }
    }
    const { error } = await supabase.functions.invoke('delete-account', { body: { appleAuthorizationCode } });
    if (error) {
      Alert.alert('Something went wrong', 'We couldn\'t delete your account. Please try again, or contact support if this keeps happening.');
      return;
    }
    await unsubscribeFromPush().catch(() => {});
    await supabase.auth.signOut().catch(() => {});
    // Local data, GPS buffer, run checkpoint, cached plan, RevenueCat and analytics ids.
    await wipeThisPhone();
    // No explicit navigation — App.tsx's useAuth()-driven re-render already routes
    // to the auth stack once the session is null, same as normal sign-out.
  }, []);

  const deleteAccount = useCallback(() => {
    // RN's Alert has no text-input confirmation, so two sequential destructive
    // confirms substitute for a "type DELETE to confirm" step.
    Alert.alert(
      'Delete Account',
      'This permanently deletes your profile, run history, territory claims, and PACE balance. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue', style: 'destructive', onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'Your account and all its data will be deleted immediately and permanently.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete My Account', style: 'destructive', onPress: () => { performDeletion(); } },
              ],
            );
          },
        },
      ],
    );
  }, [performDeletion]);

  return (
    <SettingsContext.Provider value={{
      settings, updateSetting, signOut, clearHistory,
      cycleCountdown, cycleDifficulty, cycleBeatPacerPace, deleteAccount,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
