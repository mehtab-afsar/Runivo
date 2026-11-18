import React from 'react';
import { View } from 'react-native';
import type { IconWeight } from 'phosphor-react-native';
import { useTheme } from '@theme';
import { glyphFor, toneColors } from './glyphs';

/** A stored emoji or icon key drawn as its icon, in its tone (or `color`). */
export function GlyphIcon({ glyph, size = 18, color, weight = 'regular' }: {
  glyph: string | null | undefined; size?: number; color?: string; weight?: IconWeight;
}) {
  const C = useTheme();
  const { Icon, tone } = glyphFor(glyph);
  return <Icon size={size} color={color ?? toneColors(C, tone).fg} weight={weight} />;
}

/**
 * The icon on its tinted tile: awards, route icons, pickers. `muted` greys it
 * out (not yet earned); `solid` inverts it (earned, highlighted).
 */
export function GlyphBadge({ glyph, size = 44, shape = 'circle', muted, solid }: {
  glyph: string | null | undefined; size?: number; shape?: 'circle' | 'square'; muted?: boolean; solid?: boolean;
}) {
  const C = useTheme();
  const { Icon, tone } = glyphFor(glyph);
  const { fg, bg } = toneColors(C, tone);
  const back = muted ? C.surface : solid ? fg : bg;
  const ink = muted ? C.t3 : solid ? C.card : fg;
  return (
    <View style={{
      width: size, height: size, borderRadius: shape === 'circle' ? size / 2 : size * 0.3,
      backgroundColor: back, alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={Math.round(size * 0.5)} color={ink} weight={muted ? 'regular' : 'fill'} />
    </View>
  );
}
