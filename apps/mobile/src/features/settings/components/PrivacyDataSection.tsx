import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Switch, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingRow } from './SettingRow';
import { SettingSection } from './SettingSection';
import AiConsentCard from '@features/coach/components/AiConsentCard';
import { useAiConsent } from '@features/coach/hooks/useAiConsent';
import { setAiConsent } from '@shared/services/aiConsent';
import { setAnalyticsEnabled, isAnalyticsEnabled } from '@shared/services/analytics';
import { hasHealthConsent, withdrawHealthConsent } from '../services/settingsService';
import { useTheme } from '@theme';

/**
 * Where a runner changes their mind about sharing data. Each switch here
 * mirrors a consent the app asked for when the feature was first used, and
 * turning it off takes effect immediately.
 */
export function PrivacyDataSection() {
  const C = useTheme();
  const sw = useMemo(() => ({ trackColor: { true: C.black, false: C.border }, thumbColor: C.white }), [C]);
  const { consent, granted, withdrawn } = useAiConsent();
  const [asking, setAsking] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(true);
  const [healthOn, setHealthOn] = useState(false);

  useEffect(() => {
    isAnalyticsEnabled().then(setAnalyticsOn);
    hasHealthConsent().then(setHealthOn);
  }, []);

  const onAnalyticsToggle = (on: boolean) => {
    setAnalyticsOn(on);
    setAnalyticsEnabled(on).catch(() => {});
  };

  const onHealthToggle = (on: boolean) => {
    if (on) return; // consent is given with the import during onboarding; this switch only takes it back
    Alert.alert(
      'Turn off health data?',
      'We will delete the workouts we imported from your health app. Runs you record in Runivo are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn off', style: 'destructive', onPress: async () => {
          if (await withdrawHealthConsent()) setHealthOn(false);
          else Alert.alert("Couldn't turn it off", 'Check your connection and try again.');
        } },
      ],
    );
  };

  const onAiToggle = async (on: boolean) => {
    if (on) { setAsking(true); return; }       // turning ON always shows the disclosure first
    const ok = await setAiConsent(false);
    if (ok) withdrawn();
    else Alert.alert("Couldn't turn it off", 'Check your connection and try again.');
  };

  return (
    <SettingSection title="Privacy and data">
      <SettingRow label="PaceX AI coach" sub="Send my run and fitness data to Anthropic to coach me">
        <Switch value={consent === true} disabled={consent === null} onValueChange={onAiToggle} {...sw} />
      </SettingRow>

      <SettingRow label="Usage analytics" sub="Help improve Runivo with anonymous-style usage stats, tied to your account ID">
        <Switch value={analyticsOn} onValueChange={onAnalyticsToggle} {...sw} />
      </SettingRow>
      {healthOn && (
        <SettingRow label="Imported health data" sub="Workouts we imported from your health app. Turn off to delete them">
          <Switch value onValueChange={onHealthToggle} {...sw} />
        </SettingRow>
      )}

      <Modal visible={asking} animationType="slide" onRequestClose={() => setAsking(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
            <AiConsentCard
              onGranted={() => { granted(); setAsking(false); }}
              onDecline={() => setAsking(false)}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SettingSection>
  );
}

export default PrivacyDataSection;
