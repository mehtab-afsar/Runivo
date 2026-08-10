import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, haptic, Fonts, type AppColors } from '@theme';

interface Props {
  /** Whole seconds to count down from (3 or 5, per the Settings countdown cycle). */
  seconds: number;
  onComplete: () => void;
}

export default function CountdownOverlay({ seconds, onComplete }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    haptic.light();
    // Below zero is the brief "GO" beat — held for its own short tick before
    // handing off, rather than calling onComplete the instant the number
    // hits zero (which would make "GO" flash for 0ms, never actually visible).
    const delayMs = remaining > 0 ? 1000 : 400;
    const id = setTimeout(() => {
      if (remaining <= 0) onComplete();
      else setRemaining(r => r - 1);
    }, delayMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  return (
    <View style={ss.overlay} pointerEvents="none">
      <Text style={ss.number}>{remaining > 0 ? remaining : 'GO'}</Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(10,10,10,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 500,
    },
    number: {
      fontFamily: Fonts.semiBold,
      fontSize: 96,
      color: C.alwaysLight,
      letterSpacing: -2,
    },
  });
}
