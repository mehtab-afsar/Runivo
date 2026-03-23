import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

const C = { red: '#E8391C' };
const FONT_BOLD = 'Barlow_700Bold';
const FONT_SEMI = 'Barlow_600SemiBold';

interface ClaimProgressRingProps {
  progress: number; // 0-1
  visible: boolean;
}

export default function ClaimProgressRing({ progress, visible }: ClaimProgressRingProps) {
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
        <Text style={ss.label}>CLAIMING</Text>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
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
  pct:   { fontFamily: FONT_BOLD, fontSize: 12, color: C.red },
  label: { fontFamily: FONT_SEMI, fontSize: 6, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },
});
