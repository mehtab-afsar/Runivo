import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import Animated, {
  useSharedValue, withTiming, withDelay, withSpring,
  useAnimatedProps, useAnimatedStyle, Easing,
} from 'react-native-reanimated';

interface Props {
  weeklyKm: number;
  goalKm:   number;
  runDays:  boolean[];
}

const R    = 68;
const CIRC = 2 * Math.PI * R;

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

export function WeeklyRing({ weeklyKm, goalKm, runDays }: Props) {
  const pct      = Math.min(weeklyKm / Math.max(goalKm, 1), 1);
  const todayIdx = (new Date().getDay() + 6) % 7;

  const targetOffset = CIRC * (1 - pct);
  const dashOffset   = useSharedValue(CIRC);

  useEffect(() => {
    dashOffset.value = withTiming(targetOffset, {
      duration: 700,
      easing: Easing.out(Easing.quad),
    });
  }, [targetOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const glowProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  // Dot stagger — all 7 shared values hoisted to top level (hooks must not be inside loops/useMemo)
  const d0 = useSharedValue(0); const d1 = useSharedValue(0); const d2 = useSharedValue(0);
  const d3 = useSharedValue(0); const d4 = useSharedValue(0); const d5 = useSharedValue(0);
  const d6 = useSharedValue(0);
  const dotOpacities = [d0, d1, d2, d3, d4, d5, d6];

  useEffect(() => {
    dotOpacities.forEach((v, i) => {
      v.value = withDelay(i * 60, withSpring(1, { damping: 14, stiffness: 180 }));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dot0Style = useAnimatedStyle(() => ({ opacity: d0.value }));
  const dot1Style = useAnimatedStyle(() => ({ opacity: d1.value }));
  const dot2Style = useAnimatedStyle(() => ({ opacity: d2.value }));
  const dot3Style = useAnimatedStyle(() => ({ opacity: d3.value }));
  const dot4Style = useAnimatedStyle(() => ({ opacity: d4.value }));
  const dot5Style = useAnimatedStyle(() => ({ opacity: d5.value }));
  const dot6Style = useAnimatedStyle(() => ({ opacity: d6.value }));
  const dotStyles = [dot0Style, dot1Style, dot2Style, dot3Style, dot4Style, dot5Style, dot6Style];

  return (
    <View style={ss.content}>
      <View style={ss.ringWrap}>
        <Svg width={148} height={148}>
          {/* Track */}
          <SvgCircle cx={74} cy={74} r={R} stroke="rgba(255,255,255,0.06)" strokeWidth={5} fill="none" />
          {/* Soft glow bloom behind the arc */}
          {pct > 0 && (
            <AnimatedCircle
              cx={74} cy={74} r={R}
              stroke="#D93518" strokeWidth={16} strokeOpacity={0.13}
              strokeLinecap="round" fill="none"
              strokeDasharray={CIRC}
              animatedProps={glowProps}
              transform="rotate(-90, 74, 74)"
            />
          )}
          {/* Main arc */}
          <AnimatedCircle
            cx={74} cy={74} r={R} stroke="#D93518" strokeWidth={5}
            strokeLinecap="round" fill="none"
            strokeDasharray={CIRC}
            animatedProps={arcProps}
            transform="rotate(-90, 74, 74)"
          />
        </Svg>
        <View style={ss.center}>
          <View style={ss.kmRow}>
            <Text style={ss.km}>{weeklyKm.toFixed(1)}</Text>
            <Text style={ss.kmUnit}>km</Text>
          </View>
          <Text style={ss.kmGoal}>of {goalKm}</Text>
        </View>
      </View>

      <View style={ss.dayDots}>
        {runDays.map((active, i) => (
          <Animated.View
            key={i}
            style={[
              ss.dot,
              i === todayIdx && active  ? { backgroundColor: '#D93518', height: 5 }
              : i === todayIdx          ? { backgroundColor: 'rgba(217,53,24,0.35)', height: 5 }
              : active                  ? { backgroundColor: '#FFFFFF', opacity: 0.7 }
              :                           { backgroundColor: 'rgba(255,255,255,0.1)' },
              dotStyles[i],
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  content:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  ringWrap: { position: 'relative', width: 148, height: 148, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  center:   { position: 'absolute', alignItems: 'center' },
  kmRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  km:       { fontFamily: 'Barlow_300Light', fontSize: 38, color: '#fff', letterSpacing: -1.5, lineHeight: 40 },
  kmUnit:   { fontFamily: 'Barlow_300Light', fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  kmGoal:   { fontFamily: 'Barlow_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 3 },
  dayDots:  { flexDirection: 'row', gap: 4, paddingHorizontal: 18 },
  dot:      { flex: 1, height: 3, borderRadius: 2 },
});
