import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Pressable, StyleSheet } from 'react-native';
import { Coins } from 'lucide-react-native';

interface Props {
  coins:     number;
  onCollect: () => void;
}

export function DailyBonusCard({ coins, onCollect }: Props) {
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
      <Coins size={13} color="#9E6800" strokeWidth={1.5} />
      <Text style={ss.text}>Daily bonus: +{coins} coins</Text>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  toast: {
    position: 'absolute', left: 16, right: 16, zIndex: 50,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 9, borderRadius: 20, backgroundColor: '#FFFFFF',
    borderWidth: 0.5, borderColor: '#DDD9D4',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 4 },
  },
  text: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#0A0A0A' },
});
