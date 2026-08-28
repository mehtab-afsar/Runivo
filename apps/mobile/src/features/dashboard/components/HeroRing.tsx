import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  size: number;
  trackColor: string;
  /** Dashed track instead of solid — used for a not-started/empty state. */
  trackDashed?: boolean;
  /** 0–1. Above 1 is clamped visually — the arc caps at a full ring rather
   *  than overlapping a second lap, so the center content stays the source
   *  of truth for the real value once someone's past their goal. */
  pct?: number;
  arcColor?: string;
  children?: React.ReactNode;
}

/**
 * The one ring shape used across the Home hero card (weekly-goal + nutrition
 * slides) — plain track + optional animated progress arc. Deliberately not
 * the old day-segmented DayArcRing (7 arcs, gradient, glossy tip) — both
 * slides read as the same simple ring now, not two different jewelry styles.
 */
export function HeroRing({ size, trackColor, trackDashed, pct, arcColor, children }: Props) {
  const r      = size / 2 - 4;
  const circ   = 2 * Math.PI * r;
  const center = size / 2;
  const strokeW = size < 70 ? 2.5 : 3.5;
  const clamped = Math.max(0, Math.min(1, pct ?? 0));

  const dashOffset = useRef(new Animated.Value(circ)).current;
  useEffect(() => {
    Animated.timing(dashOffset, {
      toValue: circ * (1 - clamped),
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [clamped, circ]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center} cy={center} r={r}
          stroke={trackColor} strokeWidth={strokeW} fill="none"
          strokeDasharray={trackDashed ? '3 5' : undefined}
          strokeLinecap={trackDashed ? 'round' : 'butt'}
        />
        {arcColor && (
          <AnimatedCircle
            cx={center} cy={center} r={r}
            stroke={arcColor} strokeWidth={strokeW} fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90, ${center}, ${center})`}
          />
        )}
      </Svg>
      {children && (
        <View style={StyleSheet.absoluteFillObject}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
        </View>
      )}
    </View>
  );
}
