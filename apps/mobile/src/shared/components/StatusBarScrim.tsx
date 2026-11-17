import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@theme';

/**
 * A strip of page background behind the status bar, for screens whose content
 * scrolls all the way to the top (Home, You). Without it cards slid under the
 * clock and battery with nothing behind them.
 */
export function StatusBarScrim({ color }: { color?: string }) {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: color ?? C.bg, zIndex: 20 }}
    />
  );
}
