import React from 'react';
import { ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@theme';
import AiConsentCard from './AiConsentCard';
import { useAiConsent } from '../hooks/useAiConsent';

/**
 * Nothing below this point may run until the runner has agreed to send their data
 * to the third-party AI: CoachScreenInner's hooks call the coach as soon as they
 * mount (weekly brief, quick prompts), so the gate has to wrap it, not sit inside.
 */
export function AiConsentGate({ children }: { children: React.ReactNode }) {
  const C = useTheme();
  const navigation = useNavigation();
  const { consent, granted } = useAiConsent();

  if (consent === true) return <>{children}</>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      {consent === null && <ActivityIndicator style={{ marginTop: 80 }} color={C.t2} />}
      {consent === false && (
        <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
          <AiConsentCard onGranted={granted} onDecline={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main' as never))} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

