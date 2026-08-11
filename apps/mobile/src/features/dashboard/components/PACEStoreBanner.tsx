import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, withRepeat, withSequence, withTiming,
  useAnimatedStyle, Easing,
} from 'react-native-reanimated';
import { Hexagon, CaretRight, Sparkle } from 'phosphor-react-native';
import { Type, Fonts, Spacing } from '@theme';

interface Props {
  paceBalance: number;
  weeklyEarned: number;
  weeklyCap: number;
  onPress: () => void;
}

// Fixed warm bronze-to-gold card, same tone in both themes — a rewards/
// currency card reading as a premium object rather than another dark
// rectangle stacked under the dashboard hero.
export function PACEStoreBanner({ paceBalance, weeklyEarned, weeklyCap, onPress }: Props) {
  const ss = useMemo(() => mkStyles(), []);

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
      style={({ pressed }) => [ss.wrap, pressed && ss.pressed]}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
    >
      {/* A currency/rewards card should read as a premium object, not another
          black rectangle — the dashboard already stacks two of those right
          below this. Warm bronze-to-gold brushed-metal gradient instead. */}
      <LinearGradient
        colors={['#241505', '#6B4013', '#8C5A1C', '#4A2B0B']}
        locations={[0, 0.4, 0.62, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ss.grad}
      >
        <Animated.View style={[ss.shimmer, shimmerStyle]} pointerEvents="none" />

        <View style={ss.topRow}>
          <View style={ss.labelRow}>
            <Sparkle size={11} color="rgba(255,244,224,0.7)" weight="fill" />
            <Text style={ss.eyebrow}>PACE Store</Text>
          </View>
          <View style={ss.badge}>
            <Text style={ss.badgeTxt}>NEW DROPS</Text>
          </View>
        </View>

        <View style={ss.main}>
          {/* Solid gold hexagon — the PACE currency mark, now a coin rather than an outline */}
          <View style={ss.gemWrap}>
            <Hexagon size={40} color="#2A1706" weight="fill" />
            <Hexagon size={40} color="#FFE8B8" weight="thin" style={StyleSheet.absoluteFill} />
          </View>

          <View style={ss.textBlock}>
            <Text style={ss.balanceNum}>{paceBalance.toLocaleString()}</Text>
            <Text style={ss.balanceSub}>PACE balance</Text>
            <Text style={ss.subtext}>Earn 1 PACE per km you run</Text>
          </View>
        </View>

        {/* Weekly progress bar */}
        <View style={ss.weeklyWrap}>
          <View style={ss.weeklyTrack}>
            <View style={[ss.weeklyFill, { width: `${Math.min(100, Math.round(weeklyCap > 0 ? (weeklyEarned / weeklyCap) * 100 : 0))}%` }]} />
          </View>
          <Text style={ss.weeklyLabel}>{weeklyEarned} / {weeklyCap} PACE this week</Text>
        </View>

        <View style={ss.ctaRow}>
          <Text style={ss.ctaTxt}>Redeem rewards</Text>
          <CaretRight size={14} color="rgba(255,255,255,0.9)" weight="regular" />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function mkStyles() {
  return StyleSheet.create({
    wrap:      {
      marginHorizontal: Spacing.gutter, marginBottom: 16, borderRadius: 20, overflow: 'hidden',
      borderWidth: 0.75, borderColor: 'rgba(255,214,140,0.35)',
      shadowColor: '#3D2408', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 8,
    },
    pressed:   { opacity: 0.92, transform: [{ scale: 0.99 }] },
    grad:      { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
    shimmer:   { position: 'absolute', top: 0, bottom: 0, width: 90, backgroundColor: 'rgba(255,232,184,0.14)', transform: [{ skewX: '-20deg' }] },
    topRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    labelRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
    eyebrow:   { ...Type.overline, color: 'rgba(255,244,224,0.75)' },
    badge:     { backgroundColor: 'rgba(30,17,4,0.55)', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 0.5, borderColor: 'rgba(255,214,140,0.4)' },
    badgeTxt:  { fontFamily: Fonts.bold, fontSize: 10, color: '#FFE8B8', letterSpacing: 0.8 },
    main:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
    gemWrap:   { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
    textBlock: { flex: 1 },
    balanceNum:{ ...Type.metricMd, fontSize: 30, color: '#FFF6E8', lineHeight: 32 },
    balanceSub:{ ...Type.labelSm, color: 'rgba(255,244,224,0.8)', marginTop: 1 },
    subtext:   { ...Type.caption, color: 'rgba(255,244,224,0.65)', marginTop: 3 },
    weeklyWrap:  { marginBottom: 10 },
    weeklyTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(30,17,4,0.4)', overflow: 'hidden', marginBottom: 5 },
    weeklyFill:  { height: 4, backgroundColor: '#FFE8B8', borderRadius: 2 },
    weeklyLabel: { ...Type.caption, color: 'rgba(255,244,224,0.7)', fontVariant: ['tabular-nums'] },
    ctaRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, borderTopWidth: 0.5, borderTopColor: 'rgba(255,214,140,0.25)', paddingTop: 10 },
    ctaTxt:    { ...Type.label, fontFamily: Fonts.semiBold, color: 'rgba(255,246,232,0.92)', letterSpacing: 0.2 },
  });
}
