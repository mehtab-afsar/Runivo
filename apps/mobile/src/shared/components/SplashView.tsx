import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, AccessibilityInfo } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MARK_PATH, MARK_PERIMETER, MARK_STROKE } from './RunivoMark';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const ORANGE = '#FF4518';
const INK = '#141412';
const MARK_SIZE = 112;

// Timeline (ms). The phone's own launch screen is the same plain white, so the
// hand-off to this view is invisible; everything after is one motion.
const DRAW_MS = 760;       // the hexagon draws itself closed, top corner, clockwise
const SETTLE_MS = 220;     // a small press when the line meets itself
const WORD_DELAY_MS = 560; // the wordmark rises in under it as the line closes
const WORD_MS = 380;
const FADE_MS = 320;       // out to the app once it's ready

interface Props {
  ready: boolean;
  onLayout?: () => void;
  onHidden?: () => void;
}

/**
 * Launch screen shown while the app checks the session: white, the orange
 * mark drawing itself closed, then "runivo". Holds on the finished frame for
 * as long as loading takes, then fades into the app.
 */
export function SplashView({ ready, onLayout, onHidden }: Props) {
  const dash = useRef(new Animated.Value(MARK_PERIMETER)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const word = useRef(new Animated.Value(0)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;
  const animDone = useRef(false);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then(reduce => {
      if (!live) return;
      if (reduce) {
        dash.setValue(0); word.setValue(1);
        animDone.current = true;
        return;
      }
      Animated.parallel([
        Animated.sequence([
          Animated.timing(dash, { toValue: 0, duration: DRAW_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
          Animated.timing(scale, { toValue: 0.94, duration: SETTLE_MS / 2, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.spring(scale, { toValue: 1, damping: 9, stiffness: 260, useNativeDriver: true }),
        ]),
        Animated.timing(word, { toValue: 1, delay: WORD_DELAY_MS, duration: WORD_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => { animDone.current = true; });
    });
    return () => { live = false; };
  }, [dash, scale, word]);

  useEffect(() => {
    if (!ready) return;
    const fadeOut = () =>
      Animated.timing(rootOpacity, { toValue: 0, duration: FADE_MS, delay: 120, easing: Easing.out(Easing.quad), useNativeDriver: true })
        .start(({ finished }) => { if (finished) onHidden?.(); });
    if (animDone.current) { fadeOut(); return; }
    const id = setInterval(() => {
      if (animDone.current) { clearInterval(id); fadeOut(); }
    }, 40);
    return () => clearInterval(id);
  }, [ready, rootOpacity, onHidden]);

  return (
    <Animated.View style={[s.root, { opacity: rootOpacity }]} onLayout={onLayout} accessibilityLabel="Runivo" accessible>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Svg width={MARK_SIZE} height={MARK_SIZE} viewBox="0 0 100 100">
          <AnimatedPath
            d={MARK_PATH}
            fill="none"
            stroke={ORANGE}
            strokeWidth={MARK_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${MARK_PERIMETER} ${MARK_PERIMETER}`}
            strokeDashoffset={dash}
          />
        </Svg>
      </Animated.View>
      <Animated.Text
        style={[s.word, { opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}
        allowFontScaling={false}
      >
        runivo
      </Animated.Text>
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
  // Wordmark: Archivo 900, already loaded before this view mounts (App.tsx).
  word: { marginTop: 22, fontFamily: 'ArchivoWordmark', fontSize: 34, letterSpacing: -0.5, color: INK },
});
