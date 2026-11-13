import React, { useRef, useEffect, useMemo } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { CheckCircle } from 'phosphor-react-native';
import { useTheme, useIsDark, Fonts, type AppColors } from '@theme';
import { territoryPalette } from '@theme/territory';

interface ClaimToastProps {
  event: { type: string; paceEarned?: number } | null;
  onDismiss: () => void;
}

export default function ClaimToast({ event, onDismiss }: ClaimToastProps) {
  const C = useTheme();
  const zone = territoryPalette(useIsDark());
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
      <CheckCircle size={20} color={zone.own} weight="fill" />
      <Text style={ss.text}>Loop closed. This ground is yours</Text>
      {(event.paceEarned ?? 0) > 0
        ? <Text style={[ss.xp, { color: zone.own }]}>+{event.paceEarned} PACE</Text>
        : null}
    </Animated.View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    toast: {
      position: 'absolute', top: '22%', alignSelf: 'center',
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.card, borderRadius: 999,
      paddingHorizontal: 18, paddingVertical: 12, zIndex: 50,
      shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18, shadowRadius: 16, elevation: 10,
    },
    text: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    xp:   { fontFamily: Fonts.numeric, fontSize: 18, fontVariant: ['tabular-nums'] },
  });
}
