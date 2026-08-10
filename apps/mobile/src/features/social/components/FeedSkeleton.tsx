import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, StyleSheet, Easing, type ViewStyle } from 'react-native';
import { useTheme, type AppColors } from '@theme';

function Bone({ style }: { style: ViewStyle }) {
  return <View style={style} />;
}

function SkeletonCard({ s }: { s: ReturnType<typeof mkStyles> }) {
  return (
    <View style={s.card}>
      <View style={s.header}>
        <Bone style={s.avatar} />
        <View style={{ gap: 6 }}>
          <Bone style={s.line1} />
          <Bone style={s.line2} />
        </View>
      </View>
      <Bone style={s.map} />
      <View style={s.statsRow}>
        <Bone style={s.stat} />
        <Bone style={s.stat} />
        <Bone style={s.stat} />
      </View>
    </View>
  );
}

/** Cold-load placeholder — three card-shaped bones instead of a bare spinner. */
export function FeedSkeleton() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={{ opacity: pulse }}>
      <SkeletonCard s={s} />
      <SkeletonCard s={s} />
      <SkeletonCard s={s} />
    </Animated.View>
  );
}

function mkStyles(C: AppColors) {
  const bone = { backgroundColor: C.mid, borderRadius: 6 };
  return StyleSheet.create({
    card:     { backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: C.border, padding: 16, gap: 14 },
    header:   { flexDirection: 'row', gap: 10, alignItems: 'center' },
    avatar:   { ...bone, width: 40, height: 40, borderRadius: 20 },
    line1:    { ...bone, width: 110, height: 11 },
    line2:    { ...bone, width: 70,  height: 9 },
    map:      { ...bone, height: 120, borderRadius: 10 },
    statsRow: { flexDirection: 'row', gap: 20 },
    stat:     { ...bone, width: 48, height: 22 },
  });
}
