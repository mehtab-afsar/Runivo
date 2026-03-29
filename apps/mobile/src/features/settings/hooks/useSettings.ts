import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { DEFAULT_SETTINGS } from '@shared/services/store';
import type { StoredSettings } from '@shared/services/store';
import { loadSettings, persistSettings, signOut as signOutService } from '../services/settingsService';

export function useSettings() {
  const [settings, setSettings] = useState<StoredSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

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
    Alert.alert(
      'Clear Run History',
      'This will remove all local run data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Cleared', 'Local run history has been cleared.');
          },
        },
      ],
    );
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

  return { settings, updateSetting, signOut, clearHistory, cycleCountdown, cycleDifficulty };
}
