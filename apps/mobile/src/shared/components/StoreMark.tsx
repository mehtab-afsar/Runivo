import React from 'react';
import { Text } from 'react-native';
import { Fonts } from '@theme';

/**
 * The PACE Store's mark: a bold capital X in the display face. Takes the same
 * size/color props as the icon set, so it drops into icon slots.
 */
export function StoreMark({ size = 20, color = '#17181A' }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Text
      allowFontScaling={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ fontFamily: Fonts.hero, fontSize: size * 1.25, lineHeight: size * 1.25, height: size * 1.1, color, includeFontPadding: false, textAlignVertical: 'center' }}
    >
      X
    </Text>
  );
}
