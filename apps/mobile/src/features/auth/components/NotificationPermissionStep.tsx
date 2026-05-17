import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Shield, Flame, Zap, Heart } from 'lucide-react-native';
import { D, shared } from './onboardingStyles';

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth: number }>;

const BENEFITS: Array<{ Icon: IconComp; text: string }> = [
  { Icon: Shield, text: 'Territory alerts when rivals attack your zones' },
  { Icon: Flame,  text: 'Streak reminders to keep your run days on track' },
  { Icon: Zap,    text: 'Mission resets every morning at 6 AM' },
  { Icon: Heart,  text: 'Weekly training summary every Sunday' },
];

export default function NotificationPermissionStep() {
  const anims = useRef(BENEFITS.map(() => ({
    opacity:    new Animated.Value(0),
    translateY: new Animated.Value(14),
  }))).current;

  useEffect(() => {
    Animated.stagger(80, anims.map(({ opacity, translateY }) =>
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 22,   useNativeDriver: true }),
      ])
    )).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={shared.stepContent}>
      <Text style={shared.eyebrow}>Almost there</Text>
      <Text style={shared.heroTitle}>Stay in the loop.</Text>
      <Text style={shared.subtitle}>Get notified when your zones are under attack or missions reset.</Text>

      <View style={s.rule} />

      {BENEFITS.map((b, i) => {
        const { Icon } = b;
        return (
          <Animated.View
            key={b.text}
            style={{ opacity: anims[i].opacity, transform: [{ translateY: anims[i].translateY }] }}
          >
            <View style={s.row}>
              <View style={s.accent} />
              <Icon size={18} color={D.t3} strokeWidth={1.5} />
              <Text style={s.text}>{b.text}</Text>
            </View>
          </Animated.View>
        );
      })}

      <Text style={s.note}>You can change this at any time in Settings.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  rule: { height: 1, backgroundColor: D.div, marginBottom: 0 },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: D.div },
  accent: { width: 2, height: 32, borderRadius: 1, backgroundColor: 'transparent' },
  text: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: D.t2, flex: 1, lineHeight: 20 },
  note: { fontFamily: 'DMSans_300Light', fontSize: 10, color: D.t3, textAlign: 'center', marginTop: 24 },
});
