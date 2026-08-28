import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import Animated, {
  useSharedValue, withTiming, useAnimatedProps, Easing,
} from 'react-native-reanimated';

// Same technique as dashboard/WeeklyRing.tsx (track + glow bloom + animated arc) —
// reused here at mission-card scale so Missions reads as the same system, not a
// bolted-on flat-bar afterthought.
const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

interface Props {
  pct:   number; // 0–1
  color: string;
  /** Unfilled-track color — defaults to a white-on-dark rgba, so pass a themed
   *  token (e.g. `C.border`) explicitly when the ring sits on a light card. */
  trackColor?: string;
  size?: number;
  children?: React.ReactNode;
}

export function MissionRing({ pct, color, trackColor = 'rgba(255,255,255,0.10)', size = 52, children }: Props) {
  const r      = size / 2 - 5;
  const circ   = 2 * Math.PI * r;
  const center = size / 2;
  const strokeW     = size < 44 ? 2.5 : 3.5;
  const glowStrokeW = size < 44 ? 6 : 9;

  const clamped = Math.max(0, Math.min(1, pct));
  const targetOffset = circ * (1 - clamped);
  const dashOffset = useSharedValue(circ);

  useEffect(() => {
    dashOffset.value = withTiming(targetOffset, { duration: 600, easing: Easing.out(Easing.quad) });
  }, [targetOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  const arcProps  = useAnimatedProps(() => ({ strokeDashoffset: dashOffset.value }));
  const glowProps = useAnimatedProps(() => ({ strokeDashoffset: dashOffset.value }));

  return (
    <View style={[ss.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <SvgCircle cx={center} cy={center} r={r} stroke={trackColor} strokeWidth={strokeW} fill="none" />
        {clamped > 0 && (
          <AnimatedCircle
            cx={center} cy={center} r={r}
            stroke={color} strokeWidth={glowStrokeW} strokeOpacity={0.16}
            strokeLinecap="round" fill="none"
            strokeDasharray={circ}
            animatedProps={glowProps}
            transform={`rotate(-90, ${center}, ${center})`}
          />
        )}
        <AnimatedCircle
          cx={center} cy={center} r={r} stroke={color} strokeWidth={strokeW}
          strokeLinecap="round" fill="none"
          strokeDasharray={circ}
          animatedProps={arcProps}
          transform={`rotate(-90, ${center}, ${center})`}
        />
      </Svg>
      <View style={ss.center}>{children}</View>
    </View>
  );
}

const ss = StyleSheet.create({
  wrap:   { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
