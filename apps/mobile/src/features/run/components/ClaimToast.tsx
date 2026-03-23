import React, { useRef, useEffect } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { Flag } from 'lucide-react-native';

const C = { white: '#FFFFFF', red: '#E8391C' };
const FONT_SEMI = 'Barlow_600SemiBold';
const FONT_BOLD = 'Barlow_700Bold';

interface ClaimToastProps {
  event: { type: string; xpEarned?: number; coinsEarned?: number } | null;
  onDismiss: () => void;
}

export default function ClaimToast({ event, onDismiss }: ClaimToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!event || event.type !== 'claimed') return;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(onDismiss);
  }, [event]);

  if (!event || event.type !== 'claimed') return null;

  return (
    <Animated.View style={[ss.toast, { opacity }]}>
      <Flag size={14} color={C.white} strokeWidth={1.5} />
      <Text style={ss.text}>Territory Claimed!</Text>
      {event.xpEarned ? <Text style={ss.xp}>+{event.xpEarned} XP</Text> : null}
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  toast: {
    position: 'absolute', top: '35%', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.red, borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 10, zIndex: 50,
    shadowColor: C.red, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  text: { fontFamily: FONT_SEMI, fontSize: 14, color: C.white },
  xp:   { fontFamily: FONT_BOLD, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
});
