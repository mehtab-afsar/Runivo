import React from 'react';
import type { IconWeight } from 'phosphor-react-native';
import { getEmojiIcon } from '@mobile/shared/lib/emojiIcon';

interface GlyphIconProps {
  /** The emoji this glyph represents in stored data (award icons, rank badges, streak pills, ...). */
  glyph: string;
  size?: number;
  /** Overrides the glyph's mapped brand color. */
  color?: string;
  weight?: IconWeight;
}

// Single entry point for turning a stored emoji into the matching Phosphor
// vector icon — every screen that renders an emoji field (awards, ranks,
// streaks, club badges) should go through this instead of dropping the raw
// emoji character into a <Text>, so the whole app draws from one icon set
// instead of mixing vector icons with emoji glyphs of inconsistent size/weight.
export function GlyphIcon({ glyph, size = 16, color, weight = 'light' }: GlyphIconProps) {
  const { icon: Icon, color: mappedColor } = getEmojiIcon(glyph);
  return <Icon size={size} color={color ?? mappedColor} weight={weight} />;
}
