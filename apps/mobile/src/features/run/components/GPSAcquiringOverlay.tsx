import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  accuracy: number | null;
}

function ringColor(acc: number | null): string {
  if (acc === null || acc > 50) return '#EF4444'; // red
  if (acc > 15) return '#F59E0B';                  // amber
  return '#22C55E';                                // green
}

// Build a translucent scrim from the theme's bg so the overlay dims the map
// correctly in both light and dark mode (a hardcoded light scrim would leave
// the inverting title/sub text illegible in dark mode).
function scrimFromBg(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function GPSAcquiringOverlay({ accuracy }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const color = ringColor(accuracy);
  const accText = accuracy !== null ? `±${Math.round(accuracy)}m` : '—';

  return (
    <View style={ss.overlay}>
      <View style={ss.center}>
        {/* Outer pulsing ring */}
        <Animated.View style={[ss.pulseRing, { borderColor: color, transform: [{ scale: pulse }], opacity: 0.35 }]} />
        {/* Inner ring */}
        <View style={[ss.ring, { borderColor: color }]}>
          <Text style={[ss.accText, { color }]}>{accText}</Text>
        </View>
        <Text style={[ss.title, { color: C.black }]}>Acquiring GPS</Text>
        <Text style={[ss.sub, { color: C.t2 ?? '#888' }]}>
          {accuracy !== null && accuracy <= 15
            ? 'Ready'
            : accuracy !== null && accuracy <= 50
            ? 'Getting accurate…'
            : 'Searching for signal'}
        </Text>
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: scrimFromBg(C.bg, 0.88),
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center' },
  pulseRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
  },
  ring: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  accText: {
    fontFamily: Fonts.medium,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    marginBottom: 4,
  },
  sub: {
    fontFamily: Fonts.regular,
    fontSize: 12,
  },
  });
}
