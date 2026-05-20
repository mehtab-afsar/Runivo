import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

const HEX_R    = 108;
const SVG_SIZE = HEX_R * 2 + 24;
const CX       = SVG_SIZE / 2;
const CY       = SVG_SIZE / 2;
const PERIM    = 6 * HEX_R;

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((i * 60 - 90) * Math.PI) / 180;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
}

interface Props {
  ready: boolean;
  onLayout?: () => void;
  onHidden?: () => void;
}

export function SplashView({ ready, onLayout, onHidden }: Props) {
  const dashOffset  = useRef(new Animated.Value(PERIM)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;
  const animDone    = useRef(false);

  // Phase 1 (0–900ms): hexagon draws. Phase 2 (600–950ms): wordmark fades in.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(dashOffset, {
        toValue: 0, duration: 900, useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(textOpacity, {
          toValue: 1, duration: 350, useNativeDriver: true,
        }),
      ]),
    ]).start(() => { animDone.current = true; });
  }, [dashOffset, textOpacity]);

  // Phase 3: fade out once auth is ready — waits for draw to finish first.
  useEffect(() => {
    if (!ready) return;

    const fadeOut = () =>
      Animated.timing(rootOpacity, {
        toValue: 0, duration: 420, delay: 120, useNativeDriver: true,
      }).start(({ finished }) => { if (finished) onHidden?.(); });

    if (animDone.current) {
      fadeOut();
    } else {
      const id = setInterval(() => {
        if (animDone.current) { clearInterval(id); fadeOut(); }
      }, 50);
      return () => clearInterval(id);
    }
  }, [ready, rootOpacity, onHidden]);

  const pts = hexPoints(CX, CY, HEX_R);

  return (
    <Animated.View style={[s.root, { opacity: rootOpacity }]} onLayout={onLayout}>
      <Svg width={SVG_SIZE} height={SVG_SIZE}>
        <AnimatedPolygon
          points={pts}
          fill="none"
          stroke="#C8391A"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${PERIM}`}
          strokeDashoffset={dashOffset}
        />
      </Svg>
      <Animated.Text style={[s.wordmark, { opacity: textOpacity }]}>
        RUNIVO
      </Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  wordmark: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    fontSize: 28,
    color: '#FFFFFF',
    letterSpacing: 6,
    marginTop: 24,
  },
});
