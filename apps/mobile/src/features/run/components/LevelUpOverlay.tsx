import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface Props {
  visible: boolean;
  fromLevel: number;
  toLevel: number;
  onDone: () => void;
}

const FI = 'PlayfairDisplay_400Regular_Italic';
const FS = 'Barlow_600SemiBold';
const FL = 'Barlow_300Light';

export default function LevelUpOverlay({ visible, fromLevel, toLevel, onDone }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.72)).current;

  useEffect(() => {
    if (!visible) return;

    // Fade + spring scale in
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss after 2 s
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => onDone());
    }, 2000);

    return () => clearTimeout(timer);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  return (
    <Animated.View style={[ss.overlay, { opacity }]}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale }] }}>
        <Text style={ss.label}>LEVEL UP</Text>
        <Text style={ss.number}>{toLevel}</Text>
        <Text style={ss.sub}>Lv {fromLevel} → Lv {toLevel}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  overlay: {
    position:        'absolute',
    top:             0,
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: '#0A0A0A',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          100,
  },
  label: {
    fontFamily:    FS,
    fontSize:      12,
    letterSpacing: 3,
    color:         '#D93518',
    marginBottom:  12,
  },
  number: {
    fontFamily: FI,
    fontSize:   96,
    lineHeight: 96,
    color:      '#FFFFFF',
  },
  sub: {
    fontFamily: FL,
    fontSize:   16,
    color:      'rgba(255,255,255,0.55)',
    marginTop:  16,
  },
});
