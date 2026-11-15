import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Switch, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { HeartPulse } from '@mobile/shared/icons/lucideCompat';
import { healthBaseline, formatDuration, type HealthBaseline } from '@shared/engine/onboarding';
import { track } from '@shared/services/analytics';
import { readRecentWorkouts } from '@mobile/shared/services/healthService';
import { useTheme } from '@theme';
import { mkStep } from './onboardingStyles';

const APP_NAME = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';

interface Props {
  consent: boolean;
  baseline: HealthBaseline | null;
  onChange: (consent: boolean, baseline: HealthBaseline | null) => void;
}

/**
 * Optional: import the last 90 days of runs so PaceX has a real baseline on
 * day one. Health data has its own consent (GDPR, India's DPDP rules), so
 * nothing is read until the runner switches this on. Past runs never claim zones.
 */
export default function HealthStep({ consent, baseline, onChange }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStep(C), [C]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  // Bumped on every toggle. A slow import that resolves after the user has switched the
  // consent off (or on again) is stale and must not flip their choice back.
  const requestRef = useRef(0);

  async function toggle(on: boolean) {
    const req = ++requestRef.current;
    if (!on) { onChange(false, null); setChecked(false); setLoading(false); return; }
    onChange(true, null);
    setLoading(true);
    try {
      const workouts = await readRecentWorkouts(90);
      if (req !== requestRef.current) return;
      const b = healthBaseline(workouts, Date.now(), 90);
      onChange(true, b);
      track('onboarding_health_import', { runs: b?.runs ?? 0 });
    } catch {
      if (req !== requestRef.current) return;
      onChange(true, null);
    } finally {
      if (req === requestRef.current) {
        setLoading(false);
        setChecked(true);
      }
    }
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>Optional</Text>
      <Text style={s.title}>Bring your{'\n'}past runs</Text>
      <Text style={s.sub}>
        Connect {APP_NAME} and PaceX starts from your last 90 days of running, not from zero. Past runs never claim zones.
      </Text>

      <View style={[s.card, consent && s.cardOn]}>
        <View style={[s.cardIcon, consent && s.cardIconOn]}>
          <HeartPulse size={22} color={consent ? C.red : C.t1} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>Share runs from {APP_NAME}</Text>
          <Text style={s.cardSub}>Distance, time and pace only. Turn it off any time in Settings.</Text>
        </View>
        <Switch
          value={consent}
          onValueChange={toggle}
          trackColor={{ true: C.red, false: C.border }}
          accessibilityLabel={`Share runs from ${APP_NAME}`}
        />
      </View>

      {loading && <ActivityIndicator color={C.red} style={{ marginTop: 16 }} />}

      {consent && checked && !loading && (
        baseline ? (
          <View style={s.statCard}>
            <Text style={s.statUnit}>Your last 90 days</Text>
            <Text style={s.statNum}>{baseline.totalKm} <Text style={s.statUnit}>km · {baseline.runs} runs</Text></Text>
            <Text style={s.cardSub}>
              About {baseline.avgWeeklyKm} km a week · average pace {formatDuration(baseline.avgPaceSecPerKm)} /km · longest {baseline.longestKm} km
            </Text>
          </View>
        ) : (
          <Text style={s.note}>
            No runs found{Platform.OS === 'ios' ? ', or access wasn’t allowed' : ''}. That’s fine: PaceX learns from your first runs here.
          </Text>
        )
      )}

      <Text style={s.note}>
        We use this only to coach you. It’s never sold or shown to other runners, and switching it off deletes what we imported.
      </Text>
    </ScrollView>
  );
}
