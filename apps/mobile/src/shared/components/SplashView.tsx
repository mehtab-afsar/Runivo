import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet } from 'react-native';

/** Same picture and size as the native launch screen (app.config: imageWidth 280). */
const SPLASH = require('../../../assets/splash-icon.png');
const SIZE = 280;
const FADE_MS = 260;

interface Props {
  ready: boolean;
  onLayout?: () => void;
  onHidden?: () => void;
}

/**
 * Launch screen while the app checks the session: the native launch screen
 * continued, pixel for pixel (thin orange hexagon over the runivo wordmark),
 * so the hand-off is invisible. It holds still (no pulsing) and fades into the
 * app as soon as the session is known.
 */
export function SplashView({ ready, onLayout, onHidden }: Props) {
  const rootOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!ready) return;
    Animated.timing(rootOpacity, { toValue: 0, duration: FADE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true })
      .start(({ finished }) => { if (finished) onHidden?.(); });
  }, [ready, rootOpacity, onHidden]);

  return (
    <Animated.View style={[s.root, { opacity: rootOpacity }]} onLayout={onLayout} accessibilityLabel="Runivo" accessible>
      <Image source={SPLASH} style={{ width: SIZE, height: SIZE }} resizeMode="contain" accessibilityIgnoresInvertColors />
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
