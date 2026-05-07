/**
 * Step 6 — Notifications permission (uses shared footer CTA).
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, Animated } from 'react-native';
import { D, shared } from './onboardingStyles';

export default function NotificationsStep() {
  const [enabled, setEnabled] = useState(true);

  const rowOpacity   = useRef(new Animated.Value(0)).current;
  const rowTranslateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rowOpacity,    { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(rowTranslateY, { toValue: 0, damping: 22, useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={shared.stepContent}>
      <Text style={shared.eyebrow}>Almost there</Text>
      <Text style={shared.heroTitle}>Stay in the loop.</Text>
      <Text style={shared.subtitle}>Get notified when your zones are under attack or missions reset.</Text>

      <Animated.View
        style={[
          s.row,
          { opacity: rowOpacity, transform: [{ translateY: rowTranslateY }] },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle}>Enable notifications</Text>
          <Text style={s.rowSub}>Run reminders, zone alerts, mission resets</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ false: D.div, true: D.red }}
          thumbColor="#fff"
        />
      </Animated.View>

      <Text style={s.note}>You can change this at any time in Settings.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 20,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: D.div,
    marginTop: 8,
  },
  rowTitle: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: D.t1, marginBottom: 3 },
  rowSub:   { fontFamily: 'DMSans_300Light', fontSize: 12, color: D.t2, lineHeight: 17 },
  note:     { fontFamily: 'DMSans_300Light', fontSize: 10, color: D.t3, textAlign: 'center', marginTop: 20 },
});
