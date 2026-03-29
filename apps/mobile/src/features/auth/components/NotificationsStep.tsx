/**
 * Step 5 — Notifications permission (no paywall, no inline CTA — uses shared footer).
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, Animated } from 'react-native';
import { C, shared } from './onboardingStyles';

export default function NotificationsStep() {
  const [enabled, setEnabled] = useState(true);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(cardTranslateY, { toValue: 0, damping: 24, useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={shared.stepContent}>
      <Text style={shared.eyebrow}>Almost there</Text>
      <Text style={shared.heroTitle}>Stay in the loop.</Text>
      <Text style={shared.subtitle}>Get notified when your zones are under attack or missions reset.</Text>

      <Animated.View
        style={[
          s.card,
          { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] },
        ]}
      >
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
      </Animated.View>

      <Text style={s.note}>You can change this at any time in Settings.</Text>
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
});
