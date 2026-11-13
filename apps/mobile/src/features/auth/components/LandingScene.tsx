/**
 * LandingScene — the welcome map. A warm daylight city (blocks, a park, a
 * lake, white roads), two rival zones in blue, one of yours fading, and a run
 * that loops the park: the route draws, the loop fills red, and a card says
 * the park is yours. Then it plays again.
 *
 * react-native-svg + Animated. Reduce Motion shows the finished frame.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import { Colors, Fonts } from '@theme';

export const SCENE_W = 390;
export const SCENE_H = 520;

const RED = Colors.red;             // #FF4518
const RED_LO = Colors.redLo;        // #FFE4DA
const RIVAL = '#2F56F5';

// The run: once round the park, back to the start.
const LOOP: [number, number][] = [
  [118, 330], [170, 316], [232, 326], [256, 276], [246, 206], [192, 180], [132, 192], [106, 252], [118, 330],
];
const LOOP_D = LOOP.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('') + 'Z';

const RUN_MS = 3300;
const FILL_MS = 600;
const HOLD_MS = 2100;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function LandingScene() {
  const { width } = useWindowDimensions();
  const scale = width / SCENE_W;

  const { stops, total } = useMemo(() => {
    const d = [0];
    for (let i = 1; i < LOOP.length; i++) {
      d.push(d[i - 1] + Math.hypot(LOOP[i][0] - LOOP[i - 1][0], LOOP[i][1] - LOOP[i - 1][1]));
    }
    const t = d[d.length - 1];
    return { stops: d.map(v => v / t), total: t };
  }, []);

  const run = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) { run.setValue(1); fill.setValue(1); return; }
    const halo = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    const cycle = Animated.loop(Animated.sequence([
      Animated.timing(run, { toValue: 1, duration: RUN_MS, easing: Easing.bezier(0.45, 0.05, 0.3, 1), useNativeDriver: false }),
      Animated.timing(fill, { toValue: 1, duration: FILL_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.delay(HOLD_MS),
      Animated.timing(fill, { toValue: 0, duration: 400, useNativeDriver: false }),
      Animated.timing(run, { toValue: 0, duration: 0, useNativeDriver: false }),
    ]));
    halo.start(); cycle.start();
    return () => { halo.stop(); cycle.stop(); };
  }, [reduceMotion, run, fill, pulse]);

  const dashOffset = run.interpolate({ inputRange: [0, 1], outputRange: [total, 0] });
  const dotX = run.interpolate({ inputRange: stops, outputRange: LOOP.map(p => p[0] * scale) });
  const dotY = run.interpolate({ inputRange: stops, outputRange: LOOP.map(p => p[1] * scale) });
  const zoneOpacity = fill.interpolate({ inputRange: [0, 1], outputRange: [0, 0.32] });
  const toastLift = fill.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  const toastScale = fill.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 3.6] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={{ width, height: SCENE_H * scale }} pointerEvents="none">
      <Svg width={width} height={SCENE_H * scale} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}>
        <Defs>
          <Pattern id="blk" width="34" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(9)">
            <Rect x="3" y="3" width="28" height="24" rx="3" fill="#E6E4DE" />
          </Pattern>
          <Pattern id="fade" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect width="7" height="7" fill={RED_LO} />
            <Rect width="2.6" height="7" fill={RED} opacity={0.6} />
          </Pattern>
        </Defs>

        <Rect width={SCENE_W} height={SCENE_H} fill="#EFEDE8" />
        <Rect width={SCENE_W} height={SCENE_H} fill="url(#blk)" />
        {/* Lake and park */}
        <Path d="M-10 455C80 420 160 478 250 452S360 410 400 424" fill="none" stroke="#D3E2EE" strokeWidth={30} />
        <Path d="M96 196C140 150 230 150 262 196L276 300C250 352 150 360 104 330Z" fill="#DCEAD3" />
        {/* Main roads */}
        <Path d="M-10 120L400 92M-10 392L400 372M168 -10L190 530M318 -10L300 530" stroke="#FFFFFF" strokeWidth={9} fill="none" strokeLinecap="round" />

        {/* Rivals' zones, and one of yours fading */}
        <Path d="M296 128l44 6 8 46-38 16-24-32z" fill={RIVAL} fillOpacity={0.2} stroke={RIVAL} strokeWidth={2.5} strokeLinejoin="round" />
        <Path d="M282 240l70-4 4 54-60 10z" fill={RIVAL} fillOpacity={0.2} stroke={RIVAL} strokeWidth={2.5} strokeLinejoin="round" />
        <Path d="M20 404l58-10 14 50-50 16-26-22z" fill="url(#fade)" stroke={RED} strokeWidth={2} strokeDasharray="5 4" />

        {/* The claim */}
        <AnimatedPath d={LOOP_D} fill={RED} fillOpacity={zoneOpacity as unknown as number} />
        <AnimatedPath d={LOOP_D} fill="none" stroke="#FFFFFF" strokeWidth={9} strokeLinejoin="round" strokeLinecap="round"
          strokeDasharray={`${total} ${total}`} strokeDashoffset={dashOffset as unknown as number} />
        <AnimatedPath d={LOOP_D} fill="none" stroke={RED} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round"
          strokeDasharray={`${total} ${total}`} strokeDashoffset={dashOffset as unknown as number} />

        <SvgText x="150" y="262" fontFamily={Fonts.medium} fontSize="10" fill="#7E7B72">Cubbon Park</SvgText>
        <SvgText x="18" y="484" fontFamily={Fonts.medium} fontSize="9" fill="#8FA9BF">Ulsoor Lake</SvgText>
      </Svg>

      {/* Runner */}
      <Animated.View style={[s.runner, { transform: [{ translateX: dotX }, { translateY: dotY }] }]}>
        <Animated.View style={[s.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]} />
        <View style={s.dot} />
      </Animated.View>

      {/* The moment it's yours */}
      <Animated.View style={[s.toast, { opacity: fill, transform: [{ translateY: toastLift }, { scale: toastScale }] }]}>
        <Text style={s.toastNum}>+26</Text>
        <View>
          <Text style={s.toastTitle}>PACE earned</Text>
          <Text style={s.toastSub}>Morning loop · 8.1 km</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const DOT = 14;

const s = StyleSheet.create({
  runner:     { position: 'absolute', left: -DOT / 2, top: -DOT / 2, width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' },
  halo:       { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: RED },
  dot:        { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: '#0C0C0D', borderWidth: 3, borderColor: '#FFFFFF' },
  toast:      {
    position: 'absolute', left: 16, top: 80,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12,
    shadowColor: '#14120F', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  toastNum:   { fontFamily: Fonts.numeric, fontSize: 24, lineHeight: 24, color: RED },
  toastTitle: { fontFamily: Fonts.bold, fontSize: 12, lineHeight: 15, color: '#0C0C0D' },
  toastSub:   { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 15, color: '#64636A' },
});
