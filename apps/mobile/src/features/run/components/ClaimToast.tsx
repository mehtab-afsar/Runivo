import React, { useRef, useEffect, useMemo } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { Flag } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface ClaimToastProps {
  event: { type: string; paceEarned?: number } | null;
  onDismiss: () => void;
}

export default function ClaimToast({ event, onDismiss }: ClaimToastProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
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
      <Flag size={14} color={C.white} weight="light" />
      <Text style={ss.text}>Territory Claimed!</Text>
      {(event.paceEarned ?? 0) > 0
        ? <Text style={ss.xp}>+{event.paceEarned} PACE</Text>
        : null}
    </Animated.View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    toast: {
      position: 'absolute', top: '35%', alignSelf: 'center',
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.red, borderRadius: 24,
      paddingHorizontal: 16, paddingVertical: 10, zIndex: 50,
      shadowColor: C.red, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
    },
    text: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.white },
    xp:   { fontFamily: Fonts.bold, fontSize: 13, color: 'rgba(255,255,255,0.8)', fontVariant: ['tabular-nums'] },
  });
}
