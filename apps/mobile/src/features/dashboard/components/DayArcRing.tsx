import React, { useEffect } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import Svg, { Circle as SvgCircle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps,
  withTiming, withSpring, withRepeat, withSequence, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const SIZE   = 148;
const R      = 68;
const CX     = SIZE / 2;
const CY     = SIZE / 2;
const CIRC   = 2 * Math.PI * R;
const STEP   = 360 / 7;
const GAP_DEG = 8;
const ARC_DEG = STEP - GAP_DEG;
const ARC_LEN = (ARC_DEG / 360) * CIRC;
const DASH    = `${ARC_LEN} ${CIRC - ARC_LEN}`;

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

function arcEndpoint(startDeg: number): { x: number; y: number } {
  const rad = ((startDeg + ARC_DEG) * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}

interface DayArcRingProps {
  /** Mon–Sun, whichever this ring is measuring (ran / logged / whatever "done" means here) */
  dayDone: boolean[];
  todayIdx: number;
  /** Solid accent, or a two-stop gradient — gradient wins if both given */
  accentColor: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientId: string;
  onPress?: () => void;
  children: React.ReactNode;
}

/**
 * A week's worth of progress folded into the ring itself — 7 arc segments,
 * one per day, instead of a single smooth arc plus a separate strip of dots
 * underneath. No flat glow disc behind it (read as a cheap sticker) — the
 * only light comes from a tight bloom hugging today's arc and a single
 * glossy bead at its leading tip, closer to how Apple/Oura ring caps read
 * as jewellery rather than a progress bar.
 */
export function DayArcRing({
  dayDone, todayIdx, accentColor, gradientFrom, gradientTo, gradientId, onPress, children,
}: DayArcRingProps) {
  const scale = useSharedValue(1);
  const pulse = useSharedValue(0.25);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.25, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, true,
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pulseProps = useAnimatedProps(() => ({ strokeOpacity: pulse.value }));

  const stroke = gradientFrom && gradientTo ? `url(#${gradientId})` : accentColor;
  const todayStart = -90 + todayIdx * STEP;
  const tip = arcEndpoint(todayStart);

  const ring = (
    <Animated.View style={[styles.wrap, pressStyle]}>
      <Svg width={SIZE} height={SIZE}>
        {gradientFrom && gradientTo && (
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={gradientFrom} />
              <Stop offset="1" stopColor={gradientTo} />
            </LinearGradient>
          </Defs>
        )}

        {/* Faint full track — shows through the gaps of days not yet done */}
        <SvgCircle cx={CX} cy={CY} r={R} stroke="rgba(255,255,255,0.07)" strokeWidth={5} fill="none" />

        {Array.from({ length: 7 }).map((_, i) => {
          const done    = dayDone[i];
          const isToday = i === todayIdx;
          if (!done && !isToday) return null;
          const rotate = -90 + i * STEP;
          return (
            <React.Fragment key={i}>
              {isToday && (
                <AnimatedCircle
                  cx={CX} cy={CY} r={R} stroke={stroke} strokeWidth={9}
                  strokeLinecap="round" fill="none"
                  strokeDasharray={DASH} strokeDashoffset={0}
                  animatedProps={pulseProps}
                  transform={`rotate(${rotate}, ${CX}, ${CY})`}
                />
              )}
              <SvgCircle
                cx={CX} cy={CY} r={R} stroke={stroke}
                strokeOpacity={isToday ? 1 : 0.55}
                strokeWidth={5} strokeLinecap="round" fill="none"
                strokeDasharray={DASH} strokeDashoffset={0}
                transform={`rotate(${rotate}, ${CX}, ${CY})`}
              />
            </React.Fragment>
          );
        })}

        {/* Glossy bead at today's leading tip — small and precise, not a blown-out glow */}
        <SvgCircle cx={tip.x} cy={tip.y} r={4.5} fill="rgba(255,255,255,0.95)" />
        <SvgCircle cx={tip.x} cy={tip.y} r={2} fill={gradientTo ?? accentColor} />
      </Svg>
      <View style={styles.center}>{children}</View>
    </Animated.View>
  );

  if (!onPress) return ring;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 14, stiffness: 260 }); }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 200 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
    >
      {ring}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap:   { position: 'relative', width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center' },
});
