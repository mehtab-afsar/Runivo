import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, AccessibilityInfo } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MARK_PATH, MARK_STROKE } from './RunivoMark';

const ORANGE = '#F2A43A';
/** Same box as the native launch image (app.config imageWidth: 200). */
const MARK_SIZE = 200;
const FADE_MS = 280;

interface Props {
  ready: boolean;
  onLayout?: () => void;
  onHidden?: () => void;
}

/**
 * Launch screen while the app checks the session. It is the native launch
 * screen continued: the same big orange hexagon on white, in the same place,
 * so there is one logo, not two. It breathes once, then fades into the app.
 */
export function SplashView({ ready, onLayout, onHidden }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then(reduce => {
      if (!live || reduce) return;
      Animated.loop(Animated.sequence([
        Animated.timing(scale, { toValue: 0.94, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])).start();
    });
    return () => { live = false; };
  }, [scale]);

  useEffect(() => {
    if (!ready) return;
    Animated.timing(rootOpacity, { toValue: 0, duration: FADE_MS, delay: 80, easing: Easing.out(Easing.quad), useNativeDriver: true })
      .start(({ finished }) => { if (finished) onHidden?.(); });
  }, [ready, rootOpacity, onHidden]);

  return (
    <Animated.View style={[s.root, { opacity: rootOpacity }]} onLayout={onLayout} accessibilityLabel="Runivo" accessible>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Svg width={MARK_SIZE} height={MARK_SIZE} viewBox="0 0 100 100">
          <Path d={MARK_PATH} fill="none" stroke={ORANGE} strokeWidth={MARK_STROKE} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
});
