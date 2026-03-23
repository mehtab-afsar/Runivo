/**
 * Step 5 — Notifications permission (no paywall).
 */
import React, { useState } from 'react';
import { View, Text, Switch, Pressable, StyleSheet } from 'react-native';
import type { OnboardingStep } from '../types';
import { C, shared } from './onboardingStyles';

interface Props {
  onAdvance: (step: OnboardingStep) => void;
}

export default function NotificationsStep({ onAdvance }: Props) {
  const [enabled, setEnabled] = useState(true);

  return (
    <View style={shared.stepContent}>
      <Text style={shared.eyebrow}>Almost there</Text>
      <Text style={shared.heroTitle}>Stay in the loop.</Text>
      <Text style={shared.subtitle}>Get notified when your zones are under attack or missions reset.</Text>

      <View style={s.card}>
        <View style={s.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Enable notifications</Text>
            <Text style={s.cardSub}>Run reminders, zone alerts, mission resets</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: C.mid, true: C.red }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <Text style={s.note}>You can change this at any time in Settings.</Text>

      <Pressable style={s.btn} onPress={() => onAdvance(6)}>
        <Text style={s.btnLabel}>Continue →</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 0.5, borderColor: C.border, borderRadius: 12,
    backgroundColor: C.white, padding: 16, marginTop: 28,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black, marginBottom: 2 },
  cardSub: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2, lineHeight: 16 },
  note: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, textAlign: 'center', marginTop: 16 },
  btn: {
    marginTop: 28, backgroundColor: C.black, borderRadius: 4,
    paddingVertical: 13, alignItems: 'center',
  },
  btnLabel: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
});
