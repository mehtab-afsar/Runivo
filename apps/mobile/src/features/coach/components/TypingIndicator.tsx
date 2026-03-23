import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export function TypingIndicator() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay((dots.length - 1 - i) * 150),
        ]),
      ),
    );
    Animated.parallel(animations).start();
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={ss.wrap}>
      <View style={ss.avatar}>
        <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
          <View style={ss.sparkle} />
        </View>
      </View>
      <View style={ss.bubble}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[ss.dot, { opacity: dot, transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }]}
          />
        ))}
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  avatar:  { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F2EEF9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sparkle: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#5A3A8A' },
  bubble:  { flexDirection: 'row', gap: 4, backgroundColor: '#F2EEF9', borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 14, alignItems: 'center' },
  dot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: '#5A3A8A' },
});
