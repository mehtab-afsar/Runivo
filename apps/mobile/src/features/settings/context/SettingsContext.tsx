import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { DEFAULT_SETTINGS, clearAllLocalData, clearLocalUserData } from '@shared/services/store';
import type { StoredSettings } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import { resetAnalytics } from '@shared/services/analytics';
import { loadSettings, persistSettings, signOut as signOutService } from '../services/settingsService';

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

  useEffect(() => { loadSettings().then(setSettings); }, []);

  const updateSetting = useCallback(async (patch: Partial<StoredSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await persistSettings(next);
  }, [settings]);

  const signOut = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOutService() },
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
    const { error } = await supabase.functions.invoke('delete-account', {});
    if (error) {
      Alert.alert('Something went wrong', 'We couldn\'t delete your account. Please try again, or contact support if this keeps happening.');
      return;
    }
    resetAnalytics();
    clearLocalUserData();
    await supabase.auth.signOut();
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
