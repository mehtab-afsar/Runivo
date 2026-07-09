import React, { useEffect, useMemo, useRef } from 'react';
import { Text, Animated, StyleSheet } from 'react-native';
import { Coins } from 'phosphor-react-native';
import { useTheme, type AppColors } from '@theme';

interface Props {
  coins:     number;
  onCollect: () => void;
}

export function DailyBonusCard({ coins, onCollect }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const translateY = useRef(new Animated.Value(-56)).current;

  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 22 }).start();
    const t = setTimeout(() => {
      Animated.timing(translateY, { toValue: -56, duration: 200, useNativeDriver: true }).start(onCollect);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[ss.toast, { transform: [{ translateY }] }]}>
      <Coins size={13} color={C.amber} weight="light" />
      <Text style={ss.text}>Daily bonus: +{coins} coins</Text>
    </Animated.View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    toast: {
      position: 'absolute', left: 16, right: 16, zIndex: 50,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: 9, borderRadius: 20, backgroundColor: C.card,
      borderWidth: 0.5, borderColor: C.border,
      shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 4 },
    },
    text: { fontWeight: '500', fontSize: 12, color: C.t1 },
  });
}
