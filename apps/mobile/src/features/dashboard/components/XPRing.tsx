import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  initials: string;
  avatarColor?: string;
  xpPct: number;
  level?: number;
}

export function XPRing({ initials, avatarColor = '#0A0A0A', xpPct }: Props) {
  const SZ = 40;
  const SW = 2;
  const R  = (SZ - SW) / 2;
  const C_LEN = 2 * Math.PI * R;
  const anim = useRef(new Animated.Value(C_LEN)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: C_LEN * (1 - xpPct / 100),
      duration: 1100,
      delay: 300,
      useNativeDriver: false,
    }).start();
  }, [xpPct]);

  return (
    <View style={{ width: SZ, height: SZ }}>
      <Svg width={SZ} height={SZ} style={StyleSheet.absoluteFill}>
        <Circle cx={SZ / 2} cy={SZ / 2} r={R} fill="none" stroke="#E8E4DF" strokeWidth={SW} />
        <Circle
          cx={SZ / 2} cy={SZ / 2} r={R} fill="none"
          stroke="#D93518" strokeWidth={SW} strokeLinecap="round"
          strokeDasharray={C_LEN}
          strokeDashoffset={C_LEN * (1 - xpPct / 100)}
          transform={`rotate(-90, ${SZ / 2}, ${SZ / 2})`}
        />
      </Svg>
      <View style={[ss.center, { backgroundColor: avatarColor }]}>
        <Text style={ss.text}>{initials}</Text>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  center: {
    position: 'absolute', top: 4, left: 4, right: 4, bottom: 4,
    borderRadius: 100, alignItems: 'center', justifyContent: 'center',
  },
  text: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#fff' },
});
