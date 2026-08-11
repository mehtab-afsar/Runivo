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

/**
 * JS-rendered splash shown after the native splash hands off (while auth is
 * checked) — the brand mark (hollow orange hex, drawn on), no wordmark.
 */
export function SplashView({ ready, onLayout, onHidden }: Props) {
  const dashOffset = useRef(new Animated.Value(PERIM)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;
  const animDone    = useRef(false);

  useEffect(() => {
    Animated.timing(dashOffset, {
      toValue: 0, duration: 900, useNativeDriver: false,
    }).start(() => { animDone.current = true; });
  }, [dashOffset]);

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
          stroke="#FF5326"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${PERIM}`}
          strokeDashoffset={dashOffset}
        />
      </Svg>
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
});
