import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface ClaimProgressRingProps {
  progress: number; // 0-1
  visible: boolean;
}

export default function ClaimProgressRing({ progress, visible }: ClaimProgressRingProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  if (!visible) return null;

  return (
    <View style={ss.wrap}>
      <View style={ss.bg} />
      <View style={ss.fill}>
        <Text style={ss.pct}>{Math.round(progress * 100)}%</Text>
        <Text style={ss.label}>ZONE</Text>
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrap:  {
      position: 'absolute', bottom: 140, right: 16,
      width: 64, height: 64, alignItems: 'center', justifyContent: 'center',
    },
    bg:    {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 32, borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    fill:  { alignItems: 'center', justifyContent: 'center' },
    pct:   { fontFamily: Fonts.bold, fontSize: 12, color: C.red, fontVariant: ['tabular-nums'] },
    label: { fontFamily: Fonts.semiBold, fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },
  });
}
