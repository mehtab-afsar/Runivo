import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { getSettings, saveSettings } from '@shared/services/store';
import { paywallMoment, paywallWeekKey, type PaywallTrigger, type Tier } from '@shared/engine/entitlements';
import { captureHandledError } from '@shared/services/errorReporting';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Opens the paywall at one of the PRD's moments, if the rules allow it right
 * now (not on first launch, not for Plus, once per moment per week).
 * Returns whether it opened.
 */
export function usePaywallMoment() {
  const navigation = useNavigation<Nav>();

  return useCallback(async (trigger: PaywallTrigger, tier: Tier, runsCompleted: number): Promise<boolean> => {
    try {
      const settings = await getSettings();
      const week = paywallWeekKey(Date.now());
      const show = paywallMoment({
        trigger,
        tier,
        runsCompleted,
        isFirstLaunch: runsCompleted <= 0,
        alreadyShownThisWeek: settings.paywallShown?.[trigger] === week,
      });
      if (!show) return false;
      await saveSettings({ ...settings, paywallShown: { ...settings.paywallShown, [trigger]: week } });
      navigation.navigate('Subscription', { reason: trigger });
      return true;
    } catch (err) {
      captureHandledError(err, { domain: 'storage', operation: 'read-paywall-gate' });
      return false;
    }
  }, [navigation]);
}
