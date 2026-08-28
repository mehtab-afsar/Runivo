import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Flag } from 'lucide-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  weeklyKm: number;
  goalKm:   number;
  /** Lifetime run count > 0 — distinguishes "slow week" (ring stays, normal
   *  caption) from "never run" (ring suppressed, onboarding-style prompt).
   *  A 0km week is a normal week for an established runner; it's a different
   *  moment entirely for someone who's never logged a run at all. */
  hasRunHistory: boolean;
  onPress?: () => void;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * One ring, three looks:
 *  - dashed track, no arc (never run)
 *  - solid track, no arc (0km this week)
 *  - solid track + animated colored arc (this week's progress)
 * `pct` above 1 is clamped visually — the arc caps at a full ring rather than
 * overlapping a second lap, but the center number stays the real value, so
 * going past goal still reads honestly.
 */
function Ring({
  size, trackColor, trackDashed, pct, arcColor, children,
}: {
  size: number; trackColor: string; trackDashed?: boolean;
  pct?: number; arcColor?: string; children: React.ReactNode;
}) {
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
      <View style={StyleSheet.absoluteFillObject}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
      </View>
    </View>
  );
}

export function WeeklyRing({ weeklyKm, goalKm, hasRunHistory, onPress }: Props) {
  const C  = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);

  // Never run — narrative copy unchanged, a dashed empty ring added above it
  // rather than the number ring, which would otherwise show a hollow "0km"
  // that reads as a broken/failed week instead of a not-yet-started one.
  if (!hasRunHistory) {
    return (
      <View style={ss.emptyContent}>
        <Pressable onPress={onPress} disabled={!onPress}>
          <Ring size={64} trackColor="rgba(255,255,255,0.22)" trackDashed>
            <Flag size={22} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
          </Ring>
        </Pressable>
        <Text style={ss.emptyHeadline}>Your city hasn’t been claimed yet.</Text>
        <Text style={ss.emptyBody}>Run once and I’ll set your weekly goal — every km stakes new ground.</Text>
      </View>
    );
  }

  const hasWeekKm = weeklyKm > 0;
  const pct = goalKm > 0 ? weeklyKm / goalKm : 0;

  return (
    <View style={ss.content}>
      <Pressable onPress={onPress} disabled={!onPress}>
        <Ring
          size={76}
          trackColor="rgba(255,255,255,0.15)"
          pct={hasWeekKm ? pct : 0}
          arcColor={hasWeekKm ? C.red : undefined}
        >
          <View style={ss.kmRow}>
            <Text style={ss.km}>{hasWeekKm ? weeklyKm.toFixed(1) : '0'}</Text>
            <Text style={ss.kmUnit}>km</Text>
          </View>
        </Ring>
      </Pressable>
      <Text style={ss.caption}>
        {hasWeekKm ? `of ${goalKm} km goal` : `${goalKm} km weekly goal`}
      </Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    content:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 10 },
    kmRow:        { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
    km:           { fontFamily: Fonts.light, fontSize: 22, color: C.white, letterSpacing: -0.8, lineHeight: 24, fontVariant: ['tabular-nums'] },
    kmUnit:       { fontFamily: Fonts.light, fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
    caption:      { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingHorizontal: 20 },

    emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 28, gap: 10 },
    emptyHeadline:{ fontFamily: Fonts.display, fontSize: 20, lineHeight: 25, color: C.white, textAlign: 'center' },
    emptyBody:    { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  });
}
