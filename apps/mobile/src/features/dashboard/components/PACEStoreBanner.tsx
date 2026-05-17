import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, withRepeat, withSequence, withTiming,
  useAnimatedStyle, Easing,
} from 'react-native-reanimated';
import { Hexagon, ChevronRight, Sparkles } from 'lucide-react-native';
import { useTheme, type AppColors } from '@theme';

interface Props {
  paceBalance: number;
  onPress: () => void;
}

export function PACEStoreBanner({ paceBalance, onPress }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);

  // Subtle shimmer sweep only — no hexagon animation
  const shimmerX = useSharedValue(-120);

  useEffect(() => {
    shimmerX.value = withRepeat(
      withSequence(
        withTiming(320, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withTiming(-120, { duration: 0 }),
        withTiming(-120, { duration: 2200 }),
      ),
      -1,
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <Pressable
      style={ss.wrap}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
    >
      <LinearGradient
        colors={['#1E0845', '#4F1D96', '#7C3AED', '#C026D3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ss.grad}
      >
        <Animated.View style={[ss.shimmer, shimmerStyle]} pointerEvents="none" />

        <View style={ss.topRow}>
          <View style={ss.labelRow}>
            <Sparkles size={11} color="rgba(255,255,255,0.7)" strokeWidth={1.5} />
            <Text style={ss.eyebrow}>PACE STORE</Text>
          </View>
          <View style={ss.badge}>
            <Text style={ss.badgeTxt}>NEW DROPS</Text>
          </View>
        </View>

        <View style={ss.main}>
          {/* Hollow gold hexagon — no animation */}
          <View style={ss.gemWrap}>
            <Hexagon size={40} color="#FDE68A" strokeWidth={1.8} fill="none" />
          </View>

          <View style={ss.textBlock}>
            <Text style={ss.balanceNum}>{paceBalance.toLocaleString()}</Text>
            <Text style={ss.balanceSub}>PACE balance</Text>
            <Text style={ss.subtext}>Earn 2 PACE per km you run</Text>
          </View>
        </View>

        <View style={ss.ctaRow}>
          <Text style={ss.ctaTxt}>Redeem rewards</Text>
          <ChevronRight size={14} color="rgba(255,255,255,0.9)" strokeWidth={2} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function mkStyles(_C: AppColors) {
  return StyleSheet.create({
    wrap:      { marginHorizontal: 22, marginBottom: 16, borderRadius: 20, overflow: 'hidden', shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10 },
    grad:      { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
    shimmer:   { position: 'absolute', top: 0, bottom: 0, width: 80, backgroundColor: 'rgba(255,255,255,0.08)', transform: [{ skewX: '-20deg' }] },
    topRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    labelRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
    eyebrow:   { fontFamily: 'Barlow_500Medium', fontSize: 10, letterSpacing: 1.6, color: 'rgba(255,255,255,0.7)' },
    badge:     { backgroundColor: '#FDE68A', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
    badgeTxt:  { fontFamily: 'Barlow_700Bold', fontSize: 8, color: '#78350F', letterSpacing: 0.8 },
    main:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
    gemWrap:   { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
    textBlock: { flex: 1 },
    balanceNum:{ fontFamily: 'Barlow_700Bold', fontSize: 26, color: '#fff', letterSpacing: -0.8, lineHeight: 28 },
    balanceSub:{ fontFamily: 'Barlow_500Medium', fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
    subtext:   { fontFamily: 'Barlow_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 3 },
    ctaRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.12)', paddingTop: 10 },
    ctaTxt:    { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: 'rgba(255,255,255,0.9)', letterSpacing: 0.2 },
  });
}
